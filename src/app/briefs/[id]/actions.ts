"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SUBMISSIONS_BUCKET = "submissions";

// 50 MB while on the Supabase Free tier — the project-wide upload
// limit caps individual files there, regardless of the per-bucket
// `file_size_limit = 250 MB` set in
// 0035_submissions_storage_bucket.sql. When the project moves to Pro
// (5 GB project cap), bump this to 250 to match the bucket. Keep this
// constant in sync with MAX_FILE_BYTES in brief-detail-client.tsx so
// the client validation matches the server.
const MAX_FILE_BYTES = 50 * 1024 * 1024;
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

// Soft cap to keep one submission from accidentally creating hundreds
// of upload URLs in a single request. The bucket itself has no
// per-claim limit; this is purely a sanity guard.
const MAX_ATTACHMENTS_PER_SUBMIT = 10;

type FileSpec = {
  filename: string;
  mime_type: string;
  file_size: number;
};

type PreparedUpload = {
  storage_path: string;
  signed_url: string;
  token: string;
};

type AttachmentRecord = {
  storage_path: string;
  filename: string;
  mime_type: string;
  file_size: number;
};

type PrepareResult =
  | { ok: true; uploads: PreparedUpload[] }
  | { ok: false; error: string };

type ConfirmResult = { ok: true } | { ok: false; error: string };

type AttachmentWithUrl = {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  signed_url: string;
};

type AttachmentsResult =
  | { ok: true; attachments: AttachmentWithUrl[] }
  | { ok: false; error: string };

// 15-minute TTL for signed download URLs. Long enough for an admin to
// look at a long video; short enough that a leaked URL goes stale
// quickly. The Storage bucket from 0035 is private, so signed URLs are
// the only way to read these objects.
const SIGNED_URL_TTL_SECONDS = 15 * 60;

/**
 * Returns one short-TTL signed download URL per attachment for the
 * given claim. Used by both the creator's "see what I submitted" view
 * and the admin/member review surface.
 *
 * Permission model: the caller must be either the claim's creator OR
 * an active member (admin or member role) of the claim's org. RLS on
 * `claim_attachments` already enforces this for the metadata fetch;
 * the same check runs explicitly here so we can return a friendly
 * error instead of an empty list when permission is missing.
 */
export async function getClaimAttachmentSignedUrls(
  claimId: string
): Promise<AttachmentsResult> {
  if (!claimId) {
    return { ok: false, error: "claimId is required" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in" };
  }

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, user_id, org_id")
    .eq("id", claimId)
    .maybeSingle();
  if (claimErr) {
    return { ok: false, error: `Lookup failed: ${claimErr.message}` };
  }
  if (!claim) {
    return { ok: false, error: "Claim not found" };
  }

  const isOwner = claim.user_id === user.id;
  let isMember = false;
  if (!isOwner) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", claim.org_id)
      .eq("status", "active")
      .maybeSingle();
    isMember = Boolean(membership);
  }
  if (!isOwner && !isMember) {
    return { ok: false, error: "Not authorised to view these attachments" };
  }

  const { data: rows, error: rowsErr } = await supabase
    .from("claim_attachments")
    .select("id, storage_path, filename, mime_type, file_size, created_at")
    .eq("claim_id", claim.id)
    .order("created_at", { ascending: true });
  if (rowsErr) {
    return { ok: false, error: `Attachments lookup failed: ${rowsErr.message}` };
  }

  if (!rows || rows.length === 0) {
    return { ok: true, attachments: [] };
  }

  const admin = createAdminClient();
  const attachments: AttachmentWithUrl[] = [];
  for (const row of rows) {
    const { data: signed, error: signErr } = await admin.storage
      .from(SUBMISSIONS_BUCKET)
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed) {
      return {
        ok: false,
        error: `Could not sign URL for ${row.filename}: ${
          signErr?.message ?? "unknown error"
        }`,
      };
    }
    attachments.push({
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      file_size: row.file_size,
      created_at: row.created_at,
      signed_url: signed.signedUrl,
    });
  }

  return { ok: true, attachments };
}

/**
 * Phase 1 of a two-step submission flow.
 *
 * The server action signature here intentionally only takes file
 * metadata — never the file bytes. Files are uploaded directly from
 * the browser to Supabase Storage using the per-file signed URLs
 * returned below. This bypasses both the Next.js server-action body
 * size limit (default 1 MB) AND the Cloudflare Workers request size
 * limit (100 MB free / 500 MB paid) we'd otherwise hit on the prod
 * deploy target.
 *
 * Permission model: caller must own the claim and the claim must be in
 * `active` state. Both checks happen against the standard (RLS-bound)
 * client. Path namespacing (`{user_id}/{claim_id}/…`) is enforced
 * here so a malicious client can't ask for upload URLs targeting
 * another user's directory.
 *
 * Storage objects created via these signed URLs may end up orphaned
 * if the client never calls confirmSubmission (browser closed,
 * upload aborted). A future cleanup job should sweep
 * storage.objects under `submissions/` for paths whose claim_id has
 * no matching claim_attachments row, older than ~24 h.
 */
