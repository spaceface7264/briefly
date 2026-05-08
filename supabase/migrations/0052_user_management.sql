-- User management: disable / enable individual users from the
-- platform admin shell.
--
-- v1 scope is "flag, not hard ban". The platform admin can mark a
-- user as disabled with a reason, the flag is visible on the user
-- detail page and surfaces in the audit log, but the existing org-
-- admin and creator gates are NOT updated to refuse disabled users.
-- That tightening is a follow-up; doing it now would require
-- touching every requireOrgAdmin / requireCreatorAccount call site
-- and every RLS policy that gates on auth.uid(), which is more
-- surface than this migration wants to own.
--
-- The columns are intentionally simple:
--   * disabled_at NULL means active; non-NULL means disabled
--   * disabled_reason carries the operator note shown on the
--     detail page and in the platform_audit_log row's reason field
--
-- Both columns are NULL by default and don't need a backfill.

-- ============================================================
-- 1. Schema
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

-- Disabled rows are rare (the common case is active users), so the
-- index only carries the small subset. Used by the user list page
-- when filtering / sorting disabled users to the top.
CREATE INDEX IF NOT EXISTS idx_profiles_disabled
  ON profiles(disabled_at) WHERE disabled_at IS NOT NULL;
