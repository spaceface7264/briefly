-- Update use_invite_code to create a membership in the invite's org
-- and set the user's active_org_id.

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

  -- Create a membership in the invite's org (creator role by default)
  INSERT INTO memberships (user_id, org_id, role, status)
  VALUES (user_uuid, code_record.org_id, 'creator', 'active')
  ON CONFLICT (user_id, org_id) DO NOTHING;

  -- Set the user's active org
  UPDATE profiles
  SET active_org_id = code_record.org_id
  WHERE id = user_uuid AND active_org_id IS NULL;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
