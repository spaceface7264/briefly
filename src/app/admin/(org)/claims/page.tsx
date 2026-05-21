import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg, getOrgRole } from "@/lib/org";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { ClaimActions } from "./claim-actions";
import { badgeToneByStatus, claimStatusLabel } from "@/lib/admin-badge-tones";
import { SocialLinks } from "@/components/social-links";
import { Button } from "@/components/ui/button";
import type { ClaimStatus } from "@/types/database";

type StatusGroup = { status: ClaimStatus | null; label: string };

const STATUS_GROUPS: StatusGroup[] = [
  { status: null, label: "All" },
  { status: "active", label: "Active" },
  { status: "submitted", label: "Pending review" },
  { status: "revision_requested", label: "Changes requested" },
  { status: "approved", label: "Approved" },
  { status: "paid", label: "Paid" },
  { status: "cancelled", label: "Cancelled" },
];

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
    .select(
      "*, brief:briefs(id, title, price_dkk, category), creator:profiles(id, name, email, social_handles, stripe_payouts_enabled, avatar_url)"
    )
    .eq("org_id", orgId)
    .order("claimed_at", { ascending: false });

  const claims = statusFilter
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allClaims || []).filter((c: any) => c.status === statusFilter)
    : allClaims;

  // Try to attach payment info if the payments table exists
  if (allClaims && allClaims.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: payments } = await (supabase.from("payments") as any)
      .select("id, claim_id, invoice_number, status")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .in("claim_id", allClaims.map((c: any) => c.id));

    if (payments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const activeGroup = statusFilter
    ? STATUS_GROUPS.find((g) => g.status === statusFilter)
    : null;
  const hasClaimsAtAll = (allClaims || []).length > 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Claims
        </h1>
      </header>

      {/* Status filter row. Server-driven Links so each state is
          shareable; the active pill uses the same `bg-brand-soft`
          wash as the briefs page so the two tables read as siblings. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {STATUS_GROUPS.map((group) => {
          const count = group.status
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (allClaims || []).filter((c: any) => c.status === group.status).length
            : (allClaims || []).length;
          const isActive =
            statusFilter === group.status || (!statusFilter && !group.status);

          return (
            <Link
              key={group.status || "all"}
              href={
                group.status
                  ? `/admin/claims?status=${group.status}`
                  : "/admin/claims"
              }
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-ink/25 bg-brand-soft text-foreground"
                  : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-foreground"
              }`}
            >
              <span>{group.label}</span>
              <span
                className={`value-text text-xs ${
                  isActive ? "text-muted" : "text-muted/80"
                }`}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {claims && claims.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Brief</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Creator</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Claimed</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted">Expires</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {claims.map((claim: any) => {
                const isHighlighted = claim.id === highlightClaim;
                const isExpired =
                  new Date(claim.expires_at) < new Date() && claim.status === "active";

                return (
                  <tr
                    key={claim.id}
                    className={`border-b border-border transition-colors last:border-0 ${
                      isHighlighted ? "bg-brand-soft" : "hover:bg-surface-hover"
                    }`}
                  >
                    <td className="max-w-[260px] px-4 py-3 sm:max-w-[340px]">
                      <Link
                        href={`/admin/briefs/${claim.brief?.id}`}
                        title={claim.brief?.title || "Unknown brief"}
                        className="block truncate font-medium text-foreground transition-colors hover:text-brand-ink"
                      >
                        {claim.brief?.title || "Unknown brief"}
                      </Link>
                      <p className="value-text mt-0.5 text-sm text-muted">
                        {formatPrice(claim.brief?.price_dkk)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          url={claim.creator?.avatar_url}
                          name={claim.creator?.name}
                          email={claim.creator?.email}
                          size="sm"
                          alt=""
                        />
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium text-foreground">
                            {claim.creator?.name || "Unknown"}
                          </span>
                          {claim.creator?.social_handles && (
                            <SocialLinks
                              socialHandles={claim.creator.social_handles}
                              className="shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ClaimStatusBadge status={claim.status} />
                        {isExpired && (
                          <span className="inline-flex whitespace-nowrap rounded-full bg-error/20 px-2 py-0.5 text-xs font-medium text-error-ink">
                            Expired
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="value-text whitespace-nowrap px-4 py-3 text-sm text-muted">
                      {new Date(claim.claimed_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="value-text whitespace-nowrap px-4 py-3 text-sm text-muted">
                      {new Date(claim.expires_at).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <ClaimActions
                        claim={claim}
                        canPay={canPay}
                        paidInvoice={
                          (claim.payments || []).find(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        <ClaimsEmptyState
          activeGroup={activeGroup}
          hasClaimsAtAll={hasClaimsAtAll}
        />
      )}
    </div>
  );
}

/**
 * Empty state for the claims table. Three branches:
 *   1. Filter is set, no matches  → name the bucket, offer "All" reset.
 *   2. No filter, claims exist    → unreachable (the table would render).
 *   3. No claims at all           → first-run; point at /admin/briefs.
 *
 * DESIGN.md empty-state shape: specific copy, supporting secondary
 * line, optional CTA. No decorative illustration.
 */
function ClaimsEmptyState({
  activeGroup,
  hasClaimsAtAll,
}: {
  activeGroup: StatusGroup | null | undefined;
  hasClaimsAtAll: boolean;
}) {
  if (activeGroup) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
        <p className="text-base text-text-secondary">
          No claims in {activeGroup.label.toLowerCase()}
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          {hasClaimsAtAll
            ? "Switch to All to see everything, or pick another status."
            : "Once a creator picks up one of your briefs it will show here."}
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="mt-4"
          render={<Link href="/admin/claims" />}
        >
          Show all claims
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <p className="text-base text-text-secondary">No claims yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Claims show up here as creators in your network pick up published briefs.
      </p>
      <Button
        nativeButton={false}
        className="mt-4"
        render={<Link href="/admin/briefs" />}
      >
        Go to briefs
      </Button>
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badgeToneByStatus[status]}`}
    >
      {claimStatusLabel[status]}
    </span>
  );
}
