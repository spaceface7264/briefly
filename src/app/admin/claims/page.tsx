import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, getOrgRole } from "@/lib/org";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { ClaimActions } from "./claim-actions";
import { badgeToneByStatus, claimStatusLabel } from "@/lib/admin-badge-tones";
import {
  instagramDisplayHandle,
  instagramProfileUrl,
} from "@/lib/instagram";
import type { ClaimStatus } from "@/types/database";

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; claim?: string }>;
}) {
  const { status: statusFilter, claim: highlightClaim } = await searchParams;
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);
  const role = await getOrgRole(supabase);
  const canPay = role === "admin";

  // Always fetch all claims so tab counts are accurate; filter the displayed list below
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allClaims } = await (supabase.from("claims") as any)
    .select("*, brief:briefs(id, title, price_dkk, category), creator:profiles(id, name, email, instagram_handle, stripe_payouts_enabled, avatar_url)")
    .eq("org_id", orgId)
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
      <h1 className="font-display tracking-tight text-3xl font-bold mb-8">Claims</h1>

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
              className={`px-4 py-2 border rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface-raised text-foreground border-border-strong"
                  : "bg-surface border-border hover:border-brand/40"
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
                      <Link href={`/admin/briefs/${claim.brief?.id}`} className="font-medium hover:text-accent-ink">
                        {claim.brief?.title || "Unknown Brief"}
                      </Link>
                      <p className="text-muted text-sm font-mono">{formatPrice(claim.brief?.price_dkk)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          url={claim.creator?.avatar_url}
                          name={claim.creator?.name}
                          email={claim.creator?.email}
                          size="sm"
                          alt=""
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {claim.creator?.name || "Unknown"}
                          </p>
                          <p className="text-muted text-sm truncate">
                            {claim.creator?.email}
                          </p>
                          {claim.creator?.instagram_handle && (
                            <InstagramLink
                              handle={claim.creator.instagram_handle}
                              className="text-accent-ink text-sm truncate hover:underline"
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ClaimStatusBadge status={claim.status} />
                      {isExpired && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-error/20 text-error-ink">
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
                        canPay={canPay}
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

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${badgeToneByStatus[status]}`}>
      {claimStatusLabel[status]}
    </span>
  );
}

/**
 * Small read-only Instagram link. Falls back to plain text if the
 * stored handle isn't usable as a link target. Block-level by default
 * so it sits on its own line under the creator's name/email.
 */
function InstagramLink({
  handle,
  className = "",
}: {
  handle: string | null | undefined;
  className?: string;
}) {
  const display = instagramDisplayHandle(handle);
  const url = instagramProfileUrl(handle);
  if (!display) return null;
  if (!url) {
    return <p className={className}>@{display}</p>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block ${className}`}
    >
      @{display}
    </a>
  );
}
