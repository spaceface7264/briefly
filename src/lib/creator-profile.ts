/**
 * Controlled vocabularies and validation caps for the creator
 * profile MVP (skills, languages, country, bio).
 *
 * Lives in `src/lib/` rather than under `src/app/profile/` so it
 * can be shared by the editor (creator side, in /profile/settings)
 * and the read surfaces (admin side, in /admin/creators*).
 *
 * The DB-level caps are enforced in `0042_creator_profile_fields.sql`
 * via CHECK constraints. The values here MUST match those caps; if
 * we widen one side without the other, the form will silently
 * accept input the DB then rejects.
 */

// Bio max length in characters. Mirrors the CHECK constraint on
// profiles.bio. Counter in the editor shows `current/max`.
export const BIO_MAX = 500;

// Per-profile picks. Vocab arrays below are larger; users pick
// from them up to these caps.
export const SKILLS_MAX = 12;
export const LANGUAGES_MAX = 8;

// 2 MB. Mirrors the file_size_limit on the `avatars` bucket from
// 0042. Server action and DB both reject heavier uploads; the
// client-side check is a UX nicety, not the security boundary.
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

// Skills vocabulary. Slugs are stable; labels are display-only and
// can change without a migration. When extending: append, don't
// rewrite slugs (existing profiles store the slug).
export const SKILLS: ReadonlyArray<{ slug: string; label: string }> = [
  { slug: "ugc", label: "UGC" },
  { slug: "photography", label: "Photography" },
  { slug: "videography", label: "Videography" },
  { slug: "video-editing", label: "Video editing" },
  { slug: "motion-graphics", label: "Motion graphics" },
  { slug: "illustration", label: "Illustration" },
  { slug: "design", label: "Design" },
  { slug: "copywriting", label: "Copywriting" },
  { slug: "scriptwriting", label: "Scriptwriting" },
  { slug: "voiceover", label: "Voiceover" },
  { slug: "model", label: "Model" },
  { slug: "presenter", label: "On-camera presenter" },
  { slug: "social-media", label: "Social media management" },
  { slug: "community", label: "Community management" },
  { slug: "audio-production", label: "Audio production" },
];

const SKILL_SLUGS: ReadonlySet<string> = new Set(SKILLS.map((s) => s.slug));

export function isValidSkill(slug: string): boolean {
  return SKILL_SLUGS.has(slug);
}

export function skillLabel(slug: string): string {
  return SKILLS.find((s) => s.slug === slug)?.label ?? slug;
}

// Language vocabulary. ISO-639-1 two-letter codes. Same extension
// rule as skills: append, don't rename.
export const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "da", label: "Danish" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "fi", label: "Finnish" },
  { code: "de", label: "German" },
  { code: "nl", label: "Dutch" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "pl", label: "Polish" },
];

const LANGUAGE_CODES: ReadonlySet<string> = new Set(
  LANGUAGES.map((l) => l.code)
);

export function isValidLanguage(code: string): boolean {
  return LANGUAGE_CODES.has(code);
}

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

// Country vocabulary. ISO-3166 alpha-2 codes paired with the flag
// emoji. Starter list focused on EU + major creator-economy
// markets — enough for the dropdown to feel useful without
// shipping a 250-row dependency. Long-tail countries can be added
// in a follow-up if real usage demands it. The DB column accepts
// any TEXT (it predates this list, used for billing), so a value
// outside this list won't crash anything; it just won't render
// nicely on the admin side.
export const COUNTRIES: ReadonlyArray<{
  code: string;
  label: string;
  flag: string;
}> = [
  { code: "DK", label: "Denmark", flag: "🇩🇰" },
  { code: "SE", label: "Sweden", flag: "🇸🇪" },
  { code: "NO", label: "Norway", flag: "🇳🇴" },
  { code: "FI", label: "Finland", flag: "🇫🇮" },
  { code: "IS", label: "Iceland", flag: "🇮🇸" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
  { code: "NL", label: "Netherlands", flag: "🇳🇱" },
  { code: "BE", label: "Belgium", flag: "🇧🇪" },
  { code: "FR", label: "France", flag: "🇫🇷" },
  { code: "ES", label: "Spain", flag: "🇪🇸" },
  { code: "IT", label: "Italy", flag: "🇮🇹" },
  { code: "PT", label: "Portugal", flag: "🇵🇹" },
  { code: "IE", label: "Ireland", flag: "🇮🇪" },
  { code: "AT", label: "Austria", flag: "🇦🇹" },
  { code: "CH", label: "Switzerland", flag: "🇨🇭" },
  { code: "PL", label: "Poland", flag: "🇵🇱" },
  { code: "CZ", label: "Czech Republic", flag: "🇨🇿" },
  { code: "HU", label: "Hungary", flag: "🇭🇺" },
  { code: "EE", label: "Estonia", flag: "🇪🇪" },
  { code: "LV", label: "Latvia", flag: "🇱🇻" },
  { code: "LT", label: "Lithuania", flag: "🇱🇹" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "NZ", label: "New Zealand", flag: "🇳🇿" },
  { code: "JP", label: "Japan", flag: "🇯🇵" },
  { code: "SG", label: "Singapore", flag: "🇸🇬" },
  { code: "BR", label: "Brazil", flag: "🇧🇷" },
];

const COUNTRY_CODES: ReadonlySet<string> = new Set(
  COUNTRIES.map((c) => c.code)
);

export function isValidCountry(code: string): boolean {
  return COUNTRY_CODES.has(code);
}

export function countryLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const entry = COUNTRIES.find((c) => c.code === code);
  return entry ? `${entry.flag} ${entry.label}` : code;
}

export function countryFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRIES.find((c) => c.code === code)?.flag ?? null;
}

/**
 * Filter an array of skill slugs down to the controlled vocab and
 * cap. Used server-side in the save action; the editor calls the
 * same function client-side to keep the chip picker honest.
 *
 * Drops unknown slugs silently; this matches the brand-kit
 * sanitiser (`sanitizeColors` / `sanitizeTypography`) — the rule
 * is "the database row stays consistent even if a malformed
 * client request slips through".
 */
export function sanitizeSkills(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!isValidSkill(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= SKILLS_MAX) break;
  }
  return out;
}

export function sanitizeLanguages(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!isValidLanguage(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= LANGUAGES_MAX) break;
  }
  return out;
}
