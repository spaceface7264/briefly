-- Creator socials + onboarding flag
--
-- Two related schema changes that prep for the first-time creator
-- onboarding flow:
--
-- 1. Replace the single `profiles.instagram_handle` column with a
--    flexible `social_handles jsonb` map keyed by platform slug.
--    Supported slugs (enforced in the app layer, not the DB):
--      instagram, tiktok, youtube, x, threads, pinterest, twitch,
--      linkedin, substack, website
--    Same pattern as `profiles.skills` (free-form column, controlled
--    vocabulary in src/lib/creator-profile.ts) so we can add platforms
--    without a migration each time.
--
-- 2. Add `profiles.onboarded_at` so the (creator) layout can detect
--    first-time users and redirect them to /onboarding before they
--    land on /briefs or /discover. Existing creators are backfilled
--    to NOW() so they skip onboarding.

-- ============================================================
-- 1. social_handles
-- ============================================================
-- JSONB rather than per-platform columns:
--   - Adding/removing a platform is a code change, not a migration.
--   - Avoids N nullable columns that are almost always empty.
--   - Matches how `profiles.skills` defers the allow-list to app code.
--
-- CHECK constraints can't run subqueries, so per-key validation lives
-- in src/lib/creator-profile.ts. The DB guarantees only:
--   - the value is a JSON object (not an array or scalar)
--   - the total serialized size stays sane (defence against blob writes)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_handles JSONB
  NOT NULL DEFAULT '{}'::jsonb
  CHECK (
    jsonb_typeof(social_handles) = 'object'
    AND length(social_handles::text) <= 2000
  );

-- Backfill any existing Instagram handles into the new map. Skips
-- rows where the handle is null/empty so we don't store empty
-- strings.
UPDATE profiles
SET social_handles = social_handles || jsonb_build_object('instagram', instagram_handle)
WHERE instagram_handle IS NOT NULL
  AND length(trim(instagram_handle)) > 0
  AND NOT (social_handles ? 'instagram');

-- Drop the legacy column. The app reads/writes through
-- `social_handles->>'instagram'` from this point on; bare-handle
-- helpers (URL building, normalisation) live in src/lib/socials.ts
-- and apply to every platform, not just Instagram.
ALTER TABLE profiles DROP COLUMN IF EXISTS instagram_handle;

-- ============================================================
-- 2. onboarded_at
-- ============================================================
-- NULL means "hasn't finished the first-time interview." The
-- (creator) layout will redirect those users to /onboarding before
-- /briefs or /discover. Setting the timestamp (instead of a bool)
-- preserves when the user completed it, which is handy for
-- analytics and for re-prompting if we add more onboarding steps
-- later.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Backfill: anyone who already exists shouldn't be force-marched
-- through onboarding. Stamp them as onboarded at their profile
-- creation time. New signups have onboarded_at = NULL by default
-- and get caught by the redirect.
UPDATE profiles
SET onboarded_at = COALESCE(updated_at, created_at, NOW())
WHERE onboarded_at IS NULL;

-- RLS: no policy changes needed. Both columns inherit the existing
-- `profiles` policies (self read/write from 0017, org-teammate read
-- from 0034).
