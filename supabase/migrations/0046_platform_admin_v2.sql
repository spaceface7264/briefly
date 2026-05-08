-- Platform admin v2: split platform admin from org admin.
--
-- Today a "platform admin" is a flag (profiles.is_platform_admin)
-- bolted on top of any account. To support production we want a real
-- third identity:
--   * account_type = 'platform' — no org membership, no creator inbox
--   * still flagged is_platform_admin = TRUE so existing pricing
--     code keeps working
--   * given a "support mode" — can scope into any org and operate as
--     that org's admin without being a member
--
-- Three reads-cross-orgs design choices worth flagging:
--
--   1. is_org_admin(p_org_id) is widened to ALSO return TRUE when the
--      caller is a platform admin and that org is the one they've
--      scoped into via profiles.support_org_id. This means every
--      existing RLS policy that gates on is_org_admin() automatically
--      grants support-mode writes — no per-policy rewrite required.
--
--   2. active_org_id() falls back to support_org_id for platform
--      accounts. Same trick: any policy that joins on
--      `org_id = active_org_id()` Just Works for support mode.
--
--   3. SELECT policies on org-scoped tables (briefs, claims, payments,
--      organizations, memberships, applications, brand_kits, claim
--      attachments, profiles) get OR is_platform_admin() added so
--      cross-org listing/triage doesn't need support mode. Writes
--      still require support mode (via is_org_admin path #1).
--
-- This migration is schema-and-helpers only. It does NOT migrate any
-- existing user's account_type. Convert your platform-admin user
-- manually:
--
--   UPDATE profiles SET account_type = 'platform' WHERE id = '...';
--   DELETE FROM memberships WHERE user_id = '...';
--   UPDATE profiles SET active_org_id = NULL WHERE id = '...';

-- ============================================================
-- 1. Account-type extension: allow 'platform'
-- ============================================================

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_account_type_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_account_type_check
    CHECK (account_type IN ('creator', 'org', 'platform'));

-- ============================================================
-- 2. Support-mode session column
-- ============================================================
--
-- When a platform admin "scopes into" an org for support, we set
-- support_org_id. Cleared on exit. ON DELETE SET NULL means deleting
-- the org quietly drops any active support session pointing at it.
--
-- We don't enforce "only platform accounts can have this set" at the
-- DB level — the server action that writes it does the check, and
-- having a stale support_org_id on a non-platform account is harmless
-- (active_org_id() ignores it for non-platform accounts).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS support_org_id UUID
    REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_support_org_id
  ON profiles(support_org_id) WHERE support_org_id IS NOT NULL;

-- ============================================================
-- 3. Helper rewrites: active_org_id, is_org_admin, is_org_member
-- ============================================================

CREATE OR REPLACE FUNCTION active_org_id()
RETURNS UUID AS $$
DECLARE
  v_account_type TEXT;
  v_active_org UUID;
  v_support_org UUID;
BEGIN
  SELECT account_type, active_org_id, support_org_id
    INTO v_account_type, v_active_org, v_support_org
    FROM profiles WHERE id = auth.uid();

  -- Platform admins in support mode borrow the support org as their
  -- active org for the duration. They have no real active_org_id.
  IF v_account_type = 'platform' AND v_support_org IS NOT NULL THEN
    RETURN v_support_org;
  END IF;

  RETURN v_active_org;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Platform admins scoped into an org count as admins there. Real
-- memberships still take precedence (and are checked first).
CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_support_org UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND role = 'admin'
      AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  IF is_platform_admin() THEN
    SELECT support_org_id INTO v_support_org
      FROM profiles WHERE id = auth.uid();
    RETURN v_support_org = p_org_id;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_support_org UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  IF is_platform_admin() THEN
    SELECT support_org_id INTO v_support_org
      FROM profiles WHERE id = auth.uid();
    RETURN v_support_org = p_org_id;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 4. Membership trigger: platform accounts hold zero memberships
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_membership_role_matches_account_type()
RETURNS TRIGGER AS $$
DECLARE
  v_acct TEXT;
  v_existing_org_count INT;
BEGIN
  SELECT account_type INTO v_acct
    FROM profiles
   WHERE id = NEW.user_id;

  IF v_acct IS NULL THEN
    RAISE EXCEPTION 'user has no profile (id=%)', NEW.user_id;
  END IF;

  IF v_acct = 'platform' THEN
    RAISE EXCEPTION
      'platform accounts cannot hold memberships';
  END IF;

  IF v_acct = 'creator' AND NEW.role <> 'creator' THEN
    RAISE EXCEPTION
      'creator accounts can only hold creator memberships (got role=%)',
      NEW.role;
  END IF;

  IF v_acct = 'org' AND NEW.role = 'creator' THEN
    RAISE EXCEPTION
      'org accounts cannot hold creator memberships';
  END IF;

  IF v_acct = 'org'
     AND (TG_OP = 'INSERT'
          OR (TG_OP = 'UPDATE' AND NEW.org_id <> OLD.org_id)) THEN
    SELECT COUNT(*) INTO v_existing_org_count
      FROM memberships
     WHERE user_id = NEW.user_id
       AND status = 'active'
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    IF v_existing_org_count > 0 THEN
      RAISE EXCEPTION
        'org accounts can only belong to one organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Cross-org SELECT bypass for platform admins
-- ============================================================
--
-- These policies let a platform admin LIST any org's data without
-- entering support mode. Writes still require support mode (the
-- write policies use is_org_admin(), which now grants in support
-- mode but only for the one targeted org).

-- briefs
DROP POLICY IF EXISTS "Members see briefs in their org" ON briefs;
CREATE POLICY "Members see briefs in their org"
  ON briefs FOR SELECT
  USING (
    is_platform_admin()
    OR (
      org_id = active_org_id()
      AND (status = 'open' OR user_has_claimed(id) OR is_org_admin(org_id))
    )
  );

-- claims
DROP POLICY IF EXISTS "Users view own claims in org" ON claims;
DROP POLICY IF EXISTS "Users view claims in org" ON claims;
CREATE POLICY "Users view claims in org"
  ON claims FOR SELECT
  USING (
    is_platform_admin()
    OR (
      org_id = active_org_id()
      AND (user_id = auth.uid() OR is_org_admin(org_id))
    )
  );

-- payments
DROP POLICY IF EXISTS "Creators view own payments in org" ON payments;
CREATE POLICY "Creators view own payments in org"
  ON payments FOR SELECT
  USING (
    is_platform_admin()
    OR (
      org_id = active_org_id()
      AND (creator_id = auth.uid() OR is_org_admin(org_id))
    )
  );

-- organizations: members can read theirs; platform admins can read all
DROP POLICY IF EXISTS "Members read their orgs" ON organizations;
DROP POLICY IF EXISTS "Members read their org" ON organizations;
DROP POLICY IF EXISTS "Members can read their org" ON organizations;
CREATE POLICY "Members read their orgs"
  ON organizations FOR SELECT
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.org_id = organizations.id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
    )
  );

