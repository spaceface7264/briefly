/**
 * Helpers for working with creator social handles.
 *
 * Handles live in `profiles.social_handles` as a JSONB object keyed by
 * platform slug, e.g. `{ instagram: "rami", tiktok: "rami.creates" }`.
 * Values are stored *bare* — no `@`, no URL prefix, no trailing slash.
 * The DB only guarantees the column is an object; the slug allow-list
 * and per-platform validation live here so adding a new platform is a
 * code change, not a migration.
 *
 * Read-time helpers (`socialProfileUrl`, `socialDisplayHandle`) are
 * forgiving so legacy rows with stray `@`s or full URLs still render.
 * Write-time helpers (`normalizeSocialHandle`) are strict and reject
 * input that doesn't look like a real username/URL.
 */
export type SocialPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "threads"
  | "pinterest"
  | "twitch"
  | "linkedin"
  | "substack"
  | "website";

type PlatformConfig = {
  label: string;
  /** Hosts we strip from pasted URLs before validating. First entry is
   *  used to build the canonical profile URL. */
  hosts: string[];
  /** Bare-handle pattern. `website` is the exception — it stores a full
   *  URL and skips handle validation entirely. */
  pattern?: RegExp;
  /** When true, store the value as a URL and link out directly. */
  isUrl?: boolean;
  /** Prefix added before the bare handle to form the profile URL.
   *  YouTube channel handles use `@`, everyone else doesn't. */
  handlePrefix?: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "youtube",
  "x",
  "threads",
  "pinterest",
  "twitch",
  "linkedin",
  "substack",
  "website",
];

const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    label: "Instagram",
    hosts: ["instagram.com", "instagr.am"],
    pattern: /^[A-Za-z0-9._]{1,30}$/,
  },
  tiktok: {
    label: "TikTok",
    hosts: ["tiktok.com"],
    pattern: /^[A-Za-z0-9._]{2,24}$/,
  },
  youtube: {
    label: "YouTube",
    hosts: ["youtube.com", "youtu.be"],
    // YouTube channel handles are 3–30 chars, letters/numbers/dots/dashes/underscores.
    pattern: /^[A-Za-z0-9._-]{3,30}$/,
    handlePrefix: "@",
  },
  x: {
    label: "X (Twitter)",
    hosts: ["x.com", "twitter.com"],
    pattern: /^[A-Za-z0-9_]{1,15}$/,
  },
  threads: {
    label: "Threads",
    hosts: ["threads.net", "threads.com"],
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    handlePrefix: "@",
  },
  pinterest: {
    label: "Pinterest",
    hosts: ["pinterest.com"],
    pattern: /^[A-Za-z0-9_]{3,30}$/,
  },
  twitch: {
    label: "Twitch",
    hosts: ["twitch.tv"],
    pattern: /^[A-Za-z0-9_]{4,25}$/,
  },
  linkedin: {
    label: "LinkedIn",
    // LinkedIn URLs use /in/<handle> for personal profiles.
    hosts: ["linkedin.com/in", "linkedin.com"],
    pattern: /^[A-Za-z0-9-]{3,100}$/,
  },
  substack: {
    label: "Substack",
    // Substack publications live at <handle>.substack.com, not /<handle>.
    // We still store the bare subdomain and build the URL from it.
    hosts: ["substack.com"],
    pattern: /^[A-Za-z0-9-]{1,40}$/,
  },
  website: {
    label: "Website",
    hosts: [],
    isUrl: true,
  },
};

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(value);
}

/**
 * True when at least one supported platform has a non-empty handle.
 * Useful for guarding "show socials" UI without rendering a wrapper
 * around an empty list.
 */
export function hasSocials(raw: unknown): boolean {
  const handles = readSocialHandles(raw);
  return Object.keys(handles).length > 0;
}

export function socialLabel(platform: SocialPlatform): string {
  return PLATFORM_CONFIG[platform].label;
}

/**
 * Parse a free-form `social_handles` value (Json from the DB) into a
 * typed map. Drops unknown keys and non-string values. Returns an
 * empty object for null/undefined/anything else.
 */
