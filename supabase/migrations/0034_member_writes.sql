-- Broaden RLS so org members (alongside admins) can do day-to-day work.
--
-- After 0032/0033 introduced the dual creator/org account model and the
-- 'admin' / 'member' org roles, the write policies on briefs, claims,
-- and the read policy on profiles + org_applications were still gated
-- by `is_org_admin()`. That made the 'member' role aspirational at the
-- database layer: members could open /admin/* (UI), but every mutation
-- silently 401'd at RLS.
--
-- This migration broadens the right policies to `is_org_member()` so a
-- member can:
--   * read teammate profile names/emails (needed to render briefs,
--     claims, and submission UIs by author/creator)
--   * create / edit / archive briefs in their org, and see briefs in
--     any state (incl. drafts)
--   * see all claims in the org, and approve/reject/extend them
--     (admin-style claim updates)
--   * view the /admin/applications inbox (read-only — approving or
--     rejecting an application stays admin-only)
--
-- Surfaces deliberately left admin-only:
--   * payments (release of funds)             — admin-gated USING/WITH CHECK
--   * org_applications INSERT / UPDATE        — approve / reject
--   * organizations UPDATE                    — branding / contact / legal
--   * invite_codes ALL                        — roster + team invites
--   * memberships ALL                         — promote / demote
--   * pricing_*, org_subscriptions write paths — platform-admin
--
-- The policy *names* shift from "Admins …" to "Org members …" where the
-- gate now uses `is_org_member()`. Existing policy names are dropped
-- explicitly so re-running the migration is idempotent.

-- ============================================================
-- Profiles: teammate read
-- ============================================================
DROP POLICY IF EXISTS "Admins can read org member profiles" ON profiles;
DROP POLICY IF EXISTS "Org members can read teammate profiles" ON profiles;

CREATE POLICY "Org members can read teammate profiles"
  ON profiles FOR SELECT
  USING (
    is_org_member(active_org_id())
    AND EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.user_id = profiles.id
        AND memberships.org_id = active_org_id()
        AND memberships.status = 'active'
    )
  );

-- ============================================================
-- Briefs: see all states + manage
-- ============================================================
-- The existing SELECT policy lets non-members see open briefs in their
-- active org or briefs they've claimed. Admins additionally saw briefs
-- in any state. Broaden the "any state" gate to is_org_member so
-- members see drafts, archived, and closed briefs as well.
DROP POLICY IF EXISTS "Members see briefs in their org" ON briefs;
CREATE POLICY "Members see briefs in their org"
  ON briefs FOR SELECT
  USING (
    org_id = active_org_id()
    AND (
      status = 'open'
      OR user_has_claimed(id)
      OR is_org_member(org_id)
    )
  );

DROP POLICY IF EXISTS "Admins manage briefs in their org" ON briefs;
DROP POLICY IF EXISTS "Org members manage briefs in their org" ON briefs;

CREATE POLICY "Org members manage briefs in their org"
  ON briefs FOR ALL
  USING (org_id = active_org_id() AND is_org_member(org_id))
  WITH CHECK (org_id = active_org_id() AND is_org_member(org_id));

-- ============================================================
-- Claims: see all in org + admin-style updates
-- ============================================================
-- "Users view own claims in org" let creators see their own row plus
-- gave admins visibility into all claims. Broaden so members see all
-- claims too (they triage submissions, extend deadlines, etc.).
DROP POLICY IF EXISTS "Users view own claims in org" ON claims;
DROP POLICY IF EXISTS "Users view claims in org" ON claims;

CREATE POLICY "Users view claims in org"
  ON claims FOR SELECT
  USING (
    org_id = active_org_id()
    AND (user_id = auth.uid() OR is_org_member(org_id))
  );

-- Note: "Users update own claims" (creator self-update — submission
-- write-up etc.) stays as-is. We only broaden the org-side admin
-- update policy.
DROP POLICY IF EXISTS "Admins update claims in org" ON claims;
DROP POLICY IF EXISTS "Org members update claims in org" ON claims;

CREATE POLICY "Org members update claims in org"
  ON claims FOR UPDATE
  USING (org_id = active_org_id() AND is_org_member(org_id))
  WITH CHECK (org_id = active_org_id() AND is_org_member(org_id));

-- ============================================================
-- Org applications: read-only inbox visibility for members
-- ============================================================
-- Members can SEE pending applications from creators discovering the
-- org. Approve / reject (UPDATE) stays gated to admins via the
-- existing "Admins can update org applications" policy from 0022.
DROP POLICY IF EXISTS "Admins can view org applications" ON org_applications;
DROP POLICY IF EXISTS "Org members can view applications" ON org_applications;

CREATE POLICY "Org members can view applications"
  ON org_applications FOR SELECT
  USING (is_org_member(org_id));

-- ============================================================
-- Sanity: no-op DDL for tables intentionally NOT broadened.
-- Listed here as comments so future readers know the omission was
-- considered, not forgotten.
-- ============================================================
--   payments               — admin-only writes; financial release
--   organizations          — admin-only UPDATE; branding/legal
--   invite_codes           — admin-only writes; team & creator invites
--   memberships            — admin-only ALL; promote / demote
--   pricing_*              — platform-admin
--   org_subscriptions      — platform-admin write
