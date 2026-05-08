import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the active org_id for the current user.
 *
 * For platform accounts, support_org_id wins, they don't have an
 * "owned" org; they borrow one for the duration of a support session.
 * For org/creator accounts we fall back to the first membership when
 * active_org_id is null and self-heal by writing it back.
 *
 * Returns null only if not authenticated, or for an account type that
 * has no resolvable org context.
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
    .select("account_type, active_org_id, support_org_id")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  if (data.account_type === "platform") {
    return data.support_org_id ?? null;
  }

  if (data.active_org_id) return data.active_org_id;

  // Fallback: find first membership and set it as active. Only for
  // org/creator accounts, platform accounts shouldn't have any.
  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();

  if (!membership?.org_id) return null;

  await supabase
    .from("profiles")
    .update({ active_org_id: membership.org_id })
    .eq("id", user.id);

  return membership.org_id;
}

/**
 * Returns the active org_id, redirecting if not available.
 *
 * Routing on the no-org case depends on account type:
 *   * platform, bounce to /admin/super (their canonical shell;
 *     they enter an org via support mode)
 *   * other   , bounce to /discover (creator without a roster
 *     yet, or org user whose org was deleted out from under them)
 */
export async function requireActiveOrg(
  supabase: SupabaseClient
): Promise<string> {
  const orgId = await getActiveOrg(supabase);
  if (orgId) return orgId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.account_type === "platform") {
      redirect("/admin/super");
    }
  }

  redirect("/discover");
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
 * Reads the active-org membership role for the current user.
 * Returns "admin" | "member" | "creator" | null (null = no active
 * membership in active_org_id, or not authenticated).
 *
 * Use from server components for UI gating decisions like "should
 * this button render?". The server actions themselves still gate
 * via `requireOrgAdmin()`, this is the read-side counterpart so
 * we don't render buttons that would 401 on click.
 */
export async function getOrgRole(
  supabase: SupabaseClient
): Promise<"admin" | "member" | "creator" | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Platform admins scoped into this org via support mode count as
  // admins for UI gating. Server actions still re-verify via
  // requireOrgAdmin() / RLS, so this is purely a render hint.
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, support_org_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_type === "platform" && profile.support_org_id) {
    return "admin";
  }

  const orgId = await getActiveOrg(supabase);
  if (!orgId) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  const role = (membership as { role?: string } | null)?.role;
  if (role === "admin" || role === "member" || role === "creator") {
    return role;
  }
  return null;
}

/**
 * Guard for server actions that require org admin access.
 *
 * Membership-based admin is the normal path. Platform admins are
 * granted equivalent powers when scoped into the active org via
 * support mode, the SQL helper `is_org_admin()` mirrors this on the
 * RLS side so writes go through.
 *
 * Returns the supabase client, userId, orgId, and an `actingAs` flag
 * the caller can pass to platform_audit_log when relevant.
 */
export async function requireOrgAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, active_org_id, support_org_id, is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { ok: false as const, error: "No profile" };
  }

  if (profile.account_type === "platform") {
    if (!profile.is_platform_admin) {
      return { ok: false as const, error: "Platform admin flag required" };
    }
    if (!profile.support_org_id) {
      return { ok: false as const, error: "Enter support mode first" };
    }
    // Platform-support intentionally bypasses the org-status gate
    // below so a suspended org can still be unstuck from inside.
    return {
      ok: true as const,
      supabase,
      userId: user.id,
      orgId: profile.support_org_id,
      actingAs: "platform-support" as const,
    };
  }

  const orgId = profile.active_org_id ?? (await getActiveOrg(supabase));
  if (!orgId) {
    return { ok: false as const, error: "No active organization" };
  }

  const [{ data: membership }, { data: orgRow }] = await Promise.all([
    supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("org_id", orgId)
      .eq("status", "active")
      .single(),
    supabase
      .from("organizations")
      .select("status")
      .eq("id", orgId)
      .maybeSingle(),
  ]);

  if (membership?.role !== "admin") {
    return { ok: false as const, error: "Admin access required" };
  }

  // Org-admin writes are blocked when the org isn't active. Platform
  // admins in support mode took the early-return above and skip this
  // check, so they can still fix things from inside a suspended org.
  if (orgRow && orgRow.status !== "active") {
    return {
      ok: false as const,
      error:
        orgRow.status === "suspended"
          ? "This organization is currently suspended. Contact support."
          : "This organization is archived and read-only.",
    };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    orgId,
    actingAs: "org-admin" as const,
  };
}
