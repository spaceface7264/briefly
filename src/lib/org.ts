import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the active org_id for the current user.
 * If active_org_id is null, falls back to the user's first membership
 * and sets it on the profile so future calls are fast.
 * Returns null only if not authenticated or has no memberships.
 */
export async function getActiveOrg(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .single();

  if (data?.active_org_id) return data.active_org_id;

  // Fallback: find first membership and set it as active
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership?.org_id) return null;

  // Auto-set active org for next time
  await supabase
    .from("profiles")
    .update({ active_org_id: membership.org_id })
    .eq("id", user.id);

  return membership.org_id;
}

/**
 * Returns the active org_id, redirecting to /discover if not available.
 * Use in authenticated server pages where org context is required.
 */
export async function requireActiveOrg(
  supabase: SupabaseClient
): Promise<string> {
  const orgId = await getActiveOrg(supabase);
  if (!orgId) redirect("/discover");
  return orgId;
}

/**
 * Returns full org row for the current user's active org.
 */
export async function getActiveOrgDetails(supabase: SupabaseClient) {
  const orgId = await getActiveOrg(supabase);
  if (!orgId) return null;

  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  return data;
}

/**
 * Guard for server actions that require org admin access.
 * Returns the supabase client, userId, and orgId on success.
 */
export async function requireOrgAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }

  const orgId = await getActiveOrg(supabase);
  if (!orgId) {
    return { ok: false as const, error: "No active organization" };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();

  if (membership?.role !== "admin") {
    return { ok: false as const, error: "Admin access required" };
  }

  return { ok: true as const, supabase, userId: user.id, orgId };
}
