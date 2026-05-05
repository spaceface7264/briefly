"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BRAND_BUCKET,
  brandGuidelinesPath,
  brandLogoPath,
  extractBrandStoragePath,
} from "@/lib/storage/brand";
import {
  COLORS_MAX,
  LOGO_SLOT_VALUES,
  NOTES_MAX,
  TYPOGRAPHY_MAX,
  type BrandColor,
  type BrandTypography,
  type BrandTypographyRole,
  type LogoSlot,
  type SaveBrandKitInput,
} from "./types";

type ActionResult = { ok: true } | { ok: false; error: string };

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const GUIDELINES_MAX_BYTES = 10 * 1024 * 1024;

const LOGO_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);
const GUIDELINES_ALLOWED_TYPES = new Set(["application/pdf"]);

const TYPOGRAPHY_ROLES: ReadonlySet<BrandTypographyRole> = new Set([
  "heading",
  "body",
  "mono",
  "accent",
]);

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function logoExtension(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/svg+xml":
      return "svg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function logoUrlColumn(slot: LogoSlot): "logo_mark_url" | "logo_dark_url" | "logo_light_url" {
  switch (slot) {
    case "mark":
      return "logo_mark_url";
    case "dark":
      return "logo_dark_url";
    case "light":
      return "logo_light_url";
  }
}

/**
 * Ensures a `brand_kits` row exists for the org. Returns the row.
 * Service-role client because the upsert may run before any read has
 * established the row server-side, and we want it idempotent regardless
 * of which write path lands first.
 */
async function ensureBrandKitRow(orgId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("brand_kits")
    .upsert({ org_id: orgId }, { onConflict: "org_id" });
  if (error) {
    throw new Error(`Failed to initialise brand kit: ${error.message}`);
  }
  return admin;
}

/**
 * Upload a logo variant (mark / dark / light) to the brand-assets
 * bucket and persist its public-shape URL on the corresponding
 * `brand_kits` column. Deletes the previous file in that slot if it
 * lived in our bucket.
 *
 * Mirrors `uploadOrgLogo` in `src/app/admin/settings/org-actions.ts`.
 * Bucket is private; we store the canonical public-style path so the
 * read path can extract it and mint signed URLs on demand.
 */
export async function uploadBrandLogo(
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const slotRaw = formData.get("slot");
  if (typeof slotRaw !== "string" || !LOGO_SLOT_VALUES.includes(slotRaw as LogoSlot)) {
    return { ok: false, error: "Invalid logo slot" };
  }
  const slot = slotRaw as LogoSlot;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be under 2 MB" };
  }
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      error: "Logo must be PNG, JPEG, SVG, or WebP",
    };
  }

  const admin = await ensureBrandKitRow(gate.orgId);
  const path = brandLogoPath(gate.orgId, slot, logoExtension(file.type));

  const { error: uploadErr } = await admin.storage
    .from(BRAND_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    return { ok: false, error: `Upload failed: ${uploadErr.message}` };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BRAND_BUCKET).getPublicUrl(path);

  const column = logoUrlColumn(slot);
  const { data: prev } = await admin
    .from("brand_kits")
    .select(column)
    .eq("org_id", gate.orgId)
    .maybeSingle();
  const prevUrl = (prev as Record<string, string | null> | null)?.[column] ?? null;

  const updatePatch =
    column === "logo_mark_url"
      ? { logo_mark_url: publicUrl }
      : column === "logo_dark_url"
        ? { logo_dark_url: publicUrl }
        : { logo_light_url: publicUrl };

  const { error: dbErr } = await admin
    .from("brand_kits")
    .update(updatePatch)
    .eq("org_id", gate.orgId);
  if (dbErr) {
    await admin.storage.from(BRAND_BUCKET).remove([path]);
    return { ok: false, error: `Failed to save logo: ${dbErr.message}` };
  }

  if (prevUrl) {
    const prevPath = extractBrandStoragePath(prevUrl);
    if (prevPath && prevPath !== path) {
      await admin.storage.from(BRAND_BUCKET).remove([prevPath]);
    }
  }

  revalidatePath("/admin/brand");
  return { ok: true };
}

export async function removeBrandLogo(slot: LogoSlot): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!LOGO_SLOT_VALUES.includes(slot)) {
    return { ok: false, error: "Invalid logo slot" };
  }

  const admin = createAdminClient();
  const column = logoUrlColumn(slot);

  const { data: row, error: readErr } = await admin
    .from("brand_kits")
    .select(column)
    .eq("org_id", gate.orgId)
    .maybeSingle();
  if (readErr) {
    return { ok: false, error: `Lookup failed: ${readErr.message}` };
  }

  const currentUrl = (row as Record<string, string | null> | null)?.[column] ?? null;

  const clearPatch =
    column === "logo_mark_url"
      ? { logo_mark_url: null }
      : column === "logo_dark_url"
        ? { logo_dark_url: null }
        : { logo_light_url: null };

  const { error: dbErr } = await admin
    .from("brand_kits")
    .update(clearPatch)
    .eq("org_id", gate.orgId);
  if (dbErr) {
    return { ok: false, error: `Failed to clear logo: ${dbErr.message}` };
  }

  if (currentUrl) {
    const path = extractBrandStoragePath(currentUrl);
    if (path) {
      await admin.storage.from(BRAND_BUCKET).remove([path]);
    }
  }

  revalidatePath("/admin/brand");
  return { ok: true };
}

/**
 * Upload a brand-guidelines PDF. Replaces any existing PDF (deletes the
 * old object) and replaces any external URL the org may have set
 * earlier: the field carries either a bucket path or an external link,
 * not both.
 */
