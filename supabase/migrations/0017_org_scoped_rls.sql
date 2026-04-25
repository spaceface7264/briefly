-- Org-scoped RLS rewrite
-- Replaces all global RLS policies with org-scoped versions.

-- ============================================================
-- Helper functions
-- ============================================================

-- Returns the active org_id for the currently authenticated user
CREATE OR REPLACE FUNCTION active_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT active_org_id FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Checks if the authenticated user is an admin of the given org
CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND role = 'admin'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Checks if the authenticated user is a member of the given org
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Backward-compat: is_admin() now checks admin of active org
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_org_admin(active_org_id());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- Profiles RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;

-- Users can always read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read profiles of members in their active org
CREATE POLICY "Admins can read org member profiles"
  ON profiles FOR SELECT
  USING (
    is_admin() AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = profiles.id
      AND memberships.org_id = active_org_id()
      AND memberships.status = 'active'
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- Briefs RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Creators can view open briefs or briefs they claimed" ON briefs;
DROP POLICY IF EXISTS "Creators can view open briefs or their claims" ON briefs;
DROP POLICY IF EXISTS "Creators see open briefs in their org" ON briefs;
DROP POLICY IF EXISTS "Creators can claim open briefs" ON briefs;
DROP POLICY IF EXISTS "Admins have full access to briefs" ON briefs;
DROP POLICY IF EXISTS "Admins have full access to org briefs" ON briefs;

-- Members can see open briefs in their active org, or briefs they've claimed
CREATE POLICY "Members see briefs in their org"
  ON briefs FOR SELECT
  USING (
    org_id = active_org_id()
    AND (status = 'open' OR user_has_claimed(id) OR is_org_admin(org_id))
  );

-- Admins have full access to briefs in their active org
CREATE POLICY "Admins manage briefs in their org"
  ON briefs FOR ALL
  USING (org_id = active_org_id() AND is_org_admin(org_id));

-- ============================================================
-- Claims RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own claims" ON claims;
DROP POLICY IF EXISTS "Users can create claims" ON claims;
DROP POLICY IF EXISTS "Users can update own claims" ON claims;
DROP POLICY IF EXISTS "Admins have full access to claims" ON claims;
DROP POLICY IF EXISTS "Admins can update any claim" ON claims;

-- Users can view their own claims in their active org
CREATE POLICY "Users view own claims in org"
  ON claims FOR SELECT
  USING (
    org_id = active_org_id()
    AND (user_id = auth.uid() OR is_org_admin(org_id))
  );

-- Users can create claims in their active org
CREATE POLICY "Users create claims in org"
  ON claims FOR INSERT
  WITH CHECK (
    org_id = active_org_id()
    AND user_id = auth.uid()
    AND NOT user_has_claimed(brief_id)
    AND user_not_in_reclaim_cooldown(brief_id)
    AND get_active_claim_count(brief_id) < (SELECT claim_limit FROM briefs WHERE id = brief_id)
    AND (SELECT status FROM briefs WHERE id = brief_id) = 'open'
  );

-- Users can update their own claims
CREATE POLICY "Users update own claims"
  ON claims FOR UPDATE
  USING (org_id = active_org_id() AND user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can update any claim in their org
CREATE POLICY "Admins update claims in org"
  ON claims FOR UPDATE
  USING (org_id = active_org_id() AND is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================
-- Payments RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Creators view own payments" ON payments;
DROP POLICY IF EXISTS "Admins manage payments" ON payments;

-- Creators can see their own payments in their active org
CREATE POLICY "Creators view own payments in org"
  ON payments FOR SELECT
  USING (
    org_id = active_org_id()
    AND (creator_id = auth.uid() OR is_org_admin(org_id))
  );

-- Admins can manage payments in their org
CREATE POLICY "Admins manage payments in org"
  ON payments FOR ALL
  USING (org_id = active_org_id() AND is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================
-- Invite Codes RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can check invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can create invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can update invite codes" ON invite_codes;
DROP POLICY IF EXISTS "Admins can delete invite codes" ON invite_codes;

-- Anyone can check invite codes (needed for signup validation)
CREATE POLICY "Anyone can check invite codes"
  ON invite_codes FOR SELECT
  USING (true);

-- Admins can create invite codes in their org
CREATE POLICY "Admins create invite codes in org"
  ON invite_codes FOR INSERT
  WITH CHECK (org_id = active_org_id() AND is_org_admin(org_id));

-- Admins can update invite codes in their org
CREATE POLICY "Admins update invite codes in org"
  ON invite_codes FOR UPDATE
  USING (org_id = active_org_id() AND is_org_admin(org_id));

-- Admins can delete invite codes in their org
CREATE POLICY "Admins delete invite codes in org"
  ON invite_codes FOR DELETE
  USING (org_id = active_org_id() AND is_org_admin(org_id));

-- ============================================================
-- Notifications RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notification read state" ON notifications;

-- Users can view their own notifications
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Users can update their own notification read state
CREATE POLICY "Users update own notification read state"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ============================================================
-- Notification Outbox RLS (drop + recreate)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own outbox records" ON notification_outbox;

CREATE POLICY "Users view own outbox records"
  ON notification_outbox FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.id = notification_outbox.notification_id
        AND n.recipient_id = auth.uid()
    )
  );

-- ============================================================
-- Invoice Counters RLS (unchanged — no direct access)
-- ============================================================
-- Already has "No direct access" policy. Counter is only accessed
-- via allocate_invoice_number() SECURITY DEFINER function.
