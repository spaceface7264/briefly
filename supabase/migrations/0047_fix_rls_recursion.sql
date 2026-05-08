-- Fix infinite recursion re-introduced by 0046.
--
-- 0030 fixed the original recursion by routing memberships /
-- organizations SELECT through is_org_member() / is_org_admin()
-- (SECURITY DEFINER, they bypass RLS on the inner query). 0046
-- added platform-admin bypass clauses but inlined a fresh
-- `EXISTS (SELECT 1 FROM memberships ...)` in those same SELECT
-- policies, which sends Postgres back through memberships RLS →
-- recursion.
--
-- Symptom in prod: anonymous reads of organizations and any read of
-- profiles that transitively touched memberships failed with
-- 42P17. The login form's getAccountType returned null, falling
-- through to /briefs (creator shell).
--
-- Fix: use the existing helpers in the SELECT policies on
-- memberships and organizations. The profiles policy from 0046 is
-- left intact, its inner EXISTS hits memberships, but with the
-- memberships SELECT policy now resolving via is_org_member() it no
-- longer recurses.

-- ============================================================
-- Memberships SELECT
-- ============================================================
DROP POLICY IF EXISTS "Members can read org memberships" ON memberships;
CREATE POLICY "Members can read org memberships"
  ON memberships FOR SELECT
  USING (
    is_platform_admin()
    OR is_org_member(org_id)
  );

-- ============================================================
-- Organizations SELECT
-- ============================================================
DROP POLICY IF EXISTS "Members read their orgs" ON organizations;
CREATE POLICY "Members read their orgs"
  ON organizations FOR SELECT
  USING (
    is_platform_admin()
    OR is_org_member(id)
  );

-- "Anyone can read discoverable orgs" (from 0030) is left alone, it's
-- the OR-clause that lets /discover work for unauthenticated visitors.
