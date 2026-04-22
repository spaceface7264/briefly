-- Add is_ad_intended column to briefs
-- This indicates that the content produced will likely be used as paid advertising

ALTER TABLE briefs ADD COLUMN is_ad_intended BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for filtering
CREATE INDEX idx_briefs_is_ad_intended ON briefs(is_ad_intended);
