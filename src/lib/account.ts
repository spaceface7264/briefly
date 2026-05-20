import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type AccountType = "creator" | "org" | "platform";

/**
 * Returns the authenticated user's account_type, or null if not
 * authenticated / no profile row exists yet.
 */
export async function getAccountType(
  supabase: SupabaseClient
): Promise<AccountType | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", user.id)
    .maybeSingle();

  const value = (data as { account_type?: string } | null)?.account_type;
  if (value === "org") return "org";
  if (value === "creator") return "creator";
  if (value === "platform") return "platform";
  return null;
}

/**
 * Server-side guard for creator-only pages. Sends org users to /admin
 * and platform users to /admin/super.
 */
export async function requireCreatorAccount(
  supabase: SupabaseClient
): Promise<void> {
  const accountType = await getAccountType(supabase);
  if (accountType === "org") redirect("/admin");
  if (accountType === "platform") redirect("/admin/super");
}

/**
 * Creator-only gate that also enforces the first-time onboarding
 * flow. Use on the *entry* surfaces a fresh creator might hit
 * (/briefs, /discover, /my-briefs) so they get walked through the
 * interview before browsing. /profile/* deliberately bypasses this —
 * power users who want to edit fields directly can; once they save,
 * `onboarded_at` is stamped and the redirect stops firing.
 *
 * Skips the check when no user is logged in (the outer middleware /
 * page-level auth gate handles redirect-to-login).
 */
export async function requireOnboardedCreator(
  supabase: SupabaseClient
): Promise<void> {
  await requireCreatorAccount(supabase);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  const onboardedAt = (data as { onboarded_at?: string | null } | null)
    ?.onboarded_at;
  if (!onboardedAt) redirect("/onboarding");
}

/**
 * Server-side guard for org-only pages. Sends creators to /briefs and
 * platform users to /admin/super. Platform users in support mode are
 * allowed through, see src/lib/platform.ts → getSupportOrg.
 */
export async function requireOrgAccount(
  supabase: SupabaseClient
): Promise<void> {
  const accountType = await getAccountType(supabase);
  if (accountType === "creator") redirect("/briefs");
  // Platform users only see /admin (org-shell) when scoped into an
  // org via support mode. The admin layout reads support_org_id and
  // bounces them to /admin/super when it isn't set.
}

/**
 * Returns the canonical landing path for an account type.
 * Used by the login form and root page to route post-auth.
 */
export function landingPathForAccountType(
  accountType: AccountType | null
): string {
  if (accountType === "platform") return "/admin/super";
  if (accountType === "org") return "/admin";
  return "/briefs";
}
