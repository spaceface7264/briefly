-- Org lifecycle: suspend, restore, archive.
--
-- Adds a status column on organizations + audit-friendly metadata
-- columns so a platform admin has a real "stop this org" lever.
-- Application-layer enforcement (requireOrgAdmin) blocks writes
-- when status != 'active' for org-admin actors; platform admins in
-- support mode can still write so they can unstuck whatever caused
-- the suspension.
--
-- Three states:
--   * active    , default, normal operation
--   * suspended , temporary, reversible. Billing problem, ToS
--                 investigation, etc.
--   * archived  , effectively gone. Don't show in /discover, no
--                 one can write. Reversible by setting back to
--                 'active' if the situation changes.
--
-- DB-level write blocking via RLS policy rewrites is deferred. The
-- app-layer gate covers every requireOrgAdmin path (billing,
-- settings, brand, invites). Member-level writes through the
-- existing is_org_member RLS policies (claims by creators, etc.)
-- are NOT blocked by this migration; that's a known gap captured
-- in the PR description.

-- ============================================================
-- 1. Schema
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'archived'));

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Partial index for the status pill on /admin/super/orgs and any
-- "show non-active orgs" query. Active is the common case so the
-- index only carries the rare rows.
CREATE INDEX IF NOT EXISTS idx_organizations_status
  ON organizations(status) WHERE status != 'active';

-- ============================================================
-- 2. Discoverable hardening: archived orgs never show on /discover
-- ============================================================
--
-- The "Anyone can read discoverable orgs" policy from 0030 only
-- checks discoverable=true. Archived orgs may still have
-- discoverable=true from before they were archived; we don't want
-- them surfaced to logged-out visitors. Tighten the policy to
-- require status='active' as well.

DROP POLICY IF EXISTS "Anyone can read discoverable orgs" ON organizations;
CREATE POLICY "Anyone can read discoverable orgs"
  ON organizations FOR SELECT
  USING (discoverable = TRUE AND status = 'active');
