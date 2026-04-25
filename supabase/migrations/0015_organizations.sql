-- Multi-tenancy: organizations + memberships
-- Every business gets its own org. Users belong to orgs via memberships.

-- ============================================================
-- Organizations table
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  logo_url TEXT,
  accent_color TEXT DEFAULT '#C8FF00',
  description TEXT,
  industry TEXT,
  currency TEXT NOT NULL DEFAULT 'DKK',
  country TEXT NOT NULL DEFAULT 'DK',
  address TEXT,
  cvr TEXT,
  vat_number TEXT,
  contact_email TEXT,
  sender_name TEXT,
  sender_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Memberships table (user × org × role)
-- ============================================================
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'creator',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id)
);

CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_org_id ON memberships(org_id);
CREATE INDEX idx_memberships_org_role ON memberships(org_id, role);

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Active org reference on profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN active_org_id UUID REFERENCES organizations(id);

-- ============================================================
-- Seed default org + backfill existing data
-- ============================================================
INSERT INTO organizations (id, slug, name, currency, country)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Briefly', 'DKK', 'DK');

-- Create memberships for all existing profiles, preserving their current role
INSERT INTO memberships (user_id, org_id, role, status)
SELECT id, '00000000-0000-0000-0000-000000000001', role, 'active'
FROM profiles
ON CONFLICT (user_id, org_id) DO NOTHING;

-- Set active org for all existing profiles
UPDATE profiles SET active_org_id = '00000000-0000-0000-0000-000000000001'
WHERE active_org_id IS NULL;

-- ============================================================
-- Basic RLS on new tables (will be refined in 0017)
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Members can read their own org
CREATE POLICY "Members can read their org"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.org_id = organizations.id
      AND memberships.user_id = auth.uid()
      AND memberships.status = 'active'
    )
  );

-- Members can read memberships in their org
CREATE POLICY "Members can read org memberships"
  ON memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = memberships.org_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'
    )
  );

-- Admins can manage memberships in their org
CREATE POLICY "Admins can manage org memberships"
  ON memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = memberships.org_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.status = 'active'
    )
  );

-- Admins can update their org
CREATE POLICY "Admins can update their org"
  ON organizations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.org_id = organizations.id
      AND memberships.user_id = auth.uid()
      AND memberships.role = 'admin'
      AND memberships.status = 'active'
    )
  );
