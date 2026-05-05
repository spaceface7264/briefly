"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountType } from "@/lib/account";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
  BIO_MAX,
  isValidCountry,
  sanitizeLanguages,
  sanitizeSkills,
} from "@/lib/creator-profile";

const AVATARS_BUCKET = "avatars";

type ActionResult = { ok: true } | { ok: false; error: string };

function avatarExtension(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function extractStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${AVATARS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split("?")[0];
}

/**
 * Auth gate for these actions: must be authenticated AND a creator
 * account. Org users live in /admin/settings and have no business
 * writing to creator-only profile fields.
 *
 * Returns the supabase client + user id so callers don't have to
 * re-fetch them. Mirrors the `requireOrgAdmin` helper shape so the
 * callsite stays consistent with the org-side actions.
 */
async function requireCreatorUser(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const accountType = await getAccountType(supabase);
  if (accountType !== "creator") {
    return { ok: false, error: "Creator account required" };
  }

  return { ok: true, supabase, userId: user.id };
}

/**
 * Upload a new creator avatar to the public `avatars` bucket and
 * persist the resulting URL on `profiles.avatar_url`. Replaces any
 * previous avatar (object delete after the DB write succeeds) so
 * we don't accumulate orphan blobs.
 *
 * Path is `{random_uuid}.{ext}` — deliberately omits user_id so the
 * URL alone doesn't leak the auth UUID. The mapping lives only on
 * the profile row.
 *
 * Storage writes go through the service-role client because the
 * `avatars` bucket has no user-facing INSERT policy on
 * `storage.objects` (same shape as `org-logos` from 0031). This
 * action *is* the authorisation surface, gated by
 * `requireCreatorUser()`.
 */
export async function uploadAvatar(
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireCreatorUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file provided" };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Avatar must be under 2 MB" };
  }
  if (!AVATAR_ALLOWED_MIME_TYPES.has(file.type)) {
    return { ok: false, error: "Avatar must be PNG, JPEG, or WebP" };
  }

  const admin = createAdminClient();
  const ext = avatarExtension(file.type);
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from(AVATARS_BUCKET)
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
  } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(path);

  // Capture the previous avatar URL so we can clean up after the
  // new one is persisted. Read via the admin client to keep all
  // storage-coupled state on a single trust boundary.
  const { data: prev } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", gate.userId)
    .single();

  const { error: dbErr } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", gate.userId);

  if (dbErr) {
    // Roll back the upload if the DB write failed; otherwise we
    // leak an object that nothing references.
    await admin.storage.from(AVATARS_BUCKET).remove([path]);
    return { ok: false, error: `Failed to save avatar: ${dbErr.message}` };
  }

  if (prev?.avatar_url) {
    const prevPath = extractStoragePath(prev.avatar_url);
    if (prevPath && prevPath !== path) {
      await admin.storage.from(AVATARS_BUCKET).remove([prevPath]);
    }
  }

  revalidatePath("/profile/settings");
  return { ok: true };
}

/**
 * Clear the avatar URL on the profile and delete the underlying
 * object from storage. No-op if the user has no avatar set.
 */
export async function removeAvatar(): Promise<ActionResult> {
  const gate = await requireCreatorUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const admin = createAdminClient();

  const { data: prev } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", gate.userId)
    .single();

  if (!prev?.avatar_url) {
    return { ok: true };
  }

  const { error: dbErr } = await admin
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", gate.userId);
  if (dbErr) {
    return { ok: false, error: `Failed to clear avatar: ${dbErr.message}` };
  }

  const prevPath = extractStoragePath(prev.avatar_url);
  if (prevPath) {
    await admin.storage.from(AVATARS_BUCKET).remove([prevPath]);
  }

  revalidatePath("/profile/settings");
  return { ok: true };
}

interface SaveCreatorProfileInput {
  name: string;
  instagram: string;
  bio: string;
  country: string | null;
  languages: string[];
  skills: string[];
}

/**
 * Persist the text/JSON portion of the creator profile in one
 * shot. Avatar uploads have their own action because they involve
 * a file upload + storage cleanup.
 *
 * All fields are sanitised server-side (length caps, controlled-
 * vocabulary filters) — the client UI is the *first* line of
 * defence, not the only one. The DB CHECK constraints from 0042
 * are the last.
 */
export async function saveCreatorProfile(
  input: SaveCreatorProfileInput
): Promise<ActionResult> {
  const gate = await requireCreatorUser();
  if (!gate.ok) return { ok: false, error: gate.error };

  const name =
    typeof input.name === "string" ? input.name.trim().slice(0, 200) : "";
  const instagram =
    typeof input.instagram === "string"
      ? input.instagram.trim().slice(0, 100)
      : "";
  const bio =
    typeof input.bio === "string" ? input.bio.trim().slice(0, BIO_MAX) : "";
  const country =
    typeof input.country === "string" && isValidCountry(input.country)
      ? input.country
      : null;
  const languages = sanitizeLanguages(input.languages);
  const skills = sanitizeSkills(input.skills);

  const { error } = await gate.supabase
    .from("profiles")
    .update({
      name: name || null,
      instagram_handle: instagram || null,
      bio: bio || null,
      country,
      languages,
      skills,
    })
    .eq("id", gate.userId);

  if (error) {
    return { ok: false, error: `Failed to save: ${error.message}` };
  }

  revalidatePath("/profile/settings");
  return { ok: true };
}
