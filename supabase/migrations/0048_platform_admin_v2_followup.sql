-- Platform admin v2 follow-ups (review feedback on 0046).
--
-- Two operational hardenings:
--
--   1. CHECK constraint on profiles so support_org_id can only be set
--      on platform accounts. Today the helpers (`is_org_admin`,
--      `is_org_member`, `active_org_id`, `getActiveOrg`) all gate on
--      `account_type = 'platform'` before honoring support_org_id, so
--      a stale value on a non-platform account is benign. The CHECK
--      removes a class of future foot-guns where a different code
--      path forgets that gate.
--
--   2. Cleanup pass for any user who is `account_type='platform'` AND
--      still has memberships from before 0046 landed. The membership
--      trigger (`enforce_membership_role_matches_account_type`) blocks
--      INSERTs and UPDATEs but only fires per-row, so existing rows
--      survive. Without this pass, `is_org_admin()` could return TRUE
--      via the membership branch and skip the support-mode audit
--      path entirely.
--
-- Idempotent: safe to re-run.

-- ============================================================
-- 1. CHECK constraint: support_org_id only on platform accounts
-- ============================================================

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_support_org_only_for_platform;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_support_org_only_for_platform
    CHECK (account_type = 'platform' OR support_org_id IS NULL);

-- ============================================================
-- 2. Cleanup pass: drop memberships and active_org_id for platform
--    accounts. Logs how many rows it touched via NOTICE so the
--    operator running the migration sees the cleanup count.
-- ============================================================

DO $$
DECLARE
  v_membership_count INT;
  v_active_org_count INT;
BEGIN
  WITH deleted AS (
    DELETE FROM memberships
    WHERE user_id IN (
      SELECT id FROM profiles WHERE account_type = 'platform'
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_membership_count FROM deleted;

  WITH cleared AS (
    UPDATE profiles
       SET active_org_id = NULL
     WHERE account_type = 'platform'
       AND active_org_id IS NOT NULL
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_active_org_count FROM cleared;

  RAISE NOTICE 'platform_admin_v2_followup: dropped % membership row(s), cleared active_org_id on % profile(s)',
    v_membership_count, v_active_org_count;
END$$;

-- ============================================================
-- 3. Re-assert SECURITY DEFINER ownership on the helpers rewritten
--    in 0046. CREATE OR REPLACE preserves prior ownership, so this
--    is a no-op on a clean install (originals were created by
--    postgres). Kept here as belt-and-suspenders, matching the 0033
--    precedent for use_invite_code().
-- ============================================================

ALTER FUNCTION active_org_id() OWNER TO postgres;
ALTER FUNCTION is_org_admin(UUID) OWNER TO postgres;
ALTER FUNCTION is_org_member(UUID) OWNER TO postgres;
ALTER FUNCTION is_platform_admin() OWNER TO postgres;
