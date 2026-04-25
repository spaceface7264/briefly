import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import Link from "next/link";
import { badgeToneByStatus, claimStatusLabel } from "@/lib/admin-badge-tones";
import type { ClaimStatus } from "@/types/database";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);

  // Get counts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [briefsResult, claimsResult, creatorsResult] = await Promise.all([
    supabase.from("briefs").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    (supabase.from("claims") as any).select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active"),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("role", "creator").eq("status", "active"),
  ]);

  // Get open briefs count
  const { count: openBriefsCount } = await supabase
    .from("briefs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "open");

  // Get pending submissions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: pendingCount } = await (supabase.from("claims") as any)
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "submitted");

  // Get recent claims with brief info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentClaims } = await (supabase.from("claims") as any)
    .select("*, brief:briefs(title), creator:profiles(name, email)")
    .eq("org_id", orgId)
    .order("claimed_at", { ascending: false })
    .limit(5);

  const stats = [
    {
      label: "Total Briefs",
      value: briefsResult.count || 0,
      href: "/admin/briefs",
    },
    {
      label: "Open Briefs",
      value: openBriefsCount || 0,
      href: "/admin/briefs?status=open",
    },
    {
      label: "Active Claims",
      value: claimsResult.count || 0,
      href: "/admin/claims",
    },
    {
      label: "Pending Review",
      value: pendingCount || 0,
      href: "/admin/claims?status=submitted",
      highlight: (pendingCount || 0) > 0,
    },
    {
      label: "Creators",
      value: creatorsResult.count || 0,
      href: "/admin/creators",
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`bg-surface border rounded-xl p-5 hover:border-accent/50 transition-colors ${
              stat.highlight ? "border-accent" : "border-border"
            }`}
          >
            <p className="text-muted text-sm mb-1">{stat.label}</p>
            <p className={`font-mono text-3xl font-bold ${stat.highlight ? "text-accent" : ""}`}>
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-10">
        <Link
          href="/admin/briefs/new"
          className="px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
        >
          Create New Brief
        </Link>
        {(pendingCount || 0) > 0 && (
          <Link
            href="/admin/claims?status=submitted"
            className="px-6 py-3 border border-accent text-accent hover:bg-accent-muted font-semibold rounded-lg transition-colors"
          >
            Review Submissions ({pendingCount})
          </Link>
        )}
      </div>

      {/* Recent Claims */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Claims</h2>
        {recentClaims && recentClaims.length > 0 ? (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Brief</th>
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Creator</th>
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Claimed</th>
                </tr>
              </thead>
              <tbody>
                {recentClaims.map((claim: any) => (
                  <tr key={claim.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/briefs/${claim.brief_id}`} className="hover:text-accent">
                        {claim.brief?.title || "Unknown"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {claim.creator?.name || claim.creator?.email || "Unknown"}
                    </td>
                    <td className="px-4 py-3">
                      <ClaimStatusBadge status={claim.status} />
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-sm">
                      {new Date(claim.claimed_at).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">No claims yet</p>
        )}
      </div>
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${badgeToneByStatus[status]}`}>
      {claimStatusLabel[status]}
    </span>
  );
}
