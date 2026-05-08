/**
 * Cookie name prefix used to ferry a single password-reset link from
 * the forcePasswordReset server action to the user detail page render
 * without parking the link in the URL (where it would persist in
 * browser history and Referer headers).
 *
 * Lives in a non-"use server" module because Next 16 only allows
 * async exports from "use server" files; the cookie name needs to be
 * imported by both the action that sets it and the page that reads it.
 */
export const RESET_LINK_COOKIE_PREFIX = "platform-admin-reset-link:";

/** Cookie TTL in seconds. Long enough to survive the redirect + first
 *  paint, short enough that a forgotten browser session doesn't keep
 *  the link recoverable. */
export const RESET_LINK_TTL_SECONDS = 60;
