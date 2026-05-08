import Link from "next/link";
import { requirePlatformAccountOrRedirect } from "@/lib/platform";
import { formatDkk } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// Dashboard surfaces operational issues without waiting for a customer
// email. Sections are ordered by money risk, then platform-trust risk:
//   1. Failed payments      — direct revenue loss, creator-facing
//   2. Stuck claims         — slots paid for that never released
//   3. Plan-limit pressure  — orgs about to hit a writ ceiling
//   4. Stale support sessions — forgotten god-mode access
//
// All queries run on the platform-admin's RLS-bound client. Platform
// admins have blanket SELECT on the relevant tables (memberships /
// briefs / claims / payments / profiles / platform_audit_log) per the
// migrations, so we don't need the service-role client here.

interface FailedPaymentRow {
  id: string;
  amount_dkk: number;
  brief_title_snapshot: string | null;
  created_at: string;
  error_message: string | null;
  creator: { name: string | null; email: string | null } | null;
}

interface StuckClaimRow {
  id: string;
  org_id: string;
  updated_at: string;
  brief: { title: string | null } | null;
  creator: { name: string | null; email: string | null } | null;
  org: { name: string | null } | null;
}

interface SupportSessionRow {
  id: string;
  name: string | null;
  email: string | null;
  support_org_id: string;
  org: { name: string | null } | null;
}

interface PlanPressureRow {
  orgId: string;
  orgName: string;
  metricLabel: string;
  count: number;
  limit: number;
  ratio: number;
}

