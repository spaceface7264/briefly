-- Money tools (manual refund + transfer retry) at /admin/super/money.
--
-- The /admin/super/money page lets a platform admin clear the two
-- failure modes the automated flows can't reach on their own:
--
--   1. Refund a creator-side payment row outside the brief-archive
--      flow. Stripe `refunds.create({ payment_intent, amount })` is
--      issued against the brief's escrow PaymentIntent (the only PI
--      we have on file for a paid claim). We need a way to mark the
--      payments row so it doesn't keep showing as `succeeded` in
--      reporting; the existing payment_status enum had no terminal
--      `refunded` value.
--
--   2. Retry a stuck transfer for an approved claim. This path
--      already produces a payments row in `failed` state, so the
--      enum doesn't need to change for retry. But the audit trail
--      benefits from a stripe_refund_id + refunded_amount_dkk pair
--      so support can reconcile against Stripe without re-querying
--      the API.
--
-- This migration does three things:
--   * Adds 'refunded' to the payment_status enum.
--   * Adds payments.stripe_refund_id (Stripe refund object id, for
--     the latest refund applied to the row) and
--     payments.refunded_amount_dkk (sum of refunds against this row,
--     in whole DKK) so partial refunds round-trip cleanly.
--   * No RLS / policy changes required: writes go through
--     service-role from the platform-admin server actions, reads
--     piggyback on existing payments policies.

-- ============================================================
-- 1. Extend payment_status with a `refunded` terminal value
-- ============================================================

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'refunded';

-- ============================================================
-- 2. Track refund identifiers on payments
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount_dkk INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN payments.stripe_refund_id IS
  'Stripe refund object id from the most recent manual refund on this row.';
COMMENT ON COLUMN payments.refunded_amount_dkk IS
  'Cumulative DKK refunded against this payments row. Whole DKK. Touched only by the manual-refund tool at /admin/super/money.';
