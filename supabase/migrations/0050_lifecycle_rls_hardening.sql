-- Close the member-write gap from 0049.
--
-- 0049 gates org-admin writes (anything routed through
-- requireOrgAdmin in app code) when status != 'active', but the
-- following RLS policies still let lower-privileged actors write
-- on suspended / archived orgs:
--
--   * briefs    , members can edit / archive briefs in their org
--   * claims    , members can transition claims in their org
--   * claims    , creators can create new claims in their org
--
-- These don't go through requireOrgAdmin so the app-layer gate
-- doesn't catch them. Add an RLS helper + status check on the
-- WITH CHECK / USING clauses of those three policies. Platform
-- admins in support mode keep the ability to write so they can
-- unstuck a suspended org from inside.

-- ============================================================
-- 1. Helper: is the org writable for the current actor?
-- ============================================================
--
-- Returns TRUE when:
--   * The org is 'active' (everyone with the right role can write), or
--   * The caller is a platform admin scoped into this exact org via
--     support mode (they can write to suspended/archived orgs to fix
--     things)

CREATE OR REPLACE FUNCTION is_org_active_for_writes(p_org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_support_org UUID;
BEGIN
  SELECT status INTO v_status FROM organizations WHERE id = p_org_id;
  IF v_status = 'active' THEN
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

ALTER FUNCTION is_org_active_for_writes(UUID) OWNER TO postgres;

-- ============================================================
-- 2. briefs: gate the member-write FOR ALL policy
-- ============================================================
--
-- The FOR SELECT "Members see briefs in their org" policy from
-- 0046 stays untouched, so reads continue to work for everyone,
-- including on suspended orgs. The FOR ALL policy gates writes
-- via USING (UPDATE/DELETE filtering) and WITH CHECK (INSERT and
-- post-update validation).

DROP POLICY IF EXISTS "Org members manage briefs in their org" ON briefs;
CREATE POLICY "Org members manage briefs in their org"
  ON briefs FOR ALL
  USING (
    org_id = active_org_id()
    AND is_org_member(org_id)
    AND is_org_active_for_writes(org_id)
  )
  WITH CHECK (
    org_id = active_org_id()
    AND is_org_member(org_id)
    AND is_org_active_for_writes(org_id)
  );

-- ============================================================
-- 3. claims: member updates require an active org
-- ============================================================

DROP POLICY IF EXISTS "Org members update claims in org" ON claims;
CREATE POLICY "Org members update claims in org"
  ON claims FOR UPDATE
  USING (
    org_id = active_org_id()
    AND is_org_member(org_id)
    AND is_org_active_for_writes(org_id)
  )
  WITH CHECK (
    org_id = active_org_id()
    AND is_org_member(org_id)
    AND is_org_active_for_writes(org_id)
  );

-- ============================================================
-- 4. claims: creators can't open new claims on a suspended org
-- ============================================================

DROP POLICY IF EXISTS "Creator users create claims in org" ON claims;
CREATE POLICY "Creator users create claims in org"
  ON claims FOR INSERT
  WITH CHECK (
    org_id = active_org_id()
    AND user_id = auth.uid()
    AND current_account_type() = 'creator'
    AND is_org_active_for_writes(org_id)
    AND NOT user_has_claimed(brief_id)
    AND user_not_in_reclaim_cooldown(brief_id)
    AND get_active_claim_count(brief_id) < (SELECT claim_limit FROM briefs WHERE id = brief_id)
    AND (SELECT status FROM briefs WHERE id = brief_id) = 'open'
  );

-- ============================================================
-- 5. Defense in depth on the admin-managed write paths
-- ============================================================
--
-- requireOrgAdmin already gates these app-side, but layering the
-- DB check matches the "fail closed even if app code drifts" rule
-- the rest of the policies follow. Touches: payments, invite_codes,
-- memberships, organizations (UPDATE), brand_kits.

DROP POLICY IF EXISTS "Admins manage payments in org" ON payments;
CREATE POLICY "Admins manage payments in org"
  ON payments FOR ALL
  USING (
    org_id = active_org_id()
    AND is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  )
  WITH CHECK (
    is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  );

DROP POLICY IF EXISTS "Admins create invite codes in org" ON invite_codes;
CREATE POLICY "Admins create invite codes in org"
  ON invite_codes FOR INSERT
  WITH CHECK (
    org_id = active_org_id()
    AND is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  );

DROP POLICY IF EXISTS "Admins update invite codes in org" ON invite_codes;
CREATE POLICY "Admins update invite codes in org"
  ON invite_codes FOR UPDATE
  USING (
    org_id = active_org_id()
    AND is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  );

DROP POLICY IF EXISTS "Admins delete invite codes in org" ON invite_codes;
CREATE POLICY "Admins delete invite codes in org"
  ON invite_codes FOR DELETE
  USING (
    org_id = active_org_id()
    AND is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  );

DROP POLICY IF EXISTS "Admins can manage org memberships" ON memberships;
CREATE POLICY "Admins can manage org memberships"
  ON memberships FOR ALL
  USING (
    is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  )
  WITH CHECK (
    is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  );

DROP POLICY IF EXISTS "Admins update their org" ON organizations;
CREATE POLICY "Admins update their org"
  ON organizations FOR UPDATE
  USING (
    is_org_admin(id)
    AND is_org_active_for_writes(id)
  )
  WITH CHECK (
    is_org_admin(id)
    AND is_org_active_for_writes(id)
  );

DROP POLICY IF EXISTS "Org admins write brand_kits" ON brand_kits;
CREATE POLICY "Org admins write brand_kits"
  ON brand_kits FOR ALL
  USING (
    is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  )
  WITH CHECK (
    is_org_admin(org_id)
    AND is_org_active_for_writes(org_id)
  );
