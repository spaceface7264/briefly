-- Brand Assets, Phase 1: schema and storage.
--
-- One brand_kits row per org. Holds the structured brand kit that
-- creators unlock once they have an active claim on one of the org's
-- briefs (logos beyond the org's primary logo, color palette,
-- typography, guidelines link, voice/tone notes).
--
-- The org's primary logo lives on `organizations.logo_url` (used in
-- the sidebar identity, /discover card, emails) and is intentionally
-- not duplicated here. brand_kits adds variants beyond it.

-- ============================================================
-- brand_kits table
-- ============================================================
CREATE TABLE IF NOT EXISTS brand_kits (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,

  -- Logo variants. Stored as Supabase Storage URLs (private bucket
  -- below). Server actions mint signed URLs on read.
  logo_mark_url TEXT,
  logo_dark_url TEXT,
  logo_light_url TEXT,

  -- Color palette: array of { name: string, hex: string }. Capped at
  -- 12 in the application layer; the constraint here is just a
  -- sanity bound so a malformed write can't blow up the row.
  colors JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(colors) = 'array' AND jsonb_array_length(colors) <= 24),

  -- Typography: array of { role, family, url }. Same shape rules.
  typography JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(typography) = 'array' AND jsonb_array_length(typography) <= 12),

  -- Guidelines: either an uploaded PDF (url points into the
  -- brand-assets bucket) or an external URL.
  guidelines_url TEXT,

  -- Voice/tone notes. Capped at 1000 chars in code; constraint here
  -- protects the row from a runaway write.
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 4000),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_brand_kits_updated_at
  BEFORE UPDATE ON brand_kits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;

-- Org members can always read their own org's kit.
DROP POLICY IF EXISTS "Org members read brand_kits" ON brand_kits;
CREATE POLICY "Org members read brand_kits"
  ON brand_kits FOR SELECT
  USING (is_org_member(org_id));

-- Creators with an active (not cancelled / not rejected) claim on
-- any of the org's briefs can read the kit. We deliberately include
-- pending claims so creators see the brand kit while their claim is
-- being reviewed; reviewers commonly turn it around quickly and
-- creators can start scoping work.
DROP POLICY IF EXISTS "Claimed creators read brand_kits" ON brand_kits;
CREATE POLICY "Claimed creators read brand_kits"
  ON brand_kits FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM claims c
      JOIN briefs b ON b.id = c.brief_id
      WHERE b.org_id = brand_kits.org_id
        AND c.user_id = auth.uid()
        AND c.status IN ('pending', 'approved', 'submitted')
    )
  );

-- Only org admins manage the kit. Members read but can't edit so the
-- kit stays consistent with the rest of the org's identity surface.
DROP POLICY IF EXISTS "Org admins write brand_kits" ON brand_kits;
CREATE POLICY "Org admins write brand_kits"
  ON brand_kits FOR ALL
  USING (is_org_admin(org_id))
  WITH CHECK (is_org_admin(org_id));

-- ============================================================
-- Storage bucket: brand-assets
-- ============================================================
-- Private bucket. Same access pattern as `submissions` (0035) and
-- `org-logos` (0031): no user-facing RLS policies on storage.objects
-- for this bucket. Every read and write goes through a server action
-- that holds the service-role client, enforces the right permission
-- (org-admin for writes, org-member or claimed-creator for reads),
-- and mints a short-TTL signed URL on read.
--
-- Path convention (enforced by the server action, not the bucket):
--   brand-assets/{org_id}/logos/{slot}-{ts}.{ext}
--   brand-assets/{org_id}/guidelines-{ts}.pdf
--
-- Limits:
--   * 10 MB per file. Comfortable for SVG/PNG/JPEG/WebP logos and
--     for typical brand-guidelines PDFs (under 30 pages, normal
--     image density). If we ever need bigger, raise the cap and
--     consider switching guidelines uploads to the signed-URL
--     direct-upload pattern (CF Workers caps a single request at
--     100 MB; service-action upload tops out around there).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  FALSE,
  10 * 1024 * 1024,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/webp',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
