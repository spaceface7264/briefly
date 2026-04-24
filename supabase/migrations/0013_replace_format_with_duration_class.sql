CREATE TYPE brief_duration_class AS ENUM ('short', 'medium', 'long', 'static');

ALTER TABLE briefs
ADD COLUMN duration_class brief_duration_class;

UPDATE briefs
SET duration_class = CASE format
  WHEN 'long_form' THEN 'long'::brief_duration_class
  WHEN 'photo' THEN 'static'::brief_duration_class
  ELSE 'short'::brief_duration_class
END;

ALTER TABLE briefs
ALTER COLUMN duration_class SET NOT NULL;

CREATE INDEX idx_briefs_duration_class ON briefs(duration_class);

DROP INDEX IF EXISTS idx_briefs_format;

ALTER TABLE briefs
DROP COLUMN format;

DROP TYPE brief_format;
