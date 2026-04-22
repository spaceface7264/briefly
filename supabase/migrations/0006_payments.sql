-- Stripe Connect payout support
-- Adds creator payout account fields and a payments table tracking transfers.

-- Creator Stripe Connect fields
ALTER TABLE profiles
  ADD COLUMN stripe_account_id TEXT UNIQUE,
  ADD COLUMN stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN stripe_details_submitted BOOLEAN NOT NULL DEFAULT FALSE;

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed');

-- Payments table: one row per payout attempt against a claim
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount_dkk INTEGER NOT NULL CHECK (amount_dkk >= 0),
  stripe_transfer_id TEXT UNIQUE,
  stripe_account_id TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_claim_id ON payments(claim_id);
CREATE INDEX idx_payments_creator_id ON payments(creator_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Prevent double-pay: at most one succeeded payment per claim
CREATE UNIQUE INDEX uniq_payments_claim_succeeded
  ON payments(claim_id)
  WHERE status = 'succeeded';

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Creators can see their own payment history
CREATE POLICY "Creators view own payments"
  ON payments FOR SELECT
  USING (creator_id = auth.uid() OR is_admin());

-- Only admins write payments (server actions run with user's JWT,
-- webhooks use service role which bypasses RLS)
CREATE POLICY "Admins manage payments"
  ON payments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());
