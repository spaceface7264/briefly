-- VAT & self-billed invoice support
-- Adds creator billing details, self-billing agreement tracking,
-- invoice numbering, and VAT fields on payments.

-- Creator billing + VAT details
ALTER TABLE profiles
  ADD COLUMN country TEXT,
  ADD COLUMN billing_address_line1 TEXT,
  ADD COLUMN billing_address_line2 TEXT,
  ADD COLUMN billing_postal_code TEXT,
  ADD COLUMN billing_city TEXT,
  ADD COLUMN vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN vat_number TEXT,
  ADD COLUMN cvr_number TEXT,
  ADD COLUMN self_billing_agreement_version TEXT,
  ADD COLUMN self_billing_agreement_accepted_at TIMESTAMPTZ;

-- Per-year invoice sequence so numbers are monotonic per calendar year
CREATE TABLE invoice_counters (
  year INTEGER PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

-- Counter is read/written only via SECURITY DEFINER function below; no direct access.
CREATE POLICY "No direct access to invoice counters"
  ON invoice_counters FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION allocate_invoice_number(p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  INSERT INTO invoice_counters (year, last_seq)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO next_seq;
  RETURN next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- VAT scheme applied to a payment
CREATE TYPE vat_scheme AS ENUM ('none', 'standard', 'reverse_charge');

-- Add invoice + VAT fields to payments
ALTER TABLE payments
  ADD COLUMN invoice_year INTEGER,
  ADD COLUMN invoice_seq INTEGER,
  ADD COLUMN invoice_number TEXT,
  ADD COLUMN invoice_issued_at TIMESTAMPTZ,
  ADD COLUMN subtotal_dkk INTEGER,
  ADD COLUMN vat_rate_bp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN vat_amount_dkk INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_dkk INTEGER,
  ADD COLUMN vat_scheme vat_scheme NOT NULL DEFAULT 'none',
  -- Snapshot of creator + platform details at time of payment so the
  -- invoice remains accurate if profile is later edited.
  ADD COLUMN creator_name_snapshot TEXT,
  ADD COLUMN creator_address_snapshot TEXT,
  ADD COLUMN creator_country_snapshot TEXT,
  ADD COLUMN creator_vat_number_snapshot TEXT,
  ADD COLUMN creator_cvr_snapshot TEXT,
  ADD COLUMN platform_name_snapshot TEXT,
  ADD COLUMN platform_address_snapshot TEXT,
  ADD COLUMN platform_cvr_snapshot TEXT,
  ADD COLUMN platform_vat_snapshot TEXT,
  ADD COLUMN brief_title_snapshot TEXT,
  ADD COLUMN self_billing_agreement_version_snapshot TEXT,
  ADD CONSTRAINT payments_invoice_number_unique UNIQUE (invoice_number);

CREATE INDEX idx_payments_invoice_year ON payments(invoice_year);
