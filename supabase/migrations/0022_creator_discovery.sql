-- Creator discovery: org applications + discoverable flag

-- Add discoverable flag to organizations
ALTER TABLE organizations ADD COLUMN discoverable BOOLEAN NOT NULL DEFAULT FALSE;

-- Applications table: creators apply to join an org
CREATE TABLE org_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_org_applications_org_id ON org_applications(org_id);
CREATE INDEX idx_org_applications_user_id ON org_applications(user_id);
CREATE INDEX idx_org_applications_status ON org_applications(org_id, status);

CREATE TRIGGER update_org_applications_updated_at
  BEFORE UPDATE ON org_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE org_applications ENABLE ROW LEVEL SECURITY;

-- Users can view their own applications
CREATE POLICY "Users can view own applications"
  ON org_applications FOR SELECT
  USING (user_id = auth.uid());

-- Org admins can view applications for their org
CREATE POLICY "Admins can view org applications"
  ON org_applications FOR SELECT
  USING (is_org_admin(org_id));

-- Authenticated users can create applications for discoverable orgs
CREATE POLICY "Users can apply to discoverable orgs"
  ON org_applications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organizations
      WHERE id = org_id AND discoverable = TRUE
    )
  );

-- Org admins can update applications (approve/reject)
CREATE POLICY "Admins can update org applications"
  ON org_applications FOR UPDATE
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- Anyone can read discoverable org details (for the /discover page)
CREATE POLICY "Anyone can read discoverable orgs"
  ON organizations FOR SELECT
  USING (discoverable = TRUE);

-- Function to approve an application (creates membership)
CREATE OR REPLACE FUNCTION approve_application(p_application_id UUID, p_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_app RECORD;
BEGIN
  SELECT * INTO v_app
  FROM org_applications
  WHERE id = p_application_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Update application status
  UPDATE org_applications
  SET status = 'approved', reviewed_by = p_admin_id, reviewed_at = NOW()
  WHERE id = p_application_id;

  -- Create membership
  INSERT INTO memberships (user_id, org_id, role, status)
  VALUES (v_app.user_id, v_app.org_id, 'creator', 'active')
  ON CONFLICT (user_id, org_id) DO UPDATE SET status = 'active';

  -- Set active org if user doesn't have one
  UPDATE profiles
  SET active_org_id = v_app.org_id
  WHERE id = v_app.user_id AND active_org_id IS NULL;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION approve_application(UUID, UUID) OWNER TO postgres;
