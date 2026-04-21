-- Add claim_limit to briefs (how many creators can claim)
ALTER TABLE briefs ADD COLUMN claim_limit INTEGER NOT NULL DEFAULT 1;

-- Create claims table to track individual claims
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'approved', 'paid', 'cancelled')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brief_id, user_id)
);

-- Indexes
CREATE INDEX idx_claims_brief_id ON claims(brief_id);
CREATE INDEX idx_claims_user_id ON claims(user_id);
CREATE INDEX idx_claims_status ON claims(status);

-- Trigger for updated_at
CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to count active claims for a brief
CREATE OR REPLACE FUNCTION get_active_claim_count(brief_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER FROM claims
    WHERE brief_id = brief_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user has claimed a brief
CREATE OR REPLACE FUNCTION user_has_claimed(brief_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM claims
    WHERE brief_id = brief_uuid
    AND user_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- Claims RLS policies
-- Users can view their own claims
CREATE POLICY "Users can view own claims"
  ON claims FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

-- Users can insert claims if brief has available slots and they haven't already claimed
CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT user_has_claimed(brief_id)
    AND get_active_claim_count(brief_id) < (SELECT claim_limit FROM briefs WHERE id = brief_id)
    AND (SELECT status FROM briefs WHERE id = brief_id) = 'open'
  );

-- Users can update their own claims (e.g., submit, cancel)
CREATE POLICY "Users can update own claims"
  ON claims FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can do anything
CREATE POLICY "Admins have full access to claims"
  ON claims FOR ALL
  USING (is_admin());

-- Update briefs RLS: creators can see open briefs or briefs they have a claim on
DROP POLICY IF EXISTS "Creators can view open briefs or their claims" ON briefs;
CREATE POLICY "Creators can view open briefs or briefs they claimed"
  ON briefs FOR SELECT
  USING (
    status = 'open'
    OR user_has_claimed(id)
    OR is_admin()
  );

-- Remove old claim columns from briefs (now tracked in claims table)
-- Keep them for now for backwards compatibility, but they won't be used
-- ALTER TABLE briefs DROP COLUMN claimed_by, DROP COLUMN claimed_at, DROP COLUMN claim_expires_at;

-- Update seed briefs to have different claim limits
UPDATE briefs SET claim_limit = 3 WHERE title = 'Summer Send Session Reel';
UPDATE briefs SET claim_limit = 2 WHERE title = 'Competition Day Coverage';
