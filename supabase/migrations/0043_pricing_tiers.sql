-- Production pricing tiers.
--
-- Replaces the placeholder Free (3/3, 5%) + Pro (unlimited, 5%, 0 DKK)
-- seed from 0026 with a real four-tier structure: Free, Studio, Pro,
-- Enterprise. Take rate is now stepped 15% / 10% / 6% / negotiated so
-- subscribing carries economic value beyond capacity, not just
-- feature flags.
--
-- max_seats is added to the limits JSONB but is NOT enforced by a
-- trigger in this migration. A follow-up will install
-- enforce_seat_count_limit() paralleling enforce_creator_count_limit
-- in 0029. Today the cap is surfaced in the billing UI only.
--
-- stripe_monthly_price_id / stripe_annual_price_id stay NULL: they
-- must be created in Stripe Dashboard and backfilled by a platform
-- admin before Studio or Pro can be checked out. Enterprise has no
-- Stripe price IDs by design (invoiced manually; per-org rate lives
-- on a pricing_overrides fee_bp row).
--
-- See plan: /root/.claude/plans/i-want-you-to-temporal-unicorn.md

-- Free: on-ramp. Bumps take rate to 15% (was 5%) so the platform
-- earns on Free orgs while their volume is small. Caps are tight
-- enough that running a real content programme requires upgrading.
UPDATE pricing_plans
SET
  description = 'Try the platform. 2 active briefs, 5 creators, 1 owner seat. 15% on creator payouts.',
  monthly_price_dkk = 0,
  annual_price_dkk = 0,
  default_fee_bp = 1500,
  trial_days = 0,
  limits = '{"max_active_briefs": 2, "max_creators": 5, "max_seats": 1}'::JSONB,
  features = '{"analytics": false, "custom_branding": false, "discovery_boost": false}'::JSONB,
  visible = TRUE,
  legacy = FALSE
WHERE slug = 'free';

-- Studio: SMB paid tier. Sized for one team running a bounded but
-- real content programme.
INSERT INTO pricing_plans
  (slug, name, description, monthly_price_dkk, annual_price_dkk, default_fee_bp, trial_days, limits, features, visible)
VALUES
  ('studio', 'Studio',
   'For active small teams. 10 briefs, 25 creators, 3 seats. 10% take rate.',
   499, 4990, 1000, 14,
   '{"max_active_briefs": 10, "max_creators": 25, "max_seats": 3}'::JSONB,
   '{"analytics": true, "custom_branding": false, "discovery_boost": false}'::JSONB,
   TRUE)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_price_dkk = EXCLUDED.monthly_price_dkk,
  annual_price_dkk = EXCLUDED.annual_price_dkk,
  default_fee_bp = EXCLUDED.default_fee_bp,
  trial_days = EXCLUDED.trial_days,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  visible = EXCLUDED.visible,
  legacy = FALSE;

-- Pro: agencies and in-house teams running continuous campaigns.
-- Drops the fee further and unlocks discovery_boost + custom_branding
-- in the features JSONB. The billing card already reads these flags.
UPDATE pricing_plans
SET
  description = 'Unlimited briefs and creators, 10 seats, full analytics, discovery boost, custom branding. 6% take rate.',
  monthly_price_dkk = 1499,
  annual_price_dkk = 14990,
  default_fee_bp = 600,
  trial_days = 14,
  limits = '{"max_active_briefs": null, "max_creators": null, "max_seats": 10}'::JSONB,
  features = '{"analytics": true, "custom_branding": true, "discovery_boost": true}'::JSONB,
  visible = TRUE,
  legacy = FALSE
WHERE slug = 'pro';

-- Enterprise: invisible. Sales places a customer here either by
-- setting private_to_org_id, by writing a pricing_overrides plan-swap
-- row, or by writing a pricing_overrides fee_bp row directly. The
-- 500 bp default is the floor of the negotiable band; the real
-- number lives on the override.
INSERT INTO pricing_plans
  (slug, name, description, monthly_price_dkk, annual_price_dkk, default_fee_bp, trial_days, limits, features, visible)
VALUES
  ('enterprise', 'Enterprise',
   'Custom contract. Unlimited everything, negotiated take rate, dedicated support.',
   0, 0, 500, 0,
   '{"max_active_briefs": null, "max_creators": null, "max_seats": null}'::JSONB,
   '{"analytics": true, "custom_branding": true, "discovery_boost": true}'::JSONB,
   FALSE)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_fee_bp = EXCLUDED.default_fee_bp,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  visible = EXCLUDED.visible,
  legacy = FALSE;
