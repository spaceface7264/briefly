"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { planLimitErrorMessage } from "@/lib/pricing";
import { BriefForm } from "../brief-form";
import { archiveBriefWithRefund, reopenBrief } from "../actions";
import { formatDkk } from "@/lib/pricing";
import {
  badgeToneByFundedStatus,
  fundedStatusLabel,
} from "@/lib/admin-badge-tones";
import { Avatar } from "@/components/avatar";
import type { Brief, BriefFundedStatus, Claim } from "@/types/database";
import Link from "next/link";

type ClaimWithCreator = Claim & {
  creator: {
    name: string;
    email: string;
    avatar_url: string | null;
  };
};

export default function EditBriefPage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params.id as string;

  const [brief, setBrief] = useState<Brief | null>(null);
  const [claims, setClaims] = useState<ClaimWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const briefResult = await (supabase.from("briefs") as any)
        .select("*")
        .eq("id", briefId)
        .single();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const claimsResult = await (supabase.from("claims") as any)
        .select("*, creator:profiles(name, email, avatar_url)")
        .eq("brief_id", briefId)
        .order("claimed_at", { ascending: false });

      if (briefResult.data) {
        setBrief(briefResult.data as Brief);
      }
      if (claimsResult.data) {
        setClaims(claimsResult.data);
      }
      setLoading(false);
    }

    load();
  }, [briefId]);

  async function handleArchive() {
    if (!brief) return;
    const heldDkk = brief.escrow_held_dkk ?? 0;
    const willRefund =
      (brief.funded_status === "funded" ||
        brief.funded_status === "partially_released") &&
      heldDkk > 0;
    const message = willRefund
      ? `Archive this brief? The held escrow of ${formatDkk(heldDkk)} will be refunded to your saved payment method, and the brief will no longer be visible to creators.`
      : "Archive this brief? It will no longer be visible to creators.";
    if (!confirm(message)) return;

    setArchiving(true);
    // archiveBriefWithRefund redirects to /admin/briefs on success
    // (FlashToast picks up `?flash=brief-archived` there). If we
    // receive a result back here it's a failure path.
    const result = await archiveBriefWithRefund(briefId);
    toast.error("Couldn't archive brief", {
      description: result.error,
    });
    setArchiving(false);
  }

  async function handleReopen() {
    if (!brief) return;
    setArchiving(true);
    const result = await reopenBrief(briefId);

    if (!result.ok) {
      const limitMessage = planLimitErrorMessage({ message: result.error });
      toast.error("Couldn't reopen brief", {
        description: limitMessage ?? result.error,
      });
      setArchiving(false);
      return;
    }

    const trimmed = brief.title?.trim() ?? "";
    const displayTitle = trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
    toast.success(
      "Brief reopened",
      displayTitle ? { description: displayTitle } : undefined
    );
    router.refresh();
    setArchiving(false);
    setBrief((prev) => (prev ? { ...prev, status: "open" } : null));
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-surface animate-pulse rounded-lg" />
        <div className="h-96 bg-surface animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="text-center py-12">
        <p className="text-muted mb-4">Brief not found</p>
        <Link href="/admin/briefs" className="text-accent-ink hover:underline">
          Back to Briefs
        </Link>
      </div>
    );
  }

  const activeClaims = claims.filter((c) => c.status === "active");
  const submittedClaims = claims.filter((c) => c.status === "submitted");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/admin/briefs" className="text-muted hover:text-foreground text-sm mb-2 inline-block">
            &larr; Back to Briefs
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display tracking-tight text-3xl font-bold">Edit Brief</h1>
            <FundedHeaderBadge
              status={brief.funded_status as BriefFundedStatus | null}
              heldDkk={brief.escrow_held_dkk}
              amountDkk={brief.escrow_amount_dkk}
            />
          </div>
        </div>
        <div className="flex gap-3">
          {brief.status === "archived" ? (
            <button
              onClick={handleReopen}
              disabled={archiving}
              className="px-4 py-2 border border-accent text-accent-ink hover:bg-accent-muted disabled:opacity-50 rounded-full transition-colors"
            >
              {archiving ? "Reopening..." : "Reopen Brief"}
            </button>
          ) : (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="px-4 py-2 border border-error text-error-ink hover:bg-error/10 disabled:opacity-50 rounded-full transition-colors"
            >
              {archiving ? "Archiving..." : "Archive Brief"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Brief Form */}
        <div className="lg:col-span-2">
          <BriefForm brief={brief} />
        </div>

        {/* Claims Sidebar */}
        <div className="space-y-6">
          {/* Active Claims */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">
              Active Claims ({activeClaims.length}/{brief.claim_limit})
            </h2>
            {activeClaims.length > 0 ? (
              <ul className="space-y-3">
                {activeClaims.map((claim) => (
                  <li key={claim.id} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
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
                        <p className="text-muted text-xs font-mono mt-1">
                          Claimed{" "}
                          {new Date(claim.claimed_at).toLocaleDateString(
                            "en-GB"
                          )}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/admin/claims?claim=${claim.id}`}
                      className="text-accent-ink text-sm hover:underline shrink-0"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">No active claims</p>
            )}
          </div>

          {/* Pending Submissions */}
          {submittedClaims.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-5">
              <h2 className="font-semibold text-warning-ink mb-4">
                Pending Review ({submittedClaims.length})
              </h2>
              <ul className="space-y-3">
                {submittedClaims.map((claim) => (
                  <li key={claim.id} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
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
                      </div>
                    </div>
                    <Link
                      href={`/admin/claims?claim=${claim.id}`}
                      className="text-warning-ink text-sm hover:underline font-medium shrink-0"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All Claims History */}
          {claims.length > 0 && (
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-4">All Claims ({claims.length})</h2>
              <ul className="space-y-2">
                {claims.map((claim) => (
                  <li key={claim.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted truncate">{claim.creator?.name || claim.creator?.email}</span>
                    <ClaimStatusBadge status={claim.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FundedHeaderBadge({
  status,
  heldDkk,
  amountDkk,
}: {
  status: BriefFundedStatus | null;
  heldDkk: number | null;
  amountDkk: number | null;
}) {
  if (!status || status === "unfunded") return null;
  const tone = badgeToneByFundedStatus[status];
  const label = fundedStatusLabel[status];
  if (!tone || !label) return null;

  // Add an inline amount summary so admins can see escrow state at a
  // glance without opening the form. e.g. "Funded · 1.500 DKK held"
  // or "Partially released · 500 / 1.500 DKK held".
  let suffix = "";
  if (status === "funded" && heldDkk != null) {
    suffix = ` · ${formatDkk(heldDkk)} held`;
  } else if (status === "partially_released" && heldDkk != null && amountDkk != null) {
    suffix = ` · ${formatDkk(heldDkk)} / ${formatDkk(amountDkk)} held`;
  } else if (status === "released" && amountDkk != null) {
    suffix = ` · ${formatDkk(amountDkk)} paid out`;
  } else if (status === "refunded" && amountDkk != null) {
    suffix = ` · ${formatDkk(amountDkk)} returned`;
  }

  return (
    <span
      className={`px-2.5 py-1 text-xs font-medium rounded-full ${tone}`}
      title="Escrow state for this brief"
    >
      {label}
      {suffix}
    </span>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-accent-muted text-accent-ink",
    submitted: "bg-warning/20 text-warning-ink",
    approved: "bg-success/20 text-success-ink",
    paid: "bg-muted/20 text-muted",
    cancelled: "bg-error/20 text-error-ink",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
}
