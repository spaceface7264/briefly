import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { ClaimActions } from "./claim-actions";

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; claim?: string }>;
}) {
  const { status: statusFilter, claim: highlightClaim } = await searchParams;
  const supabase = await createClient();

  // Always fetch all claims so tab counts are accurate; filter the displayed list below
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allClaims } = await (supabase.from("claims") as any)
    .select("*, brief:briefs(id, title, price_dkk, category), creator:profiles(id, name, email, instagram_handle)")
    .order("claimed_at", { ascending: false });

  const claims = statusFilter
    ? (allClaims || []).filter((c: any) => c.status === statusFilter)
    : allClaims;

  // Try to attach payment info if the payments table exists
  if (allClaims && allClaims.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: payments } = await (supabase.from("payments") as any)
      .select("id, claim_id, invoice_number, status")
      .in("claim_id", allClaims.map((c: any) => c.id));

    if (payments) {
      const paymentsByClaimId = new Map<string, any[]>();
      for (const p of payments) {
        const arr = paymentsByClaimId.get(p.claim_id) || [];
        arr.push(p);
        paymentsByClaimId.set(p.claim_id, arr);
      }
      for (const claim of allClaims) {
        claim.payments = paymentsByClaimId.get(claim.id) || [];
      }
    } else {
      for (const claim of allClaims) {
        claim.payments = [];
      }
    }
  }

  const statusGroups = [
    { status: null, label: "All" },
    { status: "active", label: "Active" },
    { status: "submitted", label: "Pending Review" },
    { status: "approved", label: "Approved" },
    { status: "paid", label: "Paid" },
    { status: "cancelled", label: "Cancelled" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Claims</h1>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusGroups.map((group) => {
          const count = group.status
            ? (allClaims || []).filter((c: any) => c.status === group.status).length
            : (allClaims || []).length;
          const isActive = statusFilter === group.status || (!statusFilter && !group.status);

          return (
            <Link
              key={group.status || "all"}
              href={group.status ? `/admin/claims?status=${group.status}` : "/admin/claims"}
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-background border-accent"
                  : "bg-surface border-border hover:border-accent/50"
              }`}
            >
              {group.label} ({count})
            </Link>
          );
        })}
      </div>

      {/* Claims Table */}
      {claims && claims.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Brief</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Creator</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Claimed</th>
                <th className="text-left text-sm font-medium text-muted px-4 py-3">Expires</th>
                <th className="text-right text-sm font-medium text-muted px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim: any) => {
                const isHighlighted = claim.id === highlightClaim;
                const isExpired = new Date(claim.expires_at) < new Date() && claim.status === "active";

                return (
                  <tr
                    key={claim.id}
                    className={`border-b border-border last:border-0 ${
                      isHighlighted ? "bg-accent-muted" : "hover:bg-surface-hover"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/admin/briefs/${claim.brief?.id}`} className="font-medium hover:text-accent">
                        {claim.brief?.title || "Unknown Brief"}
                      </Link>
                      <p className="text-muted text-sm font-mono">{formatPrice(claim.brief?.price_dkk)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{claim.creator?.name || "Unknown"}</p>
                      <p className="text-muted text-sm">{claim.creator?.email}</p>
                      {claim.creator?.instagram_handle && (
                        <p className="text-accent text-sm">@{claim.creator.instagram_handle}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ClaimStatusBadge status={claim.status} />
                      {isExpired && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-error/20 text-error">
                          Expired
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-sm">
                      {new Date(claim.claimed_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-sm">
                      {new Date(claim.expires_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ClaimActions
                        claim={claim}
                        paidInvoice={
                          (claim.payments || []).find(
                            (p: any) => p.status === "succeeded"
                          ) || null
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted">No claims found</p>
        </div>
      )}
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    cancelled: "bg-error/20 text-error",
  };

  const labels: Record<string, string> = {
    active: "Active",
    submitted: "Pending Review",
    approved: "Approved",
    paid: "Paid",
    cancelled: "Cancelled",
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles[status] || styles.active}`}>
      {labels[status] || status}
    </span>
  );
}
