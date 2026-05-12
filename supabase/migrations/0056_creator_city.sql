-- Creator city
--
-- Adds a freeform city field so creators can advertise their local
-- market (London, Brooklyn, Aarhus). Country alone is too coarse for
-- brands that want neighbourhood-level reach.
--
-- Stored as plain text — no controlled vocabulary. City naming is
-- messy (transliterations, neighbourhood-vs-city, multilingual
-- spellings) and curating an allow-list would be more disservice than
-- service. The 100-char cap is the only guardrail.
--
-- Display order in the UI is "City, Country" so this column pairs
-- with the existing `country` column added in 0007.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT
  CHECK (city IS NULL OR char_length(city) <= 100);

-- RLS: inherits the existing `profiles` policies — self read/write
-- (0017) and org-teammate read (0034). No changes needed.