export default async function PlatformHealthPage() {
  const { supabase } = await requirePlatformAccountOrRedirect();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const sinceIso = thirtyDaysAgo.toISOString();

  const oneDayAgo = new Date();
  oneDayAgo.setUTCHours(oneDayAgo.getUTCHours() - 24);
  const oneDayAgoIso = oneDayAgo.toISOString();

  // 1. Failed payments in the last 30 days.
  const failedPaymentsResult = await supabase
    .from("payments")
    .select(
      "id, amount_dkk, brief_title_snapshot, created_at, error_message, creator:profiles!payments_creator_id_fkey(name, email)"
    )
    .eq("status", "failed")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  const failedPayments = (failedPaymentsResult.data ??
    []) as unknown as FailedPaymentRow[];

  // 2. Stuck claims: status='approved', no payments row references them,
  //    and the claim hasn't moved in over 24h. claims has no
  //    approved_at column, so we lean on updated_at as the proxy
  //    timestamp of the last status change. This is the same column
  //    the org-admin claim queue sorts by.
  const approvedClaimsResult = await supabase
    .from("claims")
    .select(
      "id, org_id, updated_at, brief:briefs(title), creator:profiles!claims_user_id_fkey(name, email), org:organizations(name)"
    )
    .eq("status", "approved")
    .lt("updated_at", oneDayAgoIso)
    .order("updated_at", { ascending: true });

  const approvedClaims = (approvedClaimsResult.data ??
    []) as unknown as StuckClaimRow[];

  let stuckClaims: StuckClaimRow[] = [];
  if (approvedClaims.length > 0) {
    const claimIds = approvedClaims.map((c) => c.id);
    const paymentsForClaimsResult = await supabase
      .from("payments")
      .select("claim_id")
      .in("claim_id", claimIds);
    const referencedClaimIds = new Set(
      (paymentsForClaimsResult.data ?? []).map((p) => p.claim_id)
    );
    stuckClaims = approvedClaims.filter((c) => !referencedClaimIds.has(c.id));
  }

  // 3. Orgs at >=80% of either limit. We pull every active org, then
  //    fan out one SELECT count(*) per metric per org, and one
  //    effective_org_limit RPC call per metric per org. With a small
  //    op platform this is fine; if org count grows past a few hundred
  //    we'd swap this for a single SQL view.
  const orgsResult = await supabase
    .from("organizations")
    .select("id, name")
    .eq("status", "active");

  const orgs = orgsResult.data ?? [];

  const planPressure: PlanPressureRow[] = [];
  await Promise.all(
    orgs.map(async (org) => {
      const [
        openBriefsCountResult,
        creatorMembersCountResult,
        briefLimitResult,
        creatorLimitResult,
      ] = await Promise.all([
        supabase
          .from("briefs")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .eq("status", "open"),
        supabase
          .from("memberships")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .eq("role", "creator")
          .eq("status", "active"),
        supabase.rpc("effective_org_limit", {
          p_org_id: org.id,
          p_limit_key: "max_active_briefs",
        }),
        supabase.rpc("effective_org_limit", {
          p_org_id: org.id,
          p_limit_key: "max_creators",
        }),
      ]);

      const openBriefs = openBriefsCountResult.count ?? 0;
      const creatorMembers = creatorMembersCountResult.count ?? 0;
      const briefLimit =
        typeof briefLimitResult.data === "number" ? briefLimitResult.data : null;
      const creatorLimit =
        typeof creatorLimitResult.data === "number"
          ? creatorLimitResult.data
          : null;

      // null limit means "unlimited" per the SQL helper. Skip those.
      if (briefLimit !== null && briefLimit > 0) {
        const ratio = openBriefs / briefLimit;
        if (ratio >= 0.8) {
          planPressure.push({
            orgId: org.id,
            orgName: org.name,
            metricLabel: "Open briefs",
            count: openBriefs,
            limit: briefLimit,
            ratio,
          });
        }
      }
      if (creatorLimit !== null && creatorLimit > 0) {
        const ratio = creatorMembers / creatorLimit;
        if (ratio >= 0.8) {
          planPressure.push({
            orgId: org.id,
            orgName: org.name,
            metricLabel: "Active creators",
            count: creatorMembers,
            limit: creatorLimit,
            ratio,
          });
        }
      }
    })
  );

  planPressure.sort((a, b) => b.ratio - a.ratio);

  // 4. Long-running support sessions: profiles in support mode whose
  //    most recent support.enter for that target org is older than 24h.
  //    "Most recent" because an admin can enter, exit, re-enter; only
  //    the latest entry matters for the elapsed-time signal.
  const supportProfilesResult = await supabase
    .from("profiles")
    .select(
      "id, name, email, support_org_id, org:organizations!profiles_support_org_id_fkey(name)"
    )
    .not("support_org_id", "is", null);

  const supportProfiles = (supportProfilesResult.data ??
    []) as unknown as SupportSessionRow[];

  const staleSessions: Array<{
    profile: SupportSessionRow;
    enteredAt: string;
  }> = [];
  await Promise.all(
    supportProfiles.map(async (p) => {
      const { data: latestEnter } = await supabase
        .from("platform_audit_log")
        .select("created_at")
        .eq("actor_id", p.id)
        .eq("action", "support.enter")
        .eq("target_org_id", p.support_org_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestEnter && latestEnter.created_at < oneDayAgoIso) {
        staleSessions.push({ profile: p, enteredAt: latestEnter.created_at });
      }
    })
  );

  staleSessions.sort((a, b) => a.enteredAt.localeCompare(b.enteredAt));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-2">Platform health</h1>
        <p className="text-muted">
          Operational issues to investigate. Read-only snapshot, refresh
          to recompute.
        </p>
      </div>

      <section>
        <SectionHeader
          title="Failed payments"
          count={failedPayments.length}
          subtitle="Last 30 days. Each row left a creator unpaid."
        />
        {failedPayments.length === 0 ? (
          <EmptyRow message="All clear. No failed payouts in the last 30 days." />
        ) : (
          <ul className="space-y-2">
            {failedPayments.slice(0, 10).map((p) => (
              <li
                key={p.id}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {p.brief_title_snapshot ?? "(untitled brief)"}
                    </p>
                    <p className="text-sm text-muted mt-0.5">
                      {p.creator?.name ?? p.creator?.email ?? "(unknown creator)"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatDkk(p.amount_dkk)}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(p.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
                {p.error_message && (
                  <p className="font-mono text-xs text-amber-300 mt-3 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2 break-words">
                    {p.error_message}
                  </p>
                )}
                <p className="font-mono text-[10px] text-muted mt-2">
                  payment:{p.id.slice(0, 8)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Stuck claims"
          count={stuckClaims.length}
          subtitle="Approved more than 24h ago, no payment row yet. The transfer never fired."
        />
        {stuckClaims.length === 0 ? (
          <EmptyRow message="All clear. Every approved claim has a payment attached." />
        ) : (
          <ul className="space-y-2">
            {stuckClaims.slice(0, 10).map((c) => (
              <li
                key={c.id}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {c.brief?.title ?? "(untitled brief)"}
                    </p>
                    <p className="text-sm text-muted mt-0.5">
                      {c.creator?.name ?? c.creator?.email ?? "(unknown creator)"}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Org:{" "}
                      <Link
                        href={`/admin/super/orgs/${c.org_id}`}
                        className="text-accent hover:underline"
                      >
                        {c.org?.name ?? c.org_id.slice(0, 8)}
                      </Link>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted">
                      Approved
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(c.updated_at).toLocaleString("en-GB")}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatElapsed(c.updated_at)} ago
                    </p>
                  </div>
                </div>
                <p className="font-mono text-[10px] text-muted mt-2">
                  claim:{c.id.slice(0, 8)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Orgs near plan limits"
          count={planPressure.length}
          subtitle="At 80% or higher of an active limit. Reach out before they bounce off the cap."
        />
        {planPressure.length === 0 ? (
          <EmptyRow message="All clear. No org is close to its plan limits." />
        ) : (
          <ul className="space-y-2">
            {planPressure.map((row, idx) => (
              <li
                key={`${row.orgId}-${row.metricLabel}-${idx}`}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/super/orgs/${row.orgId}`}
                      className="font-medium hover:text-accent truncate block"
                    >
                      {row.orgName}
                    </Link>
                    <p className="text-sm text-muted mt-0.5">
                      {row.metricLabel}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">
                      {row.count}{" "}
                      <span className="text-muted font-normal">
                        / {row.limit}
                      </span>
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        row.ratio >= 1
                          ? "text-amber-300"
                          : row.ratio >= 0.95
                            ? "text-amber-300"
                            : "text-muted"
                      }`}
                    >
                      {Math.round(row.ratio * 100)}%
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader
          title="Long-running support sessions"
          count={staleSessions.length}
          subtitle="Open for more than 24h. Likely forgotten, exit them or confirm they're still needed."
        />
        {staleSessions.length === 0 ? (
          <EmptyRow message="All clear. No support session has been open for more than 24 hours." />
        ) : (
          <ul className="space-y-2">
            {staleSessions.map(({ profile, enteredAt }) => (
              <li
                key={profile.id}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {profile.name ?? "(unnamed admin)"}
                    </p>
                    <p className="font-mono text-xs text-muted mt-0.5">
                      {profile.email ?? "(no email)"}
                    </p>
                    <p className="text-sm text-muted mt-1">
                      In support mode for{" "}
                      <Link
                        href={`/admin/super/orgs/${profile.support_org_id}`}
                        className="text-accent hover:underline"
                      >
                        {profile.org?.name ?? profile.support_org_id.slice(0, 8)}
                      </Link>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs uppercase tracking-wider text-muted">
                      Open for
                    </p>
                    <p className="text-sm font-medium">
                      {formatElapsed(enteredAt)}
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      since {new Date(enteredAt).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  subtitle,
}: {
  title: string;
  count: number;
  subtitle: string;
}) {
  const tone =
    count === 0
      ? "bg-foreground/10 text-muted"
      : "bg-amber-400/15 text-amber-300";
  return (
    <div className="mb-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${tone}`}
        >
          {count}
        </span>
      </div>
      <p className="text-sm text-muted mt-1">{subtitle}</p>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 text-sm text-muted">
      {message}
    </div>
  );
}

// Render a coarse "Nh" or "Nd" string from an ISO timestamp. We only
// surface this for things older than 24h, so the resolution can stay
// at hour granularity until we cross a day, then days. Avoids pulling
// in date-fns for one helper.
function formatElapsed(sinceIso: string): string {
  const ms = Date.now() - new Date(sinceIso).getTime();
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
