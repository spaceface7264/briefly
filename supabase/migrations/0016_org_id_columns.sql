-- Add org_id FK to all data tables + auto-set trigger

-- ============================================================
-- Auto-set org_id trigger function
-- Sets org_id from the inserting user's active org if not provided.
-- This lets existing app code work during the migration transition.
-- ============================================================
CREATE OR REPLACE FUNCTION set_org_id_from_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := (SELECT active_org_id FROM profiles WHERE id = auth.uid());
  END IF;
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required and could not be resolved from user profile';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- briefs
-- ============================================================
ALTER TABLE briefs ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE briefs SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE briefs ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_briefs_org_id ON briefs(org_id);

CREATE TRIGGER set_briefs_org_id
  BEFORE INSERT ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION set_org_id_from_user();

-- ============================================================
-- claims
-- ============================================================
ALTER TABLE claims ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE claims SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE claims ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_claims_org_id ON claims(org_id);

CREATE TRIGGER set_claims_org_id
  BEFORE INSERT ON claims
  FOR EACH ROW
  EXECUTE FUNCTION set_org_id_from_user();

-- ============================================================
-- payments
-- ============================================================
ALTER TABLE payments ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE payments SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE payments ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_payments_org_id ON payments(org_id);

-- ============================================================
-- invite_codes
-- ============================================================
ALTER TABLE invite_codes ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE invite_codes SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE invite_codes ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_invite_codes_org_id ON invite_codes(org_id);

CREATE TRIGGER set_invite_codes_org_id
  BEFORE INSERT ON invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION set_org_id_from_user();

-- ============================================================
-- notifications
-- ============================================================
ALTER TABLE notifications ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE notifications SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE notifications ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_notifications_org_id ON notifications(org_id);

-- ============================================================
-- notification_outbox
-- ============================================================
ALTER TABLE notification_outbox ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE notification_outbox SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE notification_outbox ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX idx_notification_outbox_org_id ON notification_outbox(org_id);

-- ============================================================
-- invoice_counters: change PK from (year) to (org_id, year)
-- ============================================================
ALTER TABLE invoice_counters ADD COLUMN org_id UUID REFERENCES organizations(id);
UPDATE invoice_counters SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE invoice_counters ALTER COLUMN org_id SET NOT NULL;

-- Drop old PK and create composite PK
ALTER TABLE invoice_counters DROP CONSTRAINT invoice_counters_pkey;
ALTER TABLE invoice_counters ADD PRIMARY KEY (org_id, year);
