-- Rename the gym column to location for genericization
ALTER TABLE briefs RENAME COLUMN gym TO location;

DROP INDEX IF EXISTS idx_briefs_gym;
CREATE INDEX idx_briefs_location ON briefs(location);
