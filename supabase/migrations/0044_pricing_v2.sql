-- Pricing v2: zero take rate, monthly brief allowance + flat overage
-- per published brief, draft state on briefs.
--
-- Replaces the stepped take-rate model from 0026. Subscription tiers
-- now grant a monthly publishing allowance; once exhausted, a flat
-- overage fee per brief is charged at publish time. Pro and Enterprise
-- have unlimited briefs and no overage.
--
-- Drafts let orgs prepare briefs without paying. Publishing is the
-- only billable event for briefs (escrow PI + optional overage).
-- Archiving an unfilled brief refunds the held escrow but the publish
-- fee is not refundable.
--
-- Final tier table:
--   Free        0 DKK/mo,  2 incl,  79 DKK overage,  2 creators,  1 seat
--   Studio    499 DKK/mo, 15 incl,  39 DKK overage, 25 creators,  3 seats
--   Pro     1 499 DKK/mo, unlimited, no overage,    unlimited,  10 seats
--   Enterprise   custom,  unlimited, no overage,    unlimited,   unlimited

-- ============================================================
-- 1. Brief draft state.
--    ALTER TYPE ... ADD VALUE works inside a transaction (PG12+) so
--    long as the new value isn't referenced in the same transaction.
--    First inserts of draft-status rows happen from app code after
--    this migration completes.
-- ============================================================
ALTER TYPE brief_status ADD VALUE IF NOT EXISTS 'draft';

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overage_charge_dkk INTEGER
    CHECK (overage_charge_dkk IS NULL OR overage_charge_dkk >= 0),
  ADD COLUMN IF NOT EXISTS overage_payment_intent_id TEXT;

-- Backfill: every existing brief was created in published form (no
-- draft state existed yet), so set published_at to its creation time.
UPDATE briefs SET published_at = created_at WHERE published_at IS NULL;

-- ============================================================
-- 2. Plan catalogue.
-- ============================================================
ALTER TABLE pricing_plans
  ADD COLUMN IF NOT EXISTS monthly_brief_allowance INTEGER
    CHECK (monthly_brief_allowance IS NULL OR monthly_brief_allowance >= 0),
  ADD COLUMN IF NOT EXISTS overage_dkk_per_brief INTEGER
    CHECK (overage_dkk_per_brief IS NULL OR overage_dkk_per_brief >= 0);

-- Zero take rate across every plan. The default_fee_bp column stays
-- (so existing computeFee() callers and payments.platform_fee_bp
-- snapshots keep working), but it's effectively a constant 0 now.
UPDATE pricing_plans SET default_fee_bp = 0;

-- Free: 2 briefs/mo, 79 DKK overage, 2 creators, 1 seat.
UPDATE pricing_plans SET
  description = 'Try the platform. 2 briefs per month, up to 2 creators on your roster.',
  monthly_price_dkk = 0,
  annual_price_dkk = 0,
  monthly_brief_allowance = 2,
  overage_dkk_per_brief = 79,
  limits = '{"max_creators": 2, "max_seats": 1}'::JSONB,
  features = '{"analytics": false, "custom_branding": false, "discovery_boost": false}'::JSONB,
  visible = TRUE
WHERE slug = 'free';

-- Pro: unlimited briefs, no overage, unlimited creators, 10 seats.
UPDATE pricing_plans SET
  description = 'Unlimited briefs and creators, full analytics, and discovery boost.',
  monthly_price_dkk = 1499,
  annual_price_dkk = 0,
  monthly_brief_allowance = NULL,
  overage_dkk_per_brief = NULL,
  trial_days = 0,
  limits = '{"max_creators": null, "max_seats": 10}'::JSONB,
  features = '{"analytics": true, "custom_branding": true, "discovery_boost": true}'::JSONB,
  visible = TRUE
WHERE slug = 'pro';

-- Studio: 15 briefs/mo, 39 DKK overage, 25 creators, 3 seats.
INSERT INTO pricing_plans
  (slug, name, description,
   monthly_price_dkk, annual_price_dkk, default_fee_bp, trial_days,
   monthly_brief_allowance, overage_dkk_per_brief,
   limits, features, visible)
VALUES
  ('studio', 'Studio',
   '15 briefs per month, up to 25 creators, 3 team seats.',
   499, 0, 0, 0,
   15, 39,
   '{"max_creators": 25, "max_seats": 3}'::JSONB,
   '{"analytics": true, "custom_branding": false, "discovery_boost": false}'::JSONB,
   TRUE)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  monthly_price_dkk = EXCLUDED.monthly_price_dkk,
  default_fee_bp = EXCLUDED.default_fee_bp,
  monthly_brief_allowance = EXCLUDED.monthly_brief_allowance,
  overage_dkk_per_brief = EXCLUDED.overage_dkk_per_brief,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

-- Enterprise: contact-sales tier. Hidden from self-serve picker
-- (visible=FALSE); platform admins flip orgs onto it manually via a
-- 'plan' override in pricing_overrides.
INSERT INTO pricing_plans
  (slug, name, description,
   monthly_price_dkk, annual_price_dkk, default_fee_bp, trial_days,
   monthly_brief_allowance, overage_dkk_per_brief,
   limits, features, visible)
VALUES
  ('enterprise', 'Enterprise',
   'Custom-priced tier for large organisations. Unlimited everything.',
   0, 0, 0, 0,
   NULL, NULL,
   '{"max_creators": null, "max_seats": null}'::JSONB,
   '{"analytics": true, "custom_branding": true, "discovery_boost": true}'::JSONB,
   FALSE)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  default_fee_bp = EXCLUDED.default_fee_bp,
  monthly_brief_allowance = EXCLUDED.monthly_brief_allowance,
  overage_dkk_per_brief = EXCLUDED.overage_dkk_per_brief,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  visible = EXCLUDED.visible;

