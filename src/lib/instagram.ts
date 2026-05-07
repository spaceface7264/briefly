/**
 * Helpers for working with creator Instagram handles.
 *
 * Handles in `profiles.instagram_handle` are stored *bare* — no `@`,
 * no `https://instagram.com/` prefix, no trailing slash. Existing
 * rows pre-date this normalisation, so the read-time helper
 * (`instagramProfileUrl`) is forgiving: it cleans the value defensively
 * before constructing the link. New writes go through
 * `normalizeInstagramHandle` which is strict and rejects anything
 * that doesn't look like a real Instagram username.
 */

// Instagram allows letters, numbers, periods, and underscores; cap is
// 30 characters. We use this both to validate write input and to know
// when a defensively-cleaned read value is safe to link out to.
const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

/**
 * Strip the parts of a handle that often come along when users paste:
 * leading `@`, full Instagram URLs (with or without `www`), and any
 * trailing slashes or query strings. Returns the bare handle in
 * lowercase or `null` if nothing usable is left.
 */
function cleanHandle(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  // Strip URL prefix variants. We only need to handle the canonical
  // hosts — anything else and we'd rather reject than silently keep.
  value = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^instagr\.am\//i, "");

  // Strip a leading `@`, trailing slash, and anything after a `?`
  // (some share links come with `?utm_source=...`).
  value = value.replace(/^@+/, "");
  const queryIndex = value.indexOf("?");
  if (queryIndex !== -1) value = value.slice(0, queryIndex);
  value = value.replace(/\/+$/, "");

  return value || null;
}

/**
 * Strict normaliser used at write time. Returns the bare lowercase
 * handle if the input looks like a real Instagram username, otherwise
 * `null` so the caller can decide whether to clear the column or
 * surface a validation error.
 */
export function normalizeInstagramHandle(
  input: string | null | undefined
): string | null {
  if (input == null) return null;
  const cleaned = cleanHandle(input);
  if (!cleaned) return null;
  if (!HANDLE_PATTERN.test(cleaned)) return null;
  return cleaned.toLowerCase();
}

/**
 * Build a public Instagram profile URL from a stored handle. Cleans
 * the value defensively so legacy rows (with `@` prefixes or full
 * URLs in them) still produce a valid link. Returns `null` when the
 * value can't be coerced into something safe to link to.
 */
export function instagramProfileUrl(
  handle: string | null | undefined
): string | null {
  if (handle == null) return null;
  const cleaned = cleanHandle(handle);
  if (!cleaned) return null;
  // Skip the strict pattern check on read so legacy values that don't
  // strictly match (e.g. someone typed an emoji once) still link
  // out — Instagram itself will redirect or 404 gracefully.
  return `https://instagram.com/${cleaned}`;
}

/**
 * Display form of a stored handle. Strips defensively (so rows with
 * `@` prefixes from before normalisation render correctly) and
 * returns the bare handle without an `@`. UI code is expected to
 * prepend `@` itself when it wants the visual marker.
 */
export function instagramDisplayHandle(
  handle: string | null | undefined
): string | null {
  if (handle == null) return null;
  return cleanHandle(handle);
}
