"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBMISSIONS_BUCKET = "submissions";

// Mirrors the Storage bucket constraints defined in
// 0035_submissions_storage_bucket.sql. Duplicated here so the action
// can return a friendly error before the bucket would reject the
// upload itself.
const MAX_FILE_BYTES = 250 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

// Soft cap to keep one submission from accidentally uploading hundreds
// of files in a single request. The bucket itself has no per-claim
// limit; this is purely a sanity guard.
const MAX_ATTACHMENTS_PER_SUBMIT = 10;

type SubmitResult = { ok: true } | { ok: false; error: string };

/**
 * Submit a creator's claim. Accepts any combination of:
 *   - `submissionUrl` — single hosted link (YouTube / Vimeo / IG)
 *   - `submissionNotes` — free-text notes for the reviewer
 *   - `files` — zero or more native uploads, each within the bucket
 *     limits from migration 0035
 *
 * At least one of `submissionUrl` or `files` must be present — there's
 * no point flipping a claim to "submitted" with nothing attached.
 *
 * Permission model: the caller must be the claim's owner and the claim
 * must currently be in `active` state. Both checks happen against the
 * standard (RLS-bound) client before any service-role write fires, so
 * the caller can't observe or mutate someone else's claim through this
 * action even with a service-role bug elsewhere.
 *
 * The Postgres trigger from migration 0018 takes care of firing the
 * `claim_submitted` notification to org admins when the status flips.
 *
 * Rollback: if any step after the first storage upload fails, all
 * uploaded objects and any attachment rows we managed to insert are
 * removed best-effort so we don't leave orphans.
 */
export async function submitClaim(formData: FormData): Promise<SubmitResult> {
  const claimId = formData.get("claimId")?.toString().trim();
  const submissionUrl =
    formData.get("submissionUrl")?.toString().trim() || null;
  const submissionNotes =
    formData.get("submissionNotes")?.toString().trim() || null;
  const files = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!claimId) {
    return { ok: false, error: "claimId is required" };
  }
  if (!submissionUrl && files.length === 0) {
    return {
      ok: false,
      error: "Provide either a submission URL or at least one file",
    };
  }
  if (files.length > MAX_ATTACHMENTS_PER_SUBMIT) {
    return {
      ok: false,
      error: `Max ${MAX_ATTACHMENTS_PER_SUBMIT} files per submission`,
    };
  }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `${file.name} exceeds the 250 MB limit`,
      };
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return {
        ok: false,
        error: `${file.name}: file type "${file.type}" is not allowed`,
      };
    }
  }

  // Auth + ownership + state check via standard (RLS-bound) client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in" };
  }

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, user_id, status, brief_id")
    .eq("id", claimId)
    .maybeSingle();
  if (claimErr) {
    return { ok: false, error: `Lookup failed: ${claimErr.message}` };
  }
  if (!claim) {
    return { ok: false, error: "Claim not found" };
  }
  if (claim.user_id !== user.id) {
    return { ok: false, error: "Not your claim" };
  }
  if (claim.status !== "active") {
    return {
      ok: false,
      error: `Claim is ${claim.status}; only active claims can be submitted`,
    };
  }

  // Service-role for storage + claim_attachments (no user-facing
  // INSERT policies on either).
  const admin = createAdminClient();
  const uploadedPaths: string[] = [];
  const attachmentRows: {
    claim_id: string;
    storage_path: string;
    filename: string;
    mime_type: string;
    file_size: number;
  }[] = [];

  try {
    for (const file of files) {
      // Sanitise the filename for the path; keep the original on the
      // attachment row so the UI can render it untouched.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${claim.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await admin.storage
        .from(SUBMISSIONS_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upErr) {
        throw new Error(
          `Upload failed for ${file.name}: ${upErr.message}`
        );
      }
      uploadedPaths.push(path);
      attachmentRows.push({
        claim_id: claim.id,
        storage_path: path,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
    }

    if (attachmentRows.length > 0) {
      const { error: attErr } = await admin
        .from("claim_attachments")
        .insert(attachmentRows);
      if (attErr) {
        throw new Error(
          `Attachment record save failed: ${attErr.message}`
        );
      }
    }

    // Claim row update: standard client so RLS provides the same
    // safety net as the existing inline submission flow in
    // brief-detail-client.tsx.
    const { error: updErr } = await supabase
      .from("claims")
      .update({
        status: "submitted",
        submission_url: submissionUrl,
        submission_notes: submissionNotes,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", claim.id);
    if (updErr) {
      throw new Error(`Submit failed: ${updErr.message}`);
    }
  } catch (err) {
    if (uploadedPaths.length > 0) {
      await admin.storage.from(SUBMISSIONS_BUCKET).remove(uploadedPaths);
    }
    if (attachmentRows.length > 0) {
      await admin
        .from("claim_attachments")
        .delete()
        .in(
          "storage_path",
          attachmentRows.map((r) => r.storage_path)
        );
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  revalidatePath(`/briefs/${claim.brief_id}`);
  revalidatePath("/my-briefs");
  return { ok: true };
}
