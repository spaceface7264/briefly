-- Per-org invoice numbering
-- Rewrite allocate_invoice_number to accept org_id parameter.

CREATE OR REPLACE FUNCTION allocate_invoice_number(p_org_id UUID, p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  INSERT INTO invoice_counters (org_id, year, last_seq)
  VALUES (p_org_id, p_year, 1)
  ON CONFLICT (org_id, year) DO UPDATE
    SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO next_seq;
  RETURN next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