-- "Anyone can read discoverable orgs" (from 0030) is left alone — it
-- already lets unauthenticated users see the discover surface.

-- memberships: members can read their org's memberships; platform
-- admins can read all
DROP POLICY IF EXISTS "Members can read org memberships" ON memberships;
CREATE POLICY "Members can read org memberships"
  ON memberships FOR SELECT
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = memberships.org_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- profiles: admins can read teammate profiles in their org; platform
-- admins can read any profile (for support).
DROP POLICY IF EXISTS "Admins can read org member profiles" ON profiles;
CREATE POLICY "Admins can read org member profiles"
  ON profiles FOR SELECT
  USING (
    is_platform_admin()
    OR (
      is_admin() AND EXISTS (
        SELECT 1 FROM memberships
        WHERE memberships.user_id = profiles.id
          AND memberships.org_id = active_org_id()
          AND memberships.status = 'active'
      )
    )
  );

-- 0034's "Org members can read teammate profiles" stays as-is; the
-- policy above is the privileged read path.

-- org_applications
DROP POLICY IF EXISTS "Users can view own applications" ON org_applications;
DROP POLICY IF EXISTS "Admins can view org applications" ON org_applications;
DROP POLICY IF EXISTS "Org members can view applications" ON org_applications;
CREATE POLICY "Users can view own applications"
  ON org_applications FOR SELECT
  USING (user_id = auth.uid() OR is_platform_admin());
CREATE POLICY "Org members can view applications"
  ON org_applications FOR SELECT
  USING (
    is_platform_admin() OR is_org_member(org_id)
  );

-- brand_kits
DROP POLICY IF EXISTS "Org members read brand_kits" ON brand_kits;
CREATE POLICY "Org members read brand_kits"
  ON brand_kits FOR SELECT
  USING (is_platform_admin() OR is_org_member(org_id));

-- claim_attachments
DROP POLICY IF EXISTS "Org members read claim attachments" ON claim_attachments;
CREATE POLICY "Org members read claim attachments"
  ON claim_attachments FOR SELECT
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM claims c
      WHERE c.id = claim_attachments.claim_id
        AND is_org_member(c.org_id)
    )
  );

-- ============================================================
-- 6. Platform audit log (generic, for support-mode writes)
-- ============================================================
--
-- pricing_audit_log (from 0027) is pricing-only. This is the catch-
-- all log for support-mode actions: who entered/exited support,
-- which org they touched, what they wrote.

CREATE TABLE IF NOT EXISTS platform_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  -- Stable verbs. Suggested namespace:
  --   support.enter, support.exit
  --   org.suspend, org.restore, org.delete
  --   user.disable, user.enable, user.reset_password
  --   brief.archive_force, brief.refund_force
  --   claim.unlock, claim.override_status
  --   billing.credit, billing.refund_force
  -- Keep the format `<domain>.<verb>` so we can group later.
  action TEXT NOT NULL,
  target_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  target_table TEXT,
  target_row_id UUID,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_actor
  ON platform_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_target_org
  ON platform_audit_log(target_org_id, created_at DESC)
  WHERE target_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_action
  ON platform_audit_log(action, created_at DESC);

ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read audit log"
  ON platform_audit_log FOR SELECT
  USING (is_platform_admin());

CREATE POLICY "Platform admins write audit log"
  ON platform_audit_log FOR INSERT
  WITH CHECK (is_platform_admin() AND actor_id = auth.uid());