export async function prepareSubmissionUploads(
  claimId: string,
  files: FileSpec[]
): Promise<PrepareResult> {
  if (!claimId) {
    return { ok: false, error: "claimId is required" };
  }
  if (files.length > MAX_ATTACHMENTS_PER_SUBMIT) {
    return {
      ok: false,
      error: `Max ${MAX_ATTACHMENTS_PER_SUBMIT} files per submission`,
    };
  }
  for (const file of files) {
    if (file.file_size <= 0 || file.file_size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `${file.filename} exceeds the 50 MB limit`,
      };
    }
    if (!ALLOWED_MIME_TYPES.has(file.mime_type)) {
      return {
        ok: false,
        error: `${file.filename}: file type "${file.mime_type}" is not allowed`,
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in" };
  }

  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, user_id, status")
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
  if (claim.status !== "active" && claim.status !== "revision_requested") {
    return {
      ok: false,
      error: `Claim is ${claim.status}; only active or revision_requested claims can be submitted`,
    };
  }

  if (files.length === 0) {
    return { ok: true, uploads: [] };
  }

  const admin = createAdminClient();
  const uploads: PreparedUpload[] = [];
  for (const file of files) {
    const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${claim.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeName}`;
    const { data, error: signErr } = await admin.storage
      .from(SUBMISSIONS_BUCKET)
      .createSignedUploadUrl(path);
    if (signErr || !data) {
      return {
        ok: false,
        error: `Could not prepare upload for ${file.filename}: ${
          signErr?.message ?? "unknown error"
        }`,
      };
    }
    uploads.push({
      storage_path: path,
      signed_url: data.signedUrl,
      token: data.token,
    });
  }

  return { ok: true, uploads };
}

/**
 * Phase 2 of the two-step submission flow.
 *
 * Called after the client has uploaded every file to its signed URL.
 * Records the attachment rows and flips the claim status to
 * `submitted`. The Postgres trigger from migration 0018 fires the
 * `claim_submitted` notification automatically when the status flips.
 *
 * Validation:
 *   * Re-checks ownership + active state (the prepare action could
 *     have been called minutes ago; state may have changed).
 *   * Re-checks per-file MIME and size against the same allowlist.
 *   * Verifies every attachment's storage_path starts with
 *     `{user_id}/{claim_id}/`. This is the security check that
 *     prevents a malicious client from claiming any storage path it
 *     wants — even if it had a stale signed URL for a sibling
 *     directory, the prepare action enforces the same prefix, so
 *     the client never receives a URL outside its namespace.
 *
 * No rollback on partial failure. If the attachment insert succeeds
 * but the claim update fails, attachments are orphaned and need
 * manual cleanup (or the future sweep job mentioned in
 * prepareSubmissionUploads).
 */
export async function confirmSubmission(
  claimId: string,
  submissionUrl: string | null,
  submissionNotes: string | null,
  attachments: AttachmentRecord[]
): Promise<ConfirmResult> {
  if (!claimId) {
    return { ok: false, error: "claimId is required" };
  }
  const trimmedUrl = submissionUrl?.trim() || null;
  const trimmedNotes = submissionNotes?.trim() || null;
  if (!trimmedUrl && attachments.length === 0) {
    return {
      ok: false,
      error: "Provide either a submission URL or at least one file",
    };
  }
  if (attachments.length > MAX_ATTACHMENTS_PER_SUBMIT) {
    return {
      ok: false,
      error: `Max ${MAX_ATTACHMENTS_PER_SUBMIT} files per submission`,
    };
  }
  for (const a of attachments) {
    if (a.file_size <= 0 || a.file_size > MAX_FILE_BYTES) {
      return {
        ok: false,
        error: `${a.filename} exceeds the 50 MB limit`,
      };
    }
    if (!ALLOWED_MIME_TYPES.has(a.mime_type)) {
      return {
        ok: false,
        error: `${a.filename}: file type "${a.mime_type}" is not allowed`,
      };
    }
  }

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
  if (claim.status !== "active" && claim.status !== "revision_requested") {
    return {
      ok: false,
      error: `Claim is ${claim.status}; only active or revision_requested claims can be submitted`,
    };
  }

  // Path-namespace guard: every attachment's storage path must live
  // under this user + claim. Cheap defence against a malicious client
  // claiming someone else's path.
  const expectedPrefix = `${user.id}/${claim.id}/`;
  for (const a of attachments) {
    if (!a.storage_path.startsWith(expectedPrefix)) {
      return {
        ok: false,
        error: `Attachment path ${a.storage_path} is not in your claim's namespace`,
      };
    }
  }

  const admin = createAdminClient();

  if (attachments.length > 0) {
    const { error: attErr } = await admin.from("claim_attachments").insert(
      attachments.map((a) => ({
        claim_id: claim.id,
        storage_path: a.storage_path,
        filename: a.filename,
        mime_type: a.mime_type,
        file_size: a.file_size,
      }))
    );
    if (attErr) {
      return {
        ok: false,
        error: `Attachment record save failed: ${attErr.message}`,
      };
    }
  }

  const { error: updErr } = await supabase
    .from("claims")
    .update({
      status: "submitted",
      submission_url: trimmedUrl,
      submission_notes: trimmedNotes,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", claim.id);
  if (updErr) {
    return { ok: false, error: `Submit failed: ${updErr.message}` };
  }

  revalidatePath(`/briefs/${claim.brief_id}`);
  revalidatePath("/my-briefs");
  return { ok: true };
}
