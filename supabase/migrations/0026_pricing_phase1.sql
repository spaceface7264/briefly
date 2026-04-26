-- Phase 1 of platform monetisation: take rate on payouts + plan
-- catalogue scaffolding.
--
-- Adds:
--   * pricing_plans          — Free + Pro catalogue, seeded.
--   * profiles.is_platform_admin
--                           — flag for the small set of users who can
--                             manage plans, grant overrides, view
--                             revenue. Distinct from per-org admin.
--   * is_platform_admin()    — RLS helper mirroring is_admin() / is_org_admin().
--   * payments.gross_dkk     — what the brief was advertised at.
--   * payments.platform_fee_bp / platform_fee_dkk
--                           — frozen fee state at the time of payout
--                             so historical invoices never drift if
--                             the platform rate changes later.
--
-- Phase 2 will add pricing_overrides + audit log. Phase 3 wires
-- Stripe Billing for the Pro subscription. The resolver in
-- src/lib/pricing.ts is shaped so those layers slot in without
-- refactoring callers.

-- ============================================================
-- 1. Platform-admin flag (must come before the helper function
--    references it).
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_is_platform_admin
  ON profiles(is_platform_admin) WHERE is_platform_admin = TRUE;

-- RLS helper. Mirrors is_admin() (0017) — qualified column name avoids
-- collision with the same-name function.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT p.is_platform_admin FROM profiles p WHERE p.id = auth.uid()),
    FALSE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 2. Plan catalogue.
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_dkk INTEGER NOT NULL DEFAULT 0,
  annual_price_dkk INTEGER NOT NULL DEFAULT 0,
  -- Default take rate for orgs on this plan, in basis points.
  -- 500 = 5.00%. Per-org overrides (Phase 2) can adjust.
  default_fee_bp INTEGER NOT NULL DEFAULT 500 CHECK (default_fee_bp BETWEEN 0 AND 10000),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  -- Resource caps. NULL = unlimited.
  -- e.g. { "max_active_briefs": 3, "max_creators": 3 }
  limits JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Feature flags that this plan unlocks.
  -- e.g. { "analytics": true, "custom_branding": false }
  features JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Whether new orgs can self-select this plan in the UI.
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  -- Grandfathered plans stay valid for orgs already on them but
  -- aren't offered to new sign-ups.
  legacy BOOLEAN NOT NULL DEFAULT FALSE,
  -- Enterprise / private plans: only the named org can subscribe.
  private_to_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  -- Stripe Billing handles (populated when Phase 3 lands).
  stripe_monthly_price_id TEXT,
  stripe_annual_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_plans_visible
  ON pricing_plans(visible) WHERE visible = TRUE;

DROP TRIGGER IF EXISTS update_pricing_plans_updated_at ON pricing_plans;
CREATE TRIGGER update_pricing_plans_updated_at
  BEFORE UPDATE ON pricing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Visible plans are readable by anyone authenticated. Private plans
-- (private_to_org_id IS NOT NULL) only by members of that org or
-- platform admins. Hidden plans only by platform admins.
DROP POLICY IF EXISTS "Plans are publicly readable" ON pricing_plans;
CREATE POLICY "Plans are publicly readable"
  ON pricing_plans FOR SELECT
  USING (
    (visible = TRUE AND private_to_org_id IS NULL)
    OR (private_to_org_id IS NOT NULL AND is_org_member(private_to_org_id))
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Platform admins manage plans" ON pricing_plans;
CREATE POLICY "Platform admins manage plans"
  ON pricing_plans FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Seed Free + Pro. Pro pricing intentionally left at 0 — set the real
-- numbers via a follow-up SQL or the eventual platform-admin UI before
-- charging anyone. The take rate (500 bp = 5%) is the same on both;
-- the Pro perk is unlimited briefs/creators + premium features.
INSERT INTO pricing_plans
  (slug, name, description, monthly_price_dkk, annual_price_dkk, default_fee_bp, trial_days, limits, features, visible)
VALUES
  ('free', 'Free',
   'Try the platform — up to 3 active briefs and 3 creators on your roster.',
   0, 0, 500, 0,
   '{"max_active_briefs": 3, "max_creators": 3}'::JSONB,
   '{"analytics": false, "custom_branding": false, "discovery_boost": false}'::JSONB,
   TRUE),
  ('pro', 'Pro',
   'Unlimited briefs and creators, full analytics, and discovery boost.',
   0, 0, 500, 14,
   '{"max_active_briefs": null, "max_creators": null}'::JSONB,
   '{"analytics": true, "custom_branding": true, "discovery_boost": true}'::JSONB,
   TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. Frozen fee state on payments.
-- ============================================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS gross_dkk INTEGER,
  ADD COLUMN IF NOT EXISTS platform_fee_bp INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_bp BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS platform_fee_dkk INTEGER NOT NULL DEFAULT 0 CHECK (platform_fee_dkk >= 0);

-- Backfill historical rows: no fee was taken before this migration,
-- so gross == subtotal == amount. subtotal_dkk was added in 0007 as
-- nullable, so coalesce to amount_dkk (NOT NULL since 0006) for any
-- pre-VAT-invoicing rows.
UPDATE payments SET gross_dkk = COALESCE(subtotal_dkk, amount_dkk) WHERE gross_dkk IS NULL;
ALTER TABLE payments ALTER COLUMN gross_dkk SET NOT NULL;