-- ============================================================
-- 3. Subscription period counter + lazy reset anchor.
--    Stripe's invoice.paid webhook bumps period_anchor and resets the
--    counter for paid plans. Free has no Stripe sub, so the publish
--    action lazily resets when period_anchor + 1 month < now().
-- ============================================================
ALTER TABLE org_subscriptions
  ADD COLUMN IF NOT EXISTS briefs_published_this_period INTEGER NOT NULL DEFAULT 0
    CHECK (briefs_published_this_period >= 0),
  ADD COLUMN IF NOT EXISTS period_anchor TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================================
-- 4. Drop the old max_active_briefs trigger. Throughput (allowance +
--    overage) is the gate now; concurrent open count no longer is.
--    The enforce_creator_count_limit trigger from 0029 keeps working
--    unchanged: it reads max_creators from limits jsonb via
--    effective_org_limit().
-- ============================================================
DROP TRIGGER IF EXISTS trigger_active_brief_limit ON briefs;
DROP FUNCTION IF EXISTS enforce_active_brief_limit();

-- ============================================================
-- 5. Helper: effective brief allowance for an org.
--    Returns NULL for unlimited (Pro / Enterprise).
--    Mirrors effective_org_limit's precedence: limit override -> plan
--    override -> live subscription -> Free fallback.
-- ============================================================
CREATE OR REPLACE FUNCTION effective_brief_allowance(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_override_value JSONB;
  v_override_plan_slug TEXT;
  v_plan_id UUID;
  v_status TEXT;
  v_allowance INTEGER;
BEGIN
  -- 1. Per-key limit override (kind='limit', key='monthly_brief_allowance').
  SELECT po.value->'value' INTO v_override_value
  FROM pricing_overrides po
  WHERE po.scope_org_id = p_org_id
    AND po.kind = 'limit'
    AND po.value->>'key' = 'monthly_brief_allowance'
    AND po.active = TRUE
    AND (po.expires_at IS NULL OR po.expires_at > NOW())
  ORDER BY po.granted_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_override_value IS NULL OR jsonb_typeof(v_override_value) = 'null' THEN
      RETURN NULL;
    END IF;
    IF jsonb_typeof(v_override_value) = 'number' THEN
      RETURN (v_override_value::text)::INTEGER;
    END IF;
    RETURN NULL;
  END IF;

  -- 2. Plan-kind override.
  SELECT po.value->>'plan_slug' INTO v_override_plan_slug
  FROM pricing_overrides po
  WHERE po.scope_org_id = p_org_id
    AND po.kind = 'plan'
    AND po.active = TRUE
    AND (po.expires_at IS NULL OR po.expires_at > NOW())
  ORDER BY po.granted_at DESC
  LIMIT 1;

  IF v_override_plan_slug IS NOT NULL THEN
    SELECT id INTO v_plan_id FROM pricing_plans WHERE slug = v_override_plan_slug;
  ELSE
    -- 3. Live subscription, only if status is in the live set.
    SELECT plan_id, status INTO v_plan_id, v_status
    FROM org_subscriptions
    WHERE org_id = p_org_id;

    IF v_status IS NULL OR v_status NOT IN ('free', 'trialing', 'active', 'past_due') THEN
      v_plan_id := NULL;
    END IF;
  END IF;

  -- 4. Plan column, or 5. Free fallback.
  IF v_plan_id IS NOT NULL THEN
    SELECT monthly_brief_allowance INTO v_allowance
    FROM pricing_plans WHERE id = v_plan_id;
  ELSE
    SELECT monthly_brief_allowance INTO v_allowance
    FROM pricing_plans WHERE slug = 'free';
  END IF;

  RETURN v_allowance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER FUNCTION effective_brief_allowance(UUID) OWNER TO postgres;

-- Mirror helper for the overage rate. Returns NULL when the plan
-- doesn't allow overages (Pro / Enterprise) so the publish action
-- knows to surface "upgrade required" instead of charging.
CREATE OR REPLACE FUNCTION effective_overage_rate(p_org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_override_plan_slug TEXT;
  v_plan_id UUID;
  v_status TEXT;
  v_rate INTEGER;
BEGIN
  SELECT po.value->>'plan_slug' INTO v_override_plan_slug
  FROM pricing_overrides po
  WHERE po.scope_org_id = p_org_id
    AND po.kind = 'plan'
    AND po.active = TRUE
    AND (po.expires_at IS NULL OR po.expires_at > NOW())
  ORDER BY po.granted_at DESC
  LIMIT 1;

  IF v_override_plan_slug IS NOT NULL THEN
    SELECT id INTO v_plan_id FROM pricing_plans WHERE slug = v_override_plan_slug;
  ELSE
    SELECT plan_id, status INTO v_plan_id, v_status
    FROM org_subscriptions
    WHERE org_id = p_org_id;

    IF v_status IS NULL OR v_status NOT IN ('free', 'trialing', 'active', 'past_due') THEN
      v_plan_id := NULL;
    END IF;
  END IF;

  IF v_plan_id IS NOT NULL THEN
    SELECT overage_dkk_per_brief INTO v_rate
    FROM pricing_plans WHERE id = v_plan_id;
  ELSE
    SELECT overage_dkk_per_brief INTO v_rate
    FROM pricing_plans WHERE slug = 'free';
  END IF;

  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER FUNCTION effective_overage_rate(UUID) OWNER TO postgres;
