-- Creator Profile MVP, Phase 1: schema and storage.
--
-- Adds creator-identity fields to `profiles` so org admins can
-- recognise who they're working with on /admin/creators, claim
-- approvals, and submission reviews. Editable by the creator at
-- /profile/settings.
--
-- These are MVP fields. The broader §9 Phase 4.3 spec (public
-- /c/[handle], portfolio showcase, slug system) is intentionally
-- out of scope here. When that lands, the only schema change
-- needed will be a `slug` column + uniqueness constraint; the
-- identity fields below already cover what 4.3 wants on display.

-- ============================================================
-- profiles columns
-- ============================================================

-- avatar_url: stable public URL into the `avatars` bucket below.
-- Stored on the row (not minted on read) so list views stay cheap
-- and browser caching works. Worst-case "URL works forever once
-- shared" is the accepted trade-off for an avatar asset class
-- (mirrors org-logos at 0031).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Short creator bio. 500-char cap matches comparable creator-bio
-- length on Upwork / Patreon / Behance — long enough for a useful
-- intro, short enough that it doesn't crowd admin list rows.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT
  CHECK (bio IS NULL OR char_length(bio) <= 500);

-- Languages the creator works in. ISO-639-1 codes (e.g. 'en',
-- 'da'). 8-element cap avoids badge-row bloat. Empty array is the
-- default rather than NULL so Postgres array operators don't have
-- to special-case the unset state.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages TEXT[]
  NOT NULL DEFAULT '{}'::text[]
  CHECK (cardinality(languages) <= 8);

-- Skill taxonomy. Free-form storage; the application layer
-- (`src/lib/creator-profile.ts`) enforces a controlled vocabulary
-- so admin filtering and chip rendering stays consistent. 12-
-- element cap.
--
-- Note: `profiles.tags` from 0001_init.sql stays as-is (free-form,
-- never displayed). We did not migrate it to `skills` to avoid a
-- destructive data move; new code reads only `skills`. If `tags`
-- proves unused after a few months we can drop it in a later
-- migration.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills TEXT[]
  NOT NULL DEFAULT '{}'::text[]
  CHECK (cardinality(skills) <= 12);

-- profiles.country (added in 0007_vat_invoicing.sql for billing)
-- is reused as the display country. No new column needed.

-- RLS: no changes. The new columns inherit existing `profiles`
-- policies — self read/write (0017_org_scoped_rls.sql) and
-- org-teammate read (0034_member_writes.sql) — which is exactly
-- the visibility we want for the internal MVP.

-- ============================================================
-- Storage bucket: avatars
-- ============================================================
-- Public bucket (same shape as `org-logos` 0031). Avatars are
-- meant to be seen — admin lists, claim cards, future
-- transactional emails. Reads stream straight from the CDN with
-- no per-render signing layer. Worst case is a leaked URL renders
-- forever; same trade-off Slack / Linear / GitHub make for the
-- avatar asset class.
--
-- Path convention (enforced by the server action, not the bucket):
--   avatars/{random_uuid}.{ext}
-- The path deliberately does NOT include user_id, so the URL alone
-- doesn't leak the auth UUID. The mapping lives only on
-- `profiles.avatar_url`.
--
-- MIME allow-list excludes SVG: avatar contexts render inline at
-- multiple sizes, and SVG with embedded <script> is a known XSS
-- vector even via <img>. PNG / JPEG / WebP cover the creator-
-- photo use case without that surface.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2 * 1024 * 1024,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Belt-and-braces SELECT policy. The `public = TRUE` flag on the
-- bucket itself already permits anonymous reads, but the explicit
-- policy survives someone toggling RLS on `storage.objects`
-- without realising the bucket flag isn't enough on its own.
-- Mirrors the same pattern on org-logos (0031).
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
CREATE POLICY "Anyone can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
