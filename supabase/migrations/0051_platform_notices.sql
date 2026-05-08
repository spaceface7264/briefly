-- Platform-wide notices (a.k.a. "system banners").
--
-- Lets a platform admin push a banner either to ALL orgs or a single
-- target org. Use cases:
--   * planned maintenance ("read-only for the next 30 minutes")
--   * ToS update
--   * billing change rolled out per-org
--   * security advisory
--
-- Notices can be dismissible (the user clicks "Dismiss" and never
-- sees it again) or forced (no dismiss button, the platform admin
-- expires them when the situation clears). Dismissals are per-user.
--
-- Two tables:
--
--   platform_notices            , the canonical notice rows
--   platform_notice_dismissals  , (notice_id, user_id) join rows that
--                                 mark a notice as dismissed for that
--                                 user. The fetcher LEFT JOINs and
--                                 filters out anything with a row.
--
-- The audience-vs-target_org_id consistency is enforced by a CHECK
-- constraint, so app code can rely on the invariant: audience='all'
-- always has target_org_id NULL, audience='one' always has it set.

-- ============================================================
-- 1. platform_notices
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  audience TEXT NOT NULL
    CHECK (audience IN ('all', 'one')),
  target_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_notices_audience_target_consistency CHECK (
    (audience = 'all' AND target_org_id IS NULL)
    OR (audience = 'one' AND target_org_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_platform_notices_audience_target
  ON platform_notices(audience, target_org_id);
CREATE INDEX IF NOT EXISTS idx_platform_notices_window
  ON platform_notices(starts_at, ends_at);

ALTER TABLE platform_notices ENABLE ROW LEVEL SECURITY;

-- SELECT: platform admins always; platform-wide notices visible to
-- everyone authenticated; per-org notices visible to that org's
-- members (is_org_member already grants platform admins in support
-- mode for the matching org, which is the right behaviour).
DROP POLICY IF EXISTS "Read platform notices" ON platform_notices;
CREATE POLICY "Read platform notices"
  ON platform_notices FOR SELECT
  USING (
    is_platform_admin()
    OR audience = 'all'
    OR (audience = 'one' AND is_org_member(target_org_id))
  );

-- ALL (INSERT/UPDATE/DELETE): platform admins only.
DROP POLICY IF EXISTS "Platform admins manage notices" ON platform_notices;
CREATE POLICY "Platform admins manage notices"
  ON platform_notices FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================
-- 2. platform_notice_dismissals
-- ============================================================
--
-- One row per (notice, user) the moment that user dismisses the
-- notice. The composite PK doubles as the lookup index for the
-- "is this dismissed for me" check the banner does on every render.

CREATE TABLE IF NOT EXISTS platform_notice_dismissals (
  notice_id UUID NOT NULL
    REFERENCES platform_notices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES profiles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notice_id, user_id)
);

ALTER TABLE platform_notice_dismissals ENABLE ROW LEVEL SECURITY;

-- SELECT: a user can read their own dismissals, platform admins read
-- everyone's (useful for support when a user reports they keep seeing
-- a notice they swear they dismissed).
DROP POLICY IF EXISTS "Read own dismissals" ON platform_notice_dismissals;
CREATE POLICY "Read own dismissals"
  ON platform_notice_dismissals FOR SELECT
  USING (user_id = auth.uid() OR is_platform_admin());

-- INSERT: a user can only dismiss for themselves. No UPDATE / DELETE
-- policies, dismissals are append-only (cascading from the notice
-- delete is the only cleanup path).
DROP POLICY IF EXISTS "Users dismiss own notices" ON platform_notice_dismissals;
CREATE POLICY "Users dismiss own notices"
  ON platform_notice_dismissals FOR INSERT
  WITH CHECK (user_id = auth.uid());