export function readSocialHandles(
  raw: unknown
): Partial<Record<SocialPlatform, string>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<SocialPlatform, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSocialPlatform(key)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = trimmed;
  }
  return out;
}

function cleanHandle(
  platform: SocialPlatform,
  input: string
): string | null {
  let value = input.trim();
  if (!value) return null;

  const cfg = PLATFORM_CONFIG[platform];

  if (cfg.isUrl) {
    // Websites store the full URL. Be liberal: accept bare domains
    // ("example.com") and prepend https:// so the link works.
    if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
    try {
      const url = new URL(value);
      return url.toString().replace(/\/+$/, "");
    } catch {
      return null;
    }
  }

  // Strip URL prefix variants for the canonical hosts.
  value = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "");

  for (const host of cfg.hosts) {
    const re = new RegExp(`^${host.replace(/\./g, "\\.")}/`, "i");
    if (re.test(value)) {
      value = value.replace(re, "");
      break;
    }
  }

  value = value.replace(/^@+/, "");
  const queryIndex = value.indexOf("?");
  if (queryIndex !== -1) value = value.slice(0, queryIndex);
  value = value.replace(/\/+$/, "");

  return value || null;
}

/**
 * Strict normaliser used at write time. Returns the canonical stored
 * form (bare handle, or full URL for `website`) if the input looks
 * valid, otherwise `null`.
 */
export function normalizeSocialHandle(
  platform: SocialPlatform,
  input: string | null | undefined
): string | null {
  if (input == null) return null;
  const cleaned = cleanHandle(platform, input);
  if (!cleaned) return null;
  const cfg = PLATFORM_CONFIG[platform];
  if (cfg.isUrl) return cleaned;
  if (cfg.pattern && !cfg.pattern.test(cleaned)) return null;
  // Lower-case bare handles for consistency. URLs (website) keep
  // their casing — paths can be case-sensitive.
  return cleaned.toLowerCase();
}

/**
 * Build a public profile URL for a stored handle. Forgiving — cleans
 * the value defensively so legacy rows still link out. Returns null
 * when the value can't be coerced into anything safe to link to.
 */
export function socialProfileUrl(
  platform: SocialPlatform,
  handle: string | null | undefined
): string | null {
  if (handle == null) return null;
  const cleaned = cleanHandle(platform, handle);
  if (!cleaned) return null;
  const cfg = PLATFORM_CONFIG[platform];

  if (cfg.isUrl) return cleaned;

  switch (platform) {
    case "substack":
      return `https://${cleaned}.substack.com`;
    case "linkedin":
      return `https://linkedin.com/in/${cleaned}`;
    case "youtube":
      return `https://youtube.com/@${cleaned}`;
    case "threads":
      return `https://threads.net/@${cleaned}`;
    case "tiktok":
      return `https://tiktok.com/@${cleaned}`;
    case "twitch":
      return `https://twitch.tv/${cleaned}`;
    case "pinterest":
      return `https://pinterest.com/${cleaned}`;
    case "x":
      return `https://x.com/${cleaned}`;
    case "instagram":
      return `https://instagram.com/${cleaned}`;
    case "website":
      return cleaned;
  }
}

/**
 * Display form of a stored handle. Strips defensively so legacy rows
 * with `@` prefixes still render correctly. Adds the platform's
 * visual `@` prefix when one applies (e.g. `@rami` for YouTube).
 * Websites display the host only ("rami.dev") for compactness.
 */
export function socialDisplayHandle(
  platform: SocialPlatform,
  handle: string | null | undefined
): string | null {
  if (handle == null) return null;
  const cleaned = cleanHandle(platform, handle);
  if (!cleaned) return null;
  const cfg = PLATFORM_CONFIG[platform];

  if (cfg.isUrl) {
    try {
      const url = new URL(cleaned);
      return url.host.replace(/^www\./, "") + (url.pathname === "/" ? "" : url.pathname);
    } catch {
      return cleaned;
    }
  }

  return cfg.handlePrefix ? `${cfg.handlePrefix}${cleaned}` : cleaned;
}

