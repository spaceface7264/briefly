-- Brief targeting criteria
--
-- Adds the per-brief "looking for" fields so /briefs can rank open
-- briefs against the viewing creator's profile. All three columns
-- are nullable text arrays, defaulting to empty — an empty array
-- means "no targeting on this dimension" and contributes neither
-- match-credit nor demerit to the score.
--
-- This is deliberately *soft* matching, not a hard filter. A creator
-- whose skills don't overlap a brief's target_skills still sees the
-- brief; it's just ranked lower than briefs they're a closer fit for.
-- Hard filtering belongs in the brand's claim-review step, not in
-- discoverability.
--
-- Vocabulary alignment (enforced in the brief form, not the DB):
--   target_skills    — slugs from SKILLS  in src/lib/creator-profile.ts
--   target_languages — ISO-639-1 codes from LANGUAGES
--   target_countries — ISO-3166-1 alpha-2 codes from COUNTRIES
--
-- Caps mirror the per-creator caps so the form UX stays symmetric.

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS target_skills TEXT[]
    NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(target_skills) <= 12);

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS target_languages TEXT[]
    NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(target_languages) <= 8);

ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS target_countries TEXT[]
    NOT NULL DEFAULT '{}'::text[]
    CHECK (cardinality(target_countries) <= 30);

-- RLS: no policy changes needed. The new columns inherit the
-- existing briefs policies (org-scoped read/write from 0017 + 0034).

-- Index notes: we don't add GIN indexes on these arrays yet. The
-- /briefs query already filters by org_id + status='open', which
-- keeps the working set small (a few hundred rows per org at the
-- ceiling). Matching score is computed in app code, not via SQL
-- array operators. Revisit if/when we move to a cross-org open feed
-- and need to push the filter into the database.
