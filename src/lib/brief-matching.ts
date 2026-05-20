/**
 * Soft-match scoring between a brief's targeting criteria and a
 * creator's profile. Used to rank /briefs for each creator. Briefs
 * with no targeting are treated as "open to anyone" — they get a
 * neutral score so they don't sink to the bottom of the list.
 *
 * Hard filtering is intentionally avoided: a creator whose profile
 * doesn't overlap a brief still sees it, just lower in the feed. The
 * approval gate (claim review) is where orgs hard-screen, not
 * discoverability.
 */

export interface BriefMatchInput {
  target_skills: string[];
  target_languages: string[];
  target_countries: string[];
}

export interface CreatorMatchInput {
  skills: string[];
  languages: string[];
  country: string | null;
}

export interface BriefMatchResult {
  /** 0..1 — fraction of targeted dimensions the creator hit. Used
   *  for sort order and badge thresholds. */
  score: number;
  /** Number of overlapping items across all dimensions. Tiebreaker
   *  in the sort: higher overlap wins at equal score. */
  overlapCount: number;
  /** True when the brief specifies any targeting at all. */
  hasTargeting: boolean;
}

/**
 * Score a single brief against a creator's profile.
 *
 * Algorithm: count matches across the three targeted dimensions,
 * weighted equally. Each dimension contributes between 0 and 1:
 *   - skills:    |target ∩ creator| / |target|       (0 if target empty)
 *   - languages: |target ∩ creator| / |target|       (0 if target empty)
 *   - countries: 1 if creator.country ∈ target else 0 (0 if target empty)
 *
 * Score is the unweighted mean over the dimensions that actually
 * have targeting. A brief targeting only skills gets scored only on
 * skill overlap, not penalised for not specifying language.
 *
 * Edge cases:
 *   - No targeting at all: score = 0, hasTargeting = false. Ranking
 *     places these between "matched" and "non-matched" briefs.
 *   - Creator profile fully empty: every dimension scores 0 for any
 *     targeted brief, which is correct — they haven't told us
 *     anything to match on.
 */
export function scoreBriefForCreator(
  brief: BriefMatchInput,
  creator: CreatorMatchInput
): BriefMatchResult {
  const briefSkills = brief.target_skills ?? [];
  const briefLanguages = brief.target_languages ?? [];
  const briefCountries = brief.target_countries ?? [];

  const hasTargeting =
    briefSkills.length > 0 ||
    briefLanguages.length > 0 ||
    briefCountries.length > 0;

  if (!hasTargeting) {
    return { score: 0, overlapCount: 0, hasTargeting: false };
  }

  const creatorSkills = new Set(creator.skills ?? []);
  const creatorLanguages = new Set(creator.languages ?? []);

  let dimensions = 0;
  let total = 0;
  let overlapCount = 0;

  if (briefSkills.length > 0) {
    dimensions += 1;
    const overlap = briefSkills.filter((s) => creatorSkills.has(s)).length;
    overlapCount += overlap;
    total += overlap / briefSkills.length;
  }
  if (briefLanguages.length > 0) {
    dimensions += 1;
    const overlap = briefLanguages.filter((l) =>
      creatorLanguages.has(l)
    ).length;
    overlapCount += overlap;
    total += overlap / briefLanguages.length;
  }
  if (briefCountries.length > 0) {
    dimensions += 1;
    const inCountry =
      creator.country !== null && briefCountries.includes(creator.country);
    if (inCountry) {
      overlapCount += 1;
      total += 1;
    }
  }

  return {
    score: dimensions > 0 ? total / dimensions : 0,
    overlapCount,
    hasTargeting: true,
  };
}

/**
 * Sort comparator for ranking a list of briefs by match score
 * against a single creator. Three buckets, descending:
 *
 *   1. Targeted briefs the creator overlaps (score > 0), best first.
 *   2. Untargeted briefs ("open to anyone"), newest first.
 *   3. Targeted briefs the creator doesn't overlap, newest first.
 *
 * Inside bucket 1, ties on score break by `overlapCount` (more raw
 * matches wins), then by `created_at` (newer wins).
 */
export interface RankedBrief<T> {
  brief: T;
  match: BriefMatchResult;
}

export function rankBriefsForCreator<
  T extends BriefMatchInput & { created_at: string }
>(briefs: T[], creator: CreatorMatchInput): RankedBrief<T>[] {
  const scored = briefs.map((brief) => ({
    brief,
    match: scoreBriefForCreator(brief, creator),
  }));

  scored.sort((a, b) => {
    const bucketA = bucketOf(a.match);
    const bucketB = bucketOf(b.match);
    if (bucketA !== bucketB) return bucketA - bucketB;

    if (bucketA === 0) {
      if (a.match.score !== b.match.score) return b.match.score - a.match.score;
      if (a.match.overlapCount !== b.match.overlapCount) {
        return b.match.overlapCount - a.match.overlapCount;
      }
    }

    // Newer first within the bucket.
    return a.brief.created_at < b.brief.created_at ? 1 : -1;
  });

  return scored;
}

function bucketOf(match: BriefMatchResult): 0 | 1 | 2 {
  if (match.hasTargeting && match.score > 0) return 0;
  if (!match.hasTargeting) return 1;
  return 2;
}

/**
 * Threshold helper for the UI badge. "Strong" matches surface a
 * highlighted badge; weak partial matches get a softer treatment.
 */
export function matchBadgeTone(match: BriefMatchResult): "strong" | "partial" | null {
  if (!match.hasTargeting || match.score <= 0) return null;
  return match.score >= 0.5 ? "strong" : "partial";
}
