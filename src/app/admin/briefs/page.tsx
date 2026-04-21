import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { Brief, BriefStatus } from "@/types/database";

export default async function AdminBriefsPage() {
  const supabase = await createClient();

  const { data: briefs } = await supabase
    .from("briefs")
    .select("*")
    .order("created_at", { ascending: false });

  // Get claim counts for each brief
  const briefsWithCounts = await Promise.all(
    ((briefs || []) as Brief[]).map(async (brief) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase.from("claims") as any)
        .select("*", { count: "exact", head: true })
        .eq("brief_id", brief.id)
        .eq("status", "active");

      return { ...brief, activeClaimCount: count || 0 };
    })
  );

  const statusGroups: { status: BriefStatus; label: string }[] = [
    { status: "open", label: "Open" },
    { status: "claimed", label: "Claimed" },
    { status: "archived", label: "Archived" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Briefs</h1>
        <Link
          href="/admin/briefs/new"
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
        >
          Create Brief
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6">
        {statusGroups.map((group) => {
          const count = briefsWithCounts.filter((b) => b.status === group.status).length;
          return (
            <button
              key={group.status}
              className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:border-accent/50 transition-colors"
            >
              {group.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Briefs Table */}
      {briefsWithCounts.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Title</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Category</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Price</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Claims</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Created</th>
                <th className="text-right text-sm font-medium text-muted px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {briefsWithCounts.map((brief) => (
                <tr key={brief.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/admin/briefs/${brief.id}`} className="font-medium hover:text-accent">
                      {brief.title}
                    </Link>
                    {brief.gym && (
                      <p className="text-muted text-sm">{brief.gym}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full capitalize">
                      {brief.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {formatPrice(brief.price_dkk)}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {brief.activeClaimCount} / {brief.claim_limit}
                  </td>
                  <td className="px-4 py-3">
                    <BriefStatusBadge status={brief.status} />
                  </td>
                  <td className="px-4 py-3 text-muted font-mono text-sm">
                    {new Date(brief.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/briefs/${brief.id}`}
                      className="text-accent hover:underline text-sm"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted mb-4">No briefs yet</p>
          <Link
            href="/admin/briefs/new"
            className="inline-flex px-5 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
          >
            Create Your First Brief
          </Link>
        </div>
      )}
    </div>
  );
}

function BriefStatusBadge({ status }: { status: BriefStatus }) {
  const styles: Record<BriefStatus, string> = {
    open: "bg-success/20 text-success",
    claimed: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    archived: "bg-muted/20 text-muted",
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
