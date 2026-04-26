"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { planLimitErrorMessage } from "@/lib/pricing";
import { BriefForm } from "../brief-form";
import type { Brief, Claim } from "@/types/database";
import Link from "next/link";

export default function EditBriefPage() {
  const params = useParams();
  const router = useRouter();
  const briefId = params.id as string;

  const [brief, setBrief] = useState<Brief | null>(null);
  const [claims, setClaims] = useState<(Claim & { creator: { name: string; email: string } })[]>([]);
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
        .select("*, creator:profiles(name, email)")
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
    if (!confirm("Archive this brief? It will no longer be visible to creators.")) return;

    setArchiving(true);
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("briefs") as any)
      .update({ status: "archived" })
      .eq("id", briefId);

    if (error) {
      console.error("Archive error:", error);
      alert("Failed to archive brief");
      setArchiving(false);
      return;
    }

    router.push("/admin/briefs");
    router.refresh();
  }

  async function handleReopen() {
    setArchiving(true);
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("briefs") as any)
      .update({ status: "open" })
      .eq("id", briefId);

    if (error) {
      console.error("Reopen error:", error);
      const limitMessage = planLimitErrorMessage(error);
      if (limitMessage) {
        alert(`${limitMessage}\n\nUpgrade your plan at /admin/billing.`);
      } else {
        alert("Failed to reopen brief");
      }
      setArchiving(false);
      return;
    }

    router.refresh();
    setArchiving(false);
    setBrief((prev) => prev ? { ...prev, status: "open" } : null);
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
        <Link href="/admin/briefs" className="text-accent hover:underline">
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
          <h1 className="text-3xl font-bold">Edit Brief</h1>
        </div>
        <div className="flex gap-3">
          {brief.status === "archived" ? (
            <button
              onClick={handleReopen}
              disabled={archiving}
              className="px-4 py-2 border border-accent text-accent hover:bg-accent-muted disabled:opacity-50 rounded-lg transition-colors"
            >
              {archiving ? "Reopening..." : "Reopen Brief"}
            </button>
          ) : (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="px-4 py-2 border border-error text-error hover:bg-error/10 disabled:opacity-50 rounded-lg transition-colors"
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
                  <li key={claim.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{claim.creator?.name || "Unknown"}</p>
                      <p className="text-muted text-sm">{claim.creator?.email}</p>
                      <p className="text-muted text-xs font-mono mt-1">
                        Claimed {new Date(claim.claimed_at).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <Link
                      href={`/admin/claims?claim=${claim.id}`}
                      className="text-accent text-sm hover:underline"
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
              <h2 className="font-semibold text-warning mb-4">
                Pending Review ({submittedClaims.length})
              </h2>
              <ul className="space-y-3">
                {submittedClaims.map((claim) => (
                  <li key={claim.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{claim.creator?.name || "Unknown"}</p>
                      <p className="text-muted text-sm">{claim.creator?.email}</p>
                    </div>
                    <Link
                      href={`/admin/claims?claim=${claim.id}`}
                      className="text-warning text-sm hover:underline font-medium"
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

function ClaimStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    cancelled: "bg-error/20 text-error",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
}