export async function uploadGuidelinesFile(
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided" };
  }
  if (file.size > GUIDELINES_MAX_BYTES) {
    return { ok: false, error: "Guidelines PDF must be under 10 MB" };
  }
  if (!GUIDELINES_ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Guidelines must be a PDF" };
  }

  const admin = await ensureBrandKitRow(gate.orgId);
  const path = brandGuidelinesPath(gate.orgId, "pdf");

  const { error: uploadErr } = await admin.storage
    .from(BRAND_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    return { ok: false, error: `Upload failed: ${uploadErr.message}` };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(BRAND_BUCKET).getPublicUrl(path);

  const { data: prev } = await admin
    .from("brand_kits")
    .select("guidelines_url")
    .eq("org_id", gate.orgId)
    .maybeSingle();

  const { error: dbErr } = await admin
    .from("brand_kits")
    .update({ guidelines_url: publicUrl })
    .eq("org_id", gate.orgId);
  if (dbErr) {
    await admin.storage.from(BRAND_BUCKET).remove([path]);
    return { ok: false, error: `Failed to save guidelines: ${dbErr.message}` };
  }

  if (prev?.guidelines_url) {
    const prevPath = extractBrandStoragePath(prev.guidelines_url);
    if (prevPath && prevPath !== path) {
      await admin.storage.from(BRAND_BUCKET).remove([prevPath]);
    }
  }

  revalidatePath("/admin/brand");
  return { ok: true };
}

/**
 * Set guidelines to an external URL (e.g. a Notion / Figma / Drive link).
 * Replaces any uploaded PDF: the field is single-valued and the old
 * file is removed from the bucket so we don't accumulate orphans.
 */
export async function setGuidelinesUrl(url: string): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "URL is required" };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "URL must be http or https" };
    }
  } catch {
    return { ok: false, error: "Invalid URL" };
  }

  const admin = await ensureBrandKitRow(gate.orgId);

  const { data: prev } = await admin
    .from("brand_kits")
    .select("guidelines_url")
    .eq("org_id", gate.orgId)
    .maybeSingle();

  const { error: dbErr } = await admin
    .from("brand_kits")
    .update({ guidelines_url: trimmed })
    .eq("org_id", gate.orgId);
  if (dbErr) {
    return { ok: false, error: `Failed to save URL: ${dbErr.message}` };
  }

  if (prev?.guidelines_url) {
    const prevPath = extractBrandStoragePath(prev.guidelines_url);
    if (prevPath) {
      await admin.storage.from(BRAND_BUCKET).remove([prevPath]);
    }
  }

  revalidatePath("/admin/brand");
  return { ok: true };
}

export async function removeGuidelines(): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();
  const { data: prev } = await admin
    .from("brand_kits")
    .select("guidelines_url")
    .eq("org_id", gate.orgId)
    .maybeSingle();

  const { error: dbErr } = await admin
    .from("brand_kits")
    .update({ guidelines_url: null })
    .eq("org_id", gate.orgId);
  if (dbErr) {
    return { ok: false, error: `Failed to clear guidelines: ${dbErr.message}` };
  }

  if (prev?.guidelines_url) {
    const path = extractBrandStoragePath(prev.guidelines_url);
    if (path) {
      await admin.storage.from(BRAND_BUCKET).remove([path]);
    }
  }

  revalidatePath("/admin/brand");
  return { ok: true };
}

function sanitizeColors(input: unknown): BrandColor[] {
  if (!Array.isArray(input)) return [];
  const out: BrandColor[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { name?: unknown; hex?: unknown };
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const hex = typeof candidate.hex === "string" ? candidate.hex.trim() : "";
    if (!name || !HEX_RE.test(hex)) continue;
    out.push({ name: name.slice(0, 60), hex: hex.toLowerCase() });
    if (out.length >= COLORS_MAX) break;
  }
  return out;
}

function sanitizeTypography(input: unknown): BrandTypography[] {
  if (!Array.isArray(input)) return [];
  const out: BrandTypography[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as {
      role?: unknown;
      family?: unknown;
      url?: unknown;
    };
    const role =
      typeof candidate.role === "string" &&
      TYPOGRAPHY_ROLES.has(candidate.role as BrandTypographyRole)
        ? (candidate.role as BrandTypographyRole)
        : null;
    const family = typeof candidate.family === "string" ? candidate.family.trim() : "";
    if (!role || !family) continue;
    let url: string | null = null;
    if (typeof candidate.url === "string" && candidate.url.trim()) {
      try {
        const parsed = new URL(candidate.url.trim());
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          url = candidate.url.trim();
        }
      } catch {
        url = null;
      }
    }
    out.push({ role, family: family.slice(0, 80), url });
    if (out.length >= TYPOGRAPHY_MAX) break;
  }
  return out;
}

/**
 * Save the colors / typography / notes block in one shot. Logos and
 * guidelines have their own actions because they involve files; this
 * action covers everything that's just JSON / text.
 *
 * Validates the caps server-side (12 colors, 6 typography rows, 1000
 * char notes). Trusts nothing about the client's IDs: the org is
 * resolved from the session via `requireOrgAdmin`.
 */
export async function saveBrandKit(
  input: SaveBrandKitInput
): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const colors = sanitizeColors(input.colors);
  const typography = sanitizeTypography(input.typography);
  const notes = (typeof input.notes === "string" ? input.notes : "")
    .trim()
    .slice(0, NOTES_MAX);

  const admin = await ensureBrandKitRow(gate.orgId);
  const { error } = await admin
    .from("brand_kits")
    .update({
      colors,
      typography,
      notes: notes || null,
    })
    .eq("org_id", gate.orgId);
  if (error) {
    return { ok: false, error: `Failed to save: ${error.message}` };
  }

  revalidatePath("/admin/brand");
  return { ok: true };
}
