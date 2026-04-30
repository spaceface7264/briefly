-- Escrow schema (Phase 1.1a of the post-genericization roadmap; see
-- TODO.md §9 → Phase 1.1).
--
-- Today's money flow: payClaim calls stripe.transfers.create() to send
-- funds from the platform's Stripe balance to the creator's connected
-- account. There is no per-transaction charge to the org — the
-- platform fronts every payout. This migration is the schema half of
-- replacing that with a real escrow model:
--
--   1. Org adds a payment method (handled via stripe_customer_id +
--      default_payment_method_id added to organizations below).
--   2. On brief publish, a PaymentIntent for `price_dkk × claim_limit`
--      charges the org and lands in the platform balance. The brief
--      flips funded_status from `unfunded` to `funded` and we record
--      escrow_amount_dkk + escrow_held_dkk (initially equal).
--   3. On approval, the existing payClaim transfer fires and we
--      decrement escrow_held_dkk by the gross slot amount. funded_status
--      moves to `partially_released` if any slots remain, `released`
--      when held reaches 0.
--   4. On cancel / reject / expire / archive, the unreleased amount
--      is refunded to the org's payment method (handled in 1.1e).
--      funded_status moves to `refunded` (or stays partial if some
--      slots were already paid out).
--
-- This migration is *additive only* — no triggers, no behaviour changes,
-- no data backfill that affects the running app. Existing briefs land
-- as `unfunded` with NULL escrow columns. Subsequent migrations
-- (1.1b–1.1e) wire up the actual flows.
--
-- Unit convention: whole DKK (matches the existing `price_dkk`,
-- `gross_dkk`, etc. columns on briefs / payments). Stripe boundary
-- conversion to øre stays where it is in pay-action.ts. We may add
-- VAT-aware columns later when 1.2 lands; for now, escrow tracks the
-- gross commitment only.

-- 1) brief.funded_status enum
CREATE TYPE brief_funded_status AS ENUM (
  'unfunded',           -- not yet charged (existing rows + Free-tier briefs that don't escrow)
  'funded',             -- fully prefunded, no slots released yet
  'partially_released', -- one or more slots paid out, others still held
  'released',           -- every funded slot has been paid out
  'refunded'            -- unreleased amount returned to the org
);

-- 2) Brief escrow columns
ALTER TABLE briefs
  ADD COLUMN funded_status brief_funded_status NOT NULL DEFAULT 'unfunded',
  ADD COLUMN stripe_payment_intent_id text,
  -- Gross amount committed at publish time (price_dkk × claim_limit).
  -- Snapshotted here so price/limit edits to the brief later don't
  -- silently rewrite the escrow contract.
  ADD COLUMN escrow_amount_dkk integer,
  -- Running balance of unreleased funds. Starts equal to
  -- escrow_amount_dkk on funding, decrements by the gross slot
  -- amount on each successful payout, lands at 0 when fully
  -- released (or after a refund).
  ADD COLUMN escrow_held_dkk integer;

-- Constraints: held must be >= 0 and <= amount, and amount must be > 0
-- when set. Both columns must be either both NULL (unfunded) or both
-- non-NULL (funded onwards).
ALTER TABLE briefs
  ADD CONSTRAINT briefs_escrow_amount_positive
    CHECK (escrow_amount_dkk IS NULL OR escrow_amount_dkk > 0),
  ADD CONSTRAINT briefs_escrow_held_in_range
    CHECK (
      escrow_held_dkk IS NULL
      OR (escrow_held_dkk >= 0 AND escrow_held_dkk <= escrow_amount_dkk)
    ),
  ADD CONSTRAINT briefs_escrow_columns_consistent
    CHECK (
      (escrow_amount_dkk IS NULL AND escrow_held_dkk IS NULL)
      OR (escrow_amount_dkk IS NOT NULL AND escrow_held_dkk IS NOT NULL)
    );

-- Filter index for the admin "Pending funding" / "Funded" surfaces.
-- Partial because the vast majority of briefs over time will be in
-- terminal states (released / refunded) and we mostly care about
-- in-flight ones.
CREATE INDEX briefs_funded_status_active_idx
  ON briefs (funded_status)
  WHERE funded_status IN ('unfunded', 'funded', 'partially_released');

-- 3) Org-level Stripe Customer + default payment method
ALTER TABLE organizations
  -- One Stripe Customer per org. Created lazily on first payment-method
  -- attach (1.1b). All org-side billing — current Stripe Billing
  -- subscription from migration 0028, plus future escrow charges —
  -- attaches to this Customer.
  ADD COLUMN stripe_customer_id text UNIQUE,
  -- Default payment method id (pm_…) saved to the Customer. The
  -- escrow PaymentIntent in 1.1c uses this as the source.
  ADD COLUMN default_payment_method_id text;
