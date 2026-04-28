"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

const LOGO_BUCKET = "org-logos";
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

function extensionFor(mimeType: string): string {
  switch (mimeType) {
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

/**
 * Switch the current user's active org.
 */
export async function switchOrg(orgId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Verify user has a membership in the target org
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();

  if (!membership) {
    return { ok: false, error: "You are not a member of this organization" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_org_id: orgId })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: `Failed to switch org: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Update organization details (admin only).
 */
export async function updateOrgDetails(
  data: {
    name?: string;
    description?: string;
    logo_url?: string;
    accent_color?: string;
    discoverable?: boolean;
    industry?: string;
    contact_email?: string;
    address?: string;
    cvr?: string;
    vat_number?: string;
  }
): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error } = await gate.supabase
    .from("organizations")
    .update(data)
    .eq("id", gate.orgId);

  if (error) {
    return { ok: false, error: `Failed to update: ${error.message}` };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

/**
 * Upload an org logo to Supabase Storage and persist the resulting
 * public URL on `organizations.logo_url`. The previous logo (if it
 * lives in our bucket) is deleted on success so we don't accumulate
 * orphan objects.
 *
 * Validates org-admin access via `requireOrgAdmin()`. Storage writes
 * use the service-role client because the bucket has no user-facing
 * INSERT policies — the action *is* the authorisation surface.
 */
export async function uploadOrgLogo(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

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

  const adminDb = createAdminClient();

  const ext = extensionFor(file.type);
  const path = `${gate.orgId}/logo-${Date.now()}.${ext}`;

  const { error: uploadErr } = await adminDb.storage
    .from(LOGO_BUCKET)
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
  } = adminDb.storage.from(LOGO_BUCKET).getPublicUrl(path);

  // Find the previous logo so we can delete it after the new one is
  // saved. Only delete if it lives in our bucket — external URLs stay
  // untouched.
  const { data: prevOrg } = await adminDb
    .from("organizations")
    .select("logo_url")
    .eq("id", gate.orgId)
    .single();

  const { error: dbErr } = await adminDb
    .from("organizations")
    .update({ logo_url: publicUrl })
    .eq("id", gate.orgId);

  if (dbErr) {
    // Don't leave an orphan upload if the DB update failed.
    await adminDb.storage.from(LOGO_BUCKET).remove([path]);
    return { ok: false, error: `Failed to save logo: ${dbErr.message}` };
  }

  if (prevOrg?.logo_url) {
    const prevPath = extractStoragePath(prevOrg.logo_url, LOGO_BUCKET);
    if (prevPath && prevPath !== path) {
      await adminDb.storage.from(LOGO_BUCKET).remove([prevPath]);
    }
  }

  revalidatePath("/admin/settings");
  return { ok: true, url: publicUrl };
}

/**
 * Pull the storage object path out of a Supabase public URL. Returns
 * null if the URL doesn't look like one we issued.
 *
 * Public URLs look like:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}
