-- Invite codes table
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for code lookup
CREATE INDEX idx_invite_codes_code ON invite_codes(code);

-- RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can check if a code is valid (for signup)
CREATE POLICY "Anyone can check invite codes"
  ON invite_codes FOR SELECT
  USING (true);

-- Only admins can create invite codes
CREATE POLICY "Admins can create invite codes"
  ON invite_codes FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can update invite codes
CREATE POLICY "Admins can update invite codes"
  ON invite_codes FOR UPDATE
  USING (is_admin());

-- Only admins can delete invite codes
CREATE POLICY "Admins can delete invite codes"
  ON invite_codes FOR DELETE
  USING (is_admin());

-- Function to validate and use an invite code
CREATE OR REPLACE FUNCTION use_invite_code(invite_code TEXT, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- Find valid unused code
  SELECT * INTO code_record
  FROM invite_codes
  WHERE code = invite_code
    AND used_by IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Mark as used
  UPDATE invite_codes
  SET used_by = user_uuid, used_at = NOW()
  WHERE id = code_record.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
