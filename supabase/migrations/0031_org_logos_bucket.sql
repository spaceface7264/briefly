-- Storage bucket for org-uploaded logos.
--
-- Logos are public (they show up on /discover, in emails, on hotlinked
-- avatars), so the bucket is marked public. Writes go through the
-- service-role client behind the `uploadOrgLogo` server action — that
-- action enforces org-admin access before uploading. We therefore don't
-- create any user-facing INSERT/UPDATE/DELETE policies on
-- storage.objects for this bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  TRUE,
  2 * 1024 * 1024, -- 2 MB cap; logos shouldn't be heavier than that
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Make sure SELECT is unambiguously allowed for the bucket. The
-- `public = TRUE` flag on the bucket itself does the work, but we add
-- the explicit policy too in case someone later flips RLS toggles.
DROP POLICY IF EXISTS "Anyone can read org logos" ON storage.objects;
CREATE POLICY "Anyone can read org logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');
