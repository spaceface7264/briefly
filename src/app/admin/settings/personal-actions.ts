"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountType } from "@/lib/account";
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
} from "@/lib/creator-profile";

/**
 * Org-side personal-account actions. Today this is just avatar
 * upload + remove; the rest of the Personal tab (name, password)
 * still talks to Supabase from the client because the existing
 * inline writes already have the right RLS coverage.
 *
 * The avatar action mirrors the creator-side `uploadAvatar` /
 * `removeAvatar` pair from `src/app/profile/profile-actions.ts`
 * almost line-for-line. Only the auth gate differs — this surface
 * is for org users, the creator surface is for creator users —
 * so we duplicate the action body deliberately rather than
 * factoring a shared helper. Each action stays auditable as a
 * single trust boundary.
 *
 * The bucket, MIME allow-list, size cap, and path convention all
 * come from `src/lib/creator-profile.ts`. The constants live
 * there for historical reasons (they were introduced for the
 * creator profile MVP) but are not creator-specific — the
 * `avatars` bucket holds avatars for both account types.
 */

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
 * Auth gate: must be authenticated AND an org account. Creators
 * have their own avatar editor at `/profile/settings`; sending a
 * creator request through here would write to the right column
 * but with the wrong audit trail, so reject upstream.
 */
async function requireOrgUser(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const accountType = await getAccountType(supabase);
  if (accountType !== "org") {
    return { ok: false, error: "Org account required" };
  }

  return { ok: true, userId: user.id };
}

/**
 * Upload an org user's avatar to the public `avatars` bucket and
 * persist the URL on `profiles.avatar_url`. Replaces any previous
 * avatar so we don't accumulate orphans. Path is
 * `{random_uuid}.{ext}` — no `user_id` in the path so the URL
 * alone doesn't leak the auth UUID.
 *
 * Storage writes go through the service-role client; the
 * `avatars` bucket has no user-facing INSERT policy. This action
 * IS the authorisation surface, gated by `requireOrgUser()`.
 */
export async function uploadOrgUserAvatar(
  formData: FormData
): Promise<ActionResult> {
  const gate = await requireOrgUser();
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
    // Roll back the upload to avoid an orphan blob.
    await admin.storage.from(AVATARS_BUCKET).remove([path]);
    return { ok: false, error: `Failed to save avatar: ${dbErr.message}` };
  }

  if (prev?.avatar_url) {
    const prevPath = extractStoragePath(prev.avatar_url);
    if (prevPath && prevPath !== path) {
      await admin.storage.from(AVATARS_BUCKET).remove([prevPath]);
    }
  }

  // The avatar shows in the admin sidebar and in every admin
  // creator-listing surface, so revalidate the layout boundary
  // and not just /admin/settings.
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/**
 * Clear `profiles.avatar_url` and delete the underlying storage
 * object. No-op if the user has no avatar set.
 */
export async function removeOrgUserAvatar(): Promise<ActionResult> {
  const gate = await requireOrgUser();
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

  revalidatePath("/admin", "layout");
  return { ok: true };
}
