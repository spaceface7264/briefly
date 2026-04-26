-- Phase 3 of platform monetisation: Stripe Billing for Pro
-- subscriptions.
--
-- Adds:
--   * org_subscriptions — one row per org, the live link to a
--     Stripe subscription. Auto-created at Free for every new org;
--     promotion to Pro happens via the Stripe Checkout flow.
--
-- The resolver in src/lib/pricing.ts now reads this table before
-- falling through to Free, so an active Pro subscription
-- automatically affects fee/limits/features without anyone touching
-- pricing_overrides.

CREATE TABLE IF NOT EXISTS org_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  -- Lifecycle. Mirrors Stripe's subscription.status with
  -- 'free' added for orgs on the no-charge default plan and
  -- 'paused' as a future Phase-4 state.
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'free', 'trialing', 'active', 'past_due', 'canceled',
      'paused', 'incomplete', 'incomplete_expired', 'unpaid'
    )),
  billing_interval TEXT NOT NULL DEFAULT 'free'
    CHECK (billing_interval IN ('monthly', 'annual', 'free')),
  -- Stripe handles. NULL while the org is on the Free plan.
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  paused_until TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id
  ON org_subscriptions(org_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_customer
  ON org_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_stripe_sub
  ON org_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_org_subscriptions_updated_at ON org_subscriptions;
CREATE TRIGGER update_org_subscriptions_updated_at
  BEFORE UPDATE ON org_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;

-- Members of the org can read its subscription (powers /admin/billing).
DROP POLICY IF EXISTS "Members read org subscription" ON org_subscriptions;
CREATE POLICY "Members read org subscription"
  ON org_subscriptions FOR SELECT
  USING (is_org_member(org_id) OR is_platform_admin());

-- Mutations come either from platform admins or from the Stripe
-- webhook (which uses the service-role key that bypasses RLS).
DROP POLICY IF EXISTS "Platform admins manage subscriptions" ON org_subscriptions;
CREATE POLICY "Platform admins manage subscriptions"
  ON org_subscriptions FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Auto-create a Free row when a new org is inserted, so the resolver
-- never has to special-case "no subscription row exists".
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
DECLARE
  v_free_plan_id UUID;
BEGIN
  SELECT id INTO v_free_plan_id FROM pricing_plans WHERE slug = 'free';
  IF v_free_plan_id IS NOT NULL THEN
    INSERT INTO org_subscriptions (org_id, plan_id, status, billing_interval)
    VALUES (NEW.id, v_free_plan_id, 'free', 'free')
    ON CONFLICT (org_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION create_default_subscription() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_create_default_subscription ON organizations;
CREATE TRIGGER trigger_create_default_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_subscription();

-- Backfill existing orgs onto the Free plan.
INSERT INTO org_subscriptions (org_id, plan_id, status, billing_interval)
SELECT
  o.id,
  (SELECT id FROM pricing_plans WHERE slug = 'free'),
  'free',
  'free'
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM org_subscriptions s WHERE s.org_id = o.id
);
