-- Fix infinite-recursion in memberships and organizations RLS policies.
--
-- Background:
-- Migration 0015 defined the original memberships and organizations
-- policies as inline EXISTS subqueries over `memberships`. Every time
-- Postgres evaluates such a policy on `memberships`, the inner SELECT
-- itself goes through `memberships` RLS again, triggering the same
-- policy. As long as the table was empty (no rows could match), the
-- planner short-circuited and nothing failed. With the first real
-- membership row, the recursion had to actually resolve and Postgres
-- raised:
--
--   ERROR 42P17: infinite recursion detected in policy for relation
--   "memberships"
--
-- Migration 0017 introduced SECURITY DEFINER helpers `is_org_member()`
-- and `is_org_admin()` that bypass RLS on the inner SELECT, so they
-- can be used safely from inside another policy. We rewrite the four
-- offending policies in terms of those helpers.

-- ============================================================
-- Memberships policies
-- ============================================================
DROP POLICY IF EXISTS "Members can read org memberships" ON memberships;
DROP POLICY IF EXISTS "Admins can manage org memberships" ON memberships;

CREATE POLICY "Members can read org memberships"
  ON memberships FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can manage org memberships"
  ON memberships FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================
-- Organizations policies
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read orgs they belong to" ON organizations;
DROP POLICY IF EXISTS "Admins can update their org" ON organizations;

CREATE POLICY "Members read their orgs"
  ON organizations FOR SELECT
  USING (is_org_member(id));

CREATE POLICY "Admins update their org"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- /discover lists discoverable orgs to anyone (incl. anonymous).
-- Keep that surface independent of membership.
DROP POLICY IF EXISTS "Anyone can read discoverable orgs" ON organizations;
CREATE POLICY "Anyone can read discoverable orgs"
  ON organizations FOR SELECT
  USING (discoverable = TRUE);
