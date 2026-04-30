-- Storage bucket for creator submissions (Phase 0.1 of the post-
-- genericization roadmap; see TODO.md §9 → Phase 0).
--
-- Access model (intentionally identical to the org-logos pattern in
-- 0031): the bucket is private, and there are NO user-facing RLS
-- policies on storage.objects for this bucket. Every read and write
-- goes through a server action that holds the service-role client and
-- enforces the right permission check first:
--
--   * Upload    — Phase 0.2 server action checks the caller owns the
--                 claim before writing under {user_id}/{claim_id}/…
--   * Download  — Phase 0.2/0.3 server action checks the caller is
--                 either the claim's creator OR an admin of the brief's
--                 org, then issues a short-TTL signed URL via
--                 supabase.storage.from('submissions').createSignedUrl()
--
-- Encoding the admin-can-read rule as a storage RLS policy would mean
-- joining storage.objects → claims → briefs → memberships inside the
-- USING clause, which is hard to audit and slow at the storage layer.
-- Doing it in the server action keeps permission logic in one place
-- (TS/SQL it audits cleanly) and matches the existing org-logos
-- pattern.
--
-- Path convention (enforced by the server action, not the bucket):
--   submissions/{user_id}/{claim_id}/{filename}
--
-- The path layout matters because:
--   * It groups every attachment for a claim under one prefix, so a
--     future "delete all attachments for cancelled claim" job is one
--     `storage.objects` LIKE-prefix delete.
--   * It namespaces by user, so a malicious server action bug that
--     forgot the claim check still couldn't write into another user's
--     directory if path-derivation were ever moved client-side.
--
-- Limits:
--   * 250 MB per file — comfortable for short-form vertical video
--     (1080p H.264 at typical bitrates), tight for raw 4K. If creators
--     start hitting the cap, decide between bumping to 500 MB or
--     adding a transcode layer (Mux / Cloudflare Stream — see open
--     question in TODO.md Phase 0.1).
--   * MIME types limited to the formats creators actually deliver:
--     mp4 / mov / webm for video, jpg / png / webp / heic / heif for
--     image (heic + heif because iPhone defaults to HEIC), pdf for
--     written content.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions',
  'submissions',
  FALSE,
  250 * 1024 * 1024, -- 250 MB
  ARRAY[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
