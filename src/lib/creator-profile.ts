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
// ISO-639-1 — the two-letter language codes. Covers the global set
// of named languages (~184 entries). Sorted alphabetically by English
// label so the picker reads naturally. Storage is the 2-letter `code`;
// `label` is read-time presentation.
export const LANGUAGES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "ab", label: "Abkhazian" },
  { code: "aa", label: "Afar" },
  { code: "af", label: "Afrikaans" },
  { code: "ak", label: "Akan" },
  { code: "sq", label: "Albanian" },
  { code: "am", label: "Amharic" },
  { code: "ar", label: "Arabic" },
  { code: "an", label: "Aragonese" },
  { code: "hy", label: "Armenian" },
  { code: "as", label: "Assamese" },
  { code: "av", label: "Avaric" },
  { code: "ae", label: "Avestan" },
  { code: "ay", label: "Aymara" },
  { code: "az", label: "Azerbaijani" },
  { code: "bm", label: "Bambara" },
  { code: "ba", label: "Bashkir" },
  { code: "eu", label: "Basque" },
  { code: "be", label: "Belarusian" },
  { code: "bn", label: "Bengali" },
  { code: "bh", label: "Bihari" },
  { code: "bi", label: "Bislama" },
  { code: "bs", label: "Bosnian" },
  { code: "br", label: "Breton" },
  { code: "bg", label: "Bulgarian" },
  { code: "my", label: "Burmese" },
  { code: "ca", label: "Catalan" },
  { code: "ch", label: "Chamorro" },
  { code: "ce", label: "Chechen" },
  { code: "ny", label: "Chichewa" },
  { code: "zh", label: "Chinese" },
  { code: "cu", label: "Church Slavonic" },
  { code: "cv", label: "Chuvash" },
  { code: "kw", label: "Cornish" },
  { code: "co", label: "Corsican" },
  { code: "cr", label: "Cree" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "dv", label: "Divehi" },
  { code: "nl", label: "Dutch" },
  { code: "dz", label: "Dzongkha" },
  { code: "en", label: "English" },
  { code: "eo", label: "Esperanto" },
  { code: "et", label: "Estonian" },
  { code: "ee", label: "Ewe" },
  { code: "fo", label: "Faroese" },
  { code: "fj", label: "Fijian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "ff", label: "Fulah" },
  { code: "gd", label: "Gaelic" },
  { code: "gl", label: "Galician" },
  { code: "lg", label: "Ganda" },
  { code: "ka", label: "Georgian" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "kl", label: "Greenlandic" },
  { code: "gn", label: "Guarani" },
  { code: "gu", label: "Gujarati" },
  { code: "ht", label: "Haitian Creole" },
  { code: "ha", label: "Hausa" },
  { code: "he", label: "Hebrew" },
  { code: "hz", label: "Herero" },
  { code: "hi", label: "Hindi" },
  { code: "ho", label: "Hiri Motu" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "io", label: "Ido" },
  { code: "ig", label: "Igbo" },
  { code: "id", label: "Indonesian" },
  { code: "ia", label: "Interlingua" },
  { code: "ie", label: "Interlingue" },
  { code: "iu", label: "Inuktitut" },
  { code: "ik", label: "Inupiaq" },
  { code: "ga", label: "Irish" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "jv", label: "Javanese" },
  { code: "kn", label: "Kannada" },
  { code: "kr", label: "Kanuri" },
  { code: "ks", label: "Kashmiri" },
  { code: "kk", label: "Kazakh" },
  { code: "km", label: "Khmer" },
  { code: "ki", label: "Kikuyu" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "ky", label: "Kyrgyz" },
  { code: "kv", label: "Komi" },
  { code: "kg", label: "Kongo" },
  { code: "ko", label: "Korean" },
  { code: "kj", label: "Kuanyama" },
  { code: "ku", label: "Kurdish" },
  { code: "lo", label: "Lao" },
  { code: "la", label: "Latin" },
  { code: "lv", label: "Latvian" },
  { code: "li", label: "Limburgish" },
  { code: "ln", label: "Lingala" },
  { code: "lt", label: "Lithuanian" },
  { code: "lu", label: "Luba-Katanga" },
  { code: "lb", label: "Luxembourgish" },
  { code: "mk", label: "Macedonian" },
  { code: "mg", label: "Malagasy" },
  { code: "ms", label: "Malay" },
  { code: "ml", label: "Malayalam" },
  { code: "mt", label: "Maltese" },
  { code: "gv", label: "Manx" },
  { code: "mi", label: "Maori" },
  { code: "mr", label: "Marathi" },
  { code: "mh", label: "Marshallese" },
  { code: "mn", label: "Mongolian" },
  { code: "na", label: "Nauru" },
  { code: "nv", label: "Navajo" },
  { code: "nd", label: "Ndebele, North" },
  { code: "nr", label: "Ndebele, South" },
  { code: "ng", label: "Ndonga" },
  { code: "ne", label: "Nepali" },
  { code: "se", label: "Northern Sami" },
  { code: "no", label: "Norwegian" },
  { code: "nb", label: "Norwegian Bokmål" },
  { code: "nn", label: "Norwegian Nynorsk" },
  { code: "oc", label: "Occitan" },
  { code: "oj", label: "Ojibwa" },
  { code: "or", label: "Oriya" },
  { code: "om", label: "Oromo" },
  { code: "os", label: "Ossetian" },
  { code: "pi", label: "Pali" },
  { code: "ps", label: "Pashto" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pa", label: "Punjabi" },
  { code: "qu", label: "Quechua" },
  { code: "ro", label: "Romanian" },
  { code: "rm", label: "Romansh" },
  { code: "rn", label: "Rundi" },
  { code: "ru", label: "Russian" },
  { code: "sm", label: "Samoan" },
  { code: "sg", label: "Sango" },
  { code: "sa", label: "Sanskrit" },
  { code: "sc", label: "Sardinian" },
  { code: "sr", label: "Serbian" },
  { code: "sn", label: "Shona" },
  { code: "ii", label: "Sichuan Yi" },
  { code: "sd", label: "Sindhi" },
  { code: "si", label: "Sinhala" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "so", label: "Somali" },
  { code: "st", label: "Sotho, Southern" },
  { code: "es", label: "Spanish" },
  { code: "su", label: "Sundanese" },
  { code: "sw", label: "Swahili" },
  { code: "ss", label: "Swati" },
  { code: "sv", label: "Swedish" },
  { code: "tl", label: "Tagalog" },
  { code: "ty", label: "Tahitian" },
  { code: "tg", label: "Tajik" },
  { code: "ta", label: "Tamil" },
  { code: "tt", label: "Tatar" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "bo", label: "Tibetan" },
  { code: "ti", label: "Tigrinya" },
  { code: "to", label: "Tongan" },
  { code: "ts", label: "Tsonga" },
  { code: "tn", label: "Tswana" },
  { code: "tr", label: "Turkish" },
  { code: "tk", label: "Turkmen" },
  { code: "tw", label: "Twi" },
  { code: "ug", label: "Uighur" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "uz", label: "Uzbek" },
  { code: "ve", label: "Venda" },
  { code: "vi", label: "Vietnamese" },
  { code: "vo", label: "Volapük" },
  { code: "wa", label: "Walloon" },
  { code: "cy", label: "Welsh" },
  { code: "fy", label: "Western Frisian" },
  { code: "wo", label: "Wolof" },
  { code: "xh", label: "Xhosa" },
  { code: "yi", label: "Yiddish" },
  { code: "yo", label: "Yoruba" },
  { code: "za", label: "Zhuang" },
  { code: "zu", label: "Zulu" },
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

/** Brief-side cap on `target_countries`. Mirrors COUNTRIES length so
 *  an org can in principle target the full set without hitting the
 *  cap, but rejects garbage payloads claiming more. */
export const COUNTRIES_MAX = 30;

export function sanitizeCountries(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!isValidCountry(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= COUNTRIES_MAX) break;
  }
  return out;
}
