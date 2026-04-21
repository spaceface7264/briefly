-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE brief_category AS ENUM ('entertaining', 'ad', 'guide', 'event', 'community');
CREATE TYPE brief_format AS ENUM ('reel', 'tiktok', 'youtube_short', 'long_form', 'photo');
CREATE TYPE brief_status AS ENUM ('open', 'claimed', 'submitted', 'approved', 'paid', 'archived');
CREATE TYPE user_role AS ENUM ('creator', 'admin');

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  instagram_handle TEXT,
  tags TEXT[] DEFAULT '{}',
  role user_role NOT NULL DEFAULT 'creator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Briefs table
CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category brief_category NOT NULL,
  format brief_format NOT NULL,
  price_dkk INTEGER NOT NULL CHECK (price_dkk >= 0),
  deadline DATE,
  gym TEXT,
  reference_urls TEXT[] DEFAULT '{}',
  deliverable_specs JSONB DEFAULT '{}',
  usage_rights TEXT,
  status brief_status NOT NULL DEFAULT 'open',
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_briefs_status ON briefs(status);
CREATE INDEX idx_briefs_claimed_by ON briefs(claimed_by);
CREATE INDEX idx_briefs_category ON briefs(category);
CREATE INDEX idx_briefs_format ON briefs(format);
CREATE INDEX idx_briefs_gym ON briefs(gym);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_briefs_updated_at
  BEFORE UPDATE ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can do anything with profiles
CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL
  USING (is_admin());

-- Briefs RLS policies
-- Creators can see open briefs or briefs they claimed
CREATE POLICY "Creators can view open briefs or their claims"
  ON briefs FOR SELECT
  USING (
    status = 'open'
    OR claimed_by = auth.uid()
    OR is_admin()
  );

-- Creators can claim open briefs (update status to claimed and set claimed_by)
CREATE POLICY "Creators can claim open briefs"
  ON briefs FOR UPDATE
  USING (
    status = 'open'
    AND claimed_by IS NULL
  )
  WITH CHECK (
    status = 'claimed'
    AND claimed_by = auth.uid()
    AND claimed_at IS NOT NULL
    AND claim_expires_at IS NOT NULL
  );

-- Admins can do anything with briefs
CREATE POLICY "Admins have full access to briefs"
  ON briefs FOR ALL
  USING (is_admin());

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Seed data: Sample briefs
INSERT INTO briefs (title, description, category, format, price_dkk, deadline, gym, reference_urls, deliverable_specs, usage_rights, status)
VALUES
  (
    'Summer Send Session Reel',
    'Create an energetic reel showcasing the best sends at our gym. Focus on community vibes, diverse climbers, and epic moments. Must include at least 3 different climbers and various difficulty levels.',
    'entertaining',
    'reel',
    2500,
    '2025-06-15',
    'Boulders Sydhavn',
    ARRAY['https://instagram.com/reel/example1', 'https://instagram.com/reel/example2'],
    '{"duration": "30-60 seconds", "aspect_ratio": "9:16", "music": "trending audio preferred"}',
    'Perpetual usage rights across all Boulders social channels and marketing materials',
    'open'
  ),
  (
    'Beginner Technique Guide',
    'Educational content explaining 3 fundamental footwork techniques for new climbers. Should be clear, encouraging, and accessible. Include demonstrations and common mistakes to avoid.',
    'guide',
    'tiktok',
    1800,
    '2025-05-30',
    NULL,
    ARRAY['https://tiktok.com/@example/video/123'],
    '{"duration": "60-90 seconds", "aspect_ratio": "9:16", "captions": "required"}',
    'Perpetual usage rights for educational content',
    'open'
  ),
  (
    'Competition Day Coverage',
    'Document the upcoming comp at Valby. Capture the energy, interviews with participants, and key moments. Will need to be on-site for the full event.',
    'event',
    'long_form',
    4500,
    '2025-05-20',
    'Boulders Valby',
    ARRAY[]::text[],
    '{"duration": "3-5 minutes", "aspect_ratio": "16:9", "b_roll": "minimum 20 clips"}',
    'Perpetual usage rights with creator credit',
    'open'
  ),
  (
    'New Route Promo',
    'Quick promo for the new moonboard setup. Showcase 2-3 climbers trying problems, highlight the tech features. Energetic and modern feel.',
    'ad',
    'reel',
    2000,
    NULL,
    'Boulders Amager',
    ARRAY[]::text[],
    '{"duration": "15-30 seconds", "aspect_ratio": "9:16"}',
    'Perpetual usage rights for promotional content',
    'open'
  );
