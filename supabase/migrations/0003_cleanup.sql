-- Migration: Cleanup dead columns and add missing RLS policies
-- Drop dead columns from briefs (moved to claims table in 0002)

ALTER TABLE briefs DROP COLUMN IF EXISTS claimed_by;
ALTER TABLE briefs DROP COLUMN IF EXISTS claimed_at;
ALTER TABLE briefs DROP COLUMN IF EXISTS claim_expires_at;

-- Add missing admin UPDATE policy for claims
-- Allows admins to transition claim status (submitted -> approved -> paid)
CREATE POLICY "Admins can update any claim"
  ON claims FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- Add submission fields to claims if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'submission_url'
  ) THEN
    ALTER TABLE claims ADD COLUMN submission_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'claims' AND column_name = 'submission_notes'
  ) THEN
    ALTER TABLE claims ADD COLUMN submission_notes TEXT;
  END IF;
END $$;
