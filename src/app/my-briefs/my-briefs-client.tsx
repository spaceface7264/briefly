"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import type { StatusTone } from "@/components/status-pill";
import type { ClaimStatus } from "@/types/database";
import type { ClaimWithBrief } from "./page";
import {
  formatPrice,
  categoryLabel,
  durationClassLabel,
} from "@/lib/utils";

function formatShortDate(date: string | null | undefined) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

const statusGroups: {
  status: ClaimStatus;
  title: string;
  description: string;
  tone: StatusTone;
}[] = [
  {
    status: "active",
    title: "In Progress",
    description: "Briefs you are currently working on",
    tone: "brand",
  },
  {
    status: "revision_requested",
    title: "Changes Requested",
    description: "The org has feedback — open the brief to see it and re-upload",
    tone: "warning",
  },
  {
    status: "submitted",
    title: "Under Review",
    description: "Waiting for admin approval",
    tone: "info",
  },
  {
    status: "approved",
    title: "Approved",
    description: "Ready for payment",
    tone: "info",
  },
  {
    status: "paid",
    title: "Completed",
    description: "Paid and closed",
    tone: "success",
  },
];

const statusTheme: Record<
  ClaimStatus,
  {
    summaryCard: string;
    rowCard: string;
    dot: string;
  }
> = {
  active: {
    summaryCard: "bg-accent/6 border-accent/20",
    rowCard: "bg-accent/6 border-accent/22 hover:border-accent/38",
    dot: "bg-accent",
  },
  revision_requested: {
    summaryCard: "bg-warning/8 border-warning/22",
    rowCard: "bg-warning/8 border-warning/24 hover:border-warning/40",
    dot: "bg-warning",
  },
  submitted: {
    summaryCard: "bg-info/8 border-info/22",
    rowCard: "bg-info/8 border-info/24 hover:border-info/40",
    dot: "bg-info",
  },
  approved: {
    summaryCard: "bg-success/8 border-success/22",
    rowCard: "bg-success/8 border-success/24 hover:border-success/40",
    dot: "bg-success",
  },
  paid: {
    summaryCard: "bg-success/10 border-success/26",
    rowCard: "bg-success/10 border-success/28 hover:border-success/44",
    dot: "bg-success",
  },
  cancelled: {
    summaryCard: "bg-error/8 border-error/22",
    rowCard: "bg-error/8 border-error/24 hover:border-error/40",
    dot: "bg-error",
  },
};

interface Props {
  claims: ClaimWithBrief[];
}

export function MyBriefsClient({ claims }: Props) {
  const router = useRouter();
  const groupedClaims = statusGroups.map((group) => ({
    ...group,
    claims: claims.filter((c) => c.status === group.status),
  }));

  const hasAnyClaims = claims.length > 0;

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="font-display tracking-tight text-2xl sm:text-3xl font-bold mb-1">My Briefs</h1>
            <p className="text-sm text-text-secondary">Track your claimed briefs and submissions</p>
          </div>

          {!hasAnyClaims ? (
            <div className="bg-surface border border-border rounded-xl p-8 sm:p-12 text-center">
              <h2 className="font-display tracking-tight text-xl font-semibold mb-2">
                Nothing here yet
              </h2>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Claim a brief, submit your work within 7 days, and get paid in
                DKK once it&apos;s approved.
              </p>
              <Link
                href="/briefs"
                className="inline-flex px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-full transition-colors"
              >
                Browse Available Briefs
              </Link>
            </div>
          ) : (
            <>
              {/* Status summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-8">
                {groupedClaims.map((group) => {
                  const count = group.claims.length;
                  const isEmpty = count === 0;
                  return (
                    <div
                      key={group.status}
                      className={`rounded-lg px-4 py-3 border ${
                        isEmpty
                          ? "bg-surface/40 border-border"
                          : statusTheme[group.status].summaryCard
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className={`value-text text-[1.8rem] leading-none font-bold ${isEmpty ? "text-muted" : ""}`}>
                          {count}
                        </p>
                        <span
                          aria-hidden="true"
                          className={`inline-block w-2 h-2 rounded-full ${
                            isEmpty
                              ? "bg-border-strong"
                              : statusTheme[group.status].dot
                          }`}
                        />
                      </div>
                      <p className="text-[0.7rem] text-muted uppercase tracking-wider">
                        {group.title}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-8">
                {groupedClaims.map((group) => (
                  <section key={group.status}>
                    <div className="flex items-baseline gap-2 mb-3">
                      <h2 className="font-display tracking-tight text-lg font-semibold">{group.title}</h2>
                      <span className="value-text text-muted text-xs">
                        {group.claims.length}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mb-3 -mt-2">
                      {group.description}
                    </p>

                    {group.claims.length === 0 ? (
                      <div className="bg-surface/40 border border-dashed border-border rounded-xl p-6 text-center">
                        <p className="text-text-secondary text-sm">
                          Nothing in this stage
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {group.claims.map((claim) => (
                          <div
                            key={claim.id}
                            role="link"
                            tabIndex={0}
                            aria-label={`Open brief: ${claim.brief.title}`}
                            onClick={() => router.push(`/briefs/${claim.brief_id}`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(`/briefs/${claim.brief_id}`);
                              }
                            }}
                            className={`relative border rounded-xl px-4 py-3.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${statusTheme[claim.status as ClaimStatus].rowCard}`}
                          >
                            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2">
                              <h3 className="font-display tracking-tight font-semibold text-[1.05rem] leading-tight">
                                {claim.brief.title}
                              </h3>

                              <span className="px-2 py-0.5 bg-surface-raised text-foreground text-[0.78rem] font-medium rounded-full border border-border">
                                {categoryLabel(claim.brief.category)}
                              </span>
                              <span className="px-2 py-0.5 bg-surface-raised text-text-secondary text-[0.78rem] font-mono rounded-full border border-border">
                                {durationClassLabel(claim.brief.duration_class)}
                              </span>
                              {claim.brief.location && (
                                <span className="px-2 py-0.5 bg-surface-raised text-text-secondary text-[0.78rem] rounded-full border border-border">
                                  {claim.brief.location}
                                </span>
                              )}

                              {claim.status === "active" && (
                                <span className="font-mono text-xs text-muted/90">
                                  Expires {formatShortDate(claim.expires_at)}
                                </span>
                              )}

                              {claim.brief.deadline && (
                                <span className="font-mono text-xs text-muted/90">
                                  Due {formatShortDate(claim.brief.deadline)}
                                </span>
                              )}

                              <span className="ml-auto value-text text-xl text-accent-ink font-bold whitespace-nowrap">
                                {formatPrice(claim.brief.price_dkk)}
                              </span>

                              {claim.status === "paid" && claim.invoice && (
                                <a
                                  href={`/api/invoices/${claim.invoice.id}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="relative inline-flex items-center gap-1.5 text-xs text-accent-ink hover:underline basis-full"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                                  </svg>
                                  Invoice {claim.invoice.invoice_number}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
