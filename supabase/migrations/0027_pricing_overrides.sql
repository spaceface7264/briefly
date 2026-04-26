-- Phase 2 of platform monetisation: per-org and per-user pricing
-- overrides + an audit log of every grant.
--
-- Use cases this unlocks:
--   * Waive an org's take rate (partner deal, comp account).
--   * Comp a specific creator onto 0% take rate forever.
--   * Switch an org onto a private plan (used in Phase 3).
--   * Toggle one feature flag per org without changing their plan.
--   * Raise a limit (e.g. give a Free org 10 briefs instead of 3).
--   * Time-bound trial extensions (recorded now, acted on in Phase 3
--     once subscriptions exist to extend).
--
-- The resolver in src/lib/pricing.ts consults this table on every
-- pricing decision. No code outside that module should read
-- pricing_overrides directly.

-- ============================================================
-- pricing_overrides — per-scope adjustments to the resolved pricing.
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Exactly one of scope_org_id / scope_user_id is set.
  scope_org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  scope_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- What this override changes:
  --   fee_bp           — replace the resolved take rate. value: { "fee_bp": 0 }
  --   plan             — switch to a specific plan.       value: { "plan_slug": "pro" }
  --   feature_flag     — toggle one feature.              value: { "key": "analytics", "enabled": true }
  --   limit            — raise/lower one limit.           value: { "key": "max_active_briefs", "value": 10 }
  --   trial_extension  — extend trial by N days (Phase 3) value: { "days": 30 }
  kind TEXT NOT NULL CHECK (kind IN ('fee_bp', 'plan', 'feature_flag', 'limit', 'trial_extension')),
  value JSONB NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) >= 3),
  granted_by UUID NOT NULL REFERENCES profiles(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL = forever. Resolver treats expired overrides as inactive.
  expires_at TIMESTAMPTZ,
  -- Soft-delete flag — revoke without losing the audit trail.
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (
    (scope_org_id IS NOT NULL AND scope_user_id IS NULL) OR
    (scope_org_id IS NULL AND scope_user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pricing_overrides_active_org
  ON pricing_overrides(scope_org_id, kind)
  WHERE active = TRUE AND scope_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_overrides_active_user
  ON pricing_overrides(scope_user_id, kind)
  WHERE active = TRUE AND scope_user_id IS NOT NULL;

ALTER TABLE pricing_overrides ENABLE ROW LEVEL SECURITY;

-- Only platform admins can see or mutate overrides. Org admins
-- shouldn't be able to grant themselves discounts.
DROP POLICY IF EXISTS "Platform admins manage overrides" ON pricing_overrides;
CREATE POLICY "Platform admins manage overrides"
  ON pricing_overrides FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================
-- pricing_audit_log — every plan change, override grant/revoke,
-- rate adjustment. Append-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id),
  -- Free-text action key, e.g.:
  --   override.granted, override.revoked, override.expired,
  --   plan.created, plan.updated,
  --   payment.fee_applied (optional, can be heavy — kept for Phase 3+)
  action TEXT NOT NULL,
  scope_org_id UUID,
  scope_user_id UUID,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_org_time
  ON pricing_audit_log(scope_org_id, created_at DESC)
  WHERE scope_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_user_time
  ON pricing_audit_log(scope_user_id, created_at DESC)
  WHERE scope_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_time
  ON pricing_audit_log(created_at DESC);

ALTER TABLE pricing_audit_log ENABLE ROW LEVEL SECURITY;

-- Platform admins read the log. Inserts also gated to platform admins;
-- the server actions that write here run with the admin's auth context.
-- No UPDATE/DELETE policies — the table is append-only.
DROP POLICY IF EXISTS "Platform admins read audit log" ON pricing_audit_log;
CREATE POLICY "Platform admins read audit log"
  ON pricing_audit_log FOR SELECT
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admins write audit log" ON pricing_audit_log;
CREATE POLICY "Platform admins write audit log"
  ON pricing_audit_log FOR INSERT
  WITH CHECK (is_platform_admin());
