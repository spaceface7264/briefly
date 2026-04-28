import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type AccountType = "creator" | "org";

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
  return value === "org" ? "org" : value === "creator" ? "creator" : null;
}

/**
 * Server-side guard: redirects org users to /admin (their shell).
 * Use at the top of any creator-only page (browse briefs, claim,
 * my-briefs, payouts, etc.).
 */
export async function requireCreatorAccount(
  supabase: SupabaseClient
): Promise<void> {
  const accountType = await getAccountType(supabase);
  if (accountType === "org") {
    redirect("/admin");
  }
}

/**
 * Server-side guard: redirects creator users to /briefs (their shell).
 * Use at the top of any org-only page (admin/* surface).
 */
export async function requireOrgAccount(
  supabase: SupabaseClient
): Promise<void> {
  const accountType = await getAccountType(supabase);
  if (accountType === "creator") {
    redirect("/briefs");
  }
}

/**
 * Returns the canonical landing path for an account type.
 * Used by the login form and root page to route post-auth.
 */
export function landingPathForAccountType(
  accountType: AccountType | null
): string {
  return accountType === "org" ? "/admin" : "/briefs";
}
