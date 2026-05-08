import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Server-side guard: redirects non-platform users away from
 * /admin/super. Use at the top of platform-only pages and at the
 * boundary of any server action that mutates platform state.
 *
 * Platform admin is enforced by both account_type AND the
 * is_platform_admin flag, the column is the long-term source of
 * truth, the flag stays as a kill switch.
 */
export async function requirePlatformAccount(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, is_platform_admin, support_org_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { ok: false as const, error: "No profile" };

  if (profile.account_type !== "platform" || !profile.is_platform_admin) {
    return { ok: false as const, error: "Not a platform admin" };
  }

  return {
    ok: true as const,
    userId: user.id,
    supportOrgId: profile.support_org_id ?? null,
  };
}

/**
 * Returns { orgId, org } for the current platform admin's support
 * session, or null when they're not in support mode. Reads the org
 * row using the admin's RLS-bound client (works because the migration
 * grants platform admins blanket SELECT on organizations).
 */
export async function getSupportOrg(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, support_org_id, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.account_type !== "platform" ||
    !profile.is_platform_admin ||
    !profile.support_org_id
  ) {
    return null;
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, logo_url, accent_color, slug")
    .eq("id", profile.support_org_id)
    .maybeSingle();

  if (!org) return null;
  return { orgId: org.id, org };
}

/**
 * Convenience wrapper that creates the RLS-bound client and runs the
 * platform-account guard in one shot. Use in route handlers / server
 * components that don't already have a supabase client in scope.
 *
 * Redirects to "/" on failure rather than returning, the caller is
 * always rendering or mutating, so there's no useful failure value.
 */
export async function requirePlatformAccountOrRedirect() {
  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) redirect("/");
  return { supabase, userId: gate.userId, supportOrgId: gate.supportOrgId };
}

interface SupportAuditEntry {
  /** Profile id of the platform admin doing the work. */
  actorId: string;
  /** Stable verb in the `<domain>.<action>` shape, e.g. `brief.publish`. */
  action: string;
  /** Org being acted on (the support_org_id at the time of the write). */
  targetOrgId: string;
  /** Optional table name + row id for forensic linkability. */
  targetTable?: string;
  targetRowId?: string;
  /** Human reason, if collected. */
  reason?: string | null;
  /** JSON snapshots before / after the write. Either may be null. */
  before?: Json | null;
  after?: Json | null;
}

/**
 * Best-effort write to platform_audit_log. Call from any server
 * action whose org-scoped guard returned `actingAs: "platform-support"`,
 * after the underlying mutation succeeded but before any redirect /
 * return. Failures are logged to stderr and swallowed so we never
 * roll back a successful (often paid) operation because the audit
 * insert failed.
 *
 * Uses the user's RLS-bound client. The platform_audit_log INSERT
 * policy already gates on `is_platform_admin() AND actor_id = auth.uid()`,
 * so no service-role escalation is required.
 */
export async function logSupportAction(
  supabase: SupabaseClient,
  entry: SupportAuditEntry
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("platform_audit_log") as any).insert({
    actor_id: entry.actorId,
    action: entry.action,
    target_org_id: entry.targetOrgId,
    target_table: entry.targetTable ?? null,
    target_row_id: entry.targetRowId ?? null,
    reason: entry.reason ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
  if (error) {
    console.error("[platform_audit_log] insert failed:", error);
  }
}
