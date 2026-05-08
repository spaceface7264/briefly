-- Migration: Cleanup dead columns and add missing RLS policies
-- Drop dead columns from briefs (moved to claims table in 0002)
--
-- 0001 created the policy "Creators can claim open briefs" with a
-- WITH CHECK clause that references claimed_by / claimed_at /
-- claim_expires_at. 0002 replaced the per-claim model with the
-- separate `claims` table but left this UPDATE policy in place,
-- so dropping the columns here errors with 2BP01 unless we drop
-- the policy first. Idempotent on already-cleaned environments.

DROP POLICY IF EXISTS "Creators can claim open briefs" ON briefs;

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
