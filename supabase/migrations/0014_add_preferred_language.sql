-- Store each user's preferred UI language so logged-in users see a consistent
-- locale across devices. NULL means "not chosen" — app falls back to cookie or
-- the default locale ('en').

ALTER TABLE profiles
ADD COLUMN preferred_language TEXT;

ALTER TABLE profiles
ADD CONSTRAINT profiles_preferred_language_check
CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'da'));
