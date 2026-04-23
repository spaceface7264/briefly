"use client";

import Link from "next/link";
import { Nav } from "@/components/nav";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import type { ClaimStatus } from "@/types/database";
import type { ClaimWithBrief } from "./page";
import {
  formatPrice,
  formatDeadline,
  categoryLabel,
  formatLabel,
} from "@/lib/utils";

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
    status: "submitted",
    title: "Under Review",
    description: "Waiting for admin approval",
    tone: "info",
  },
  {
    status: "approved",
    title: "Approved",
    description: "Ready for payment",
    tone: "brand",
  },
  {
    status: "paid",
    title: "Completed",
    description: "Paid and closed",
    tone: "success",
  },
];

function claimStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "In Progress",
    submitted: "Submitted",
    approved: "Approved",
    paid: "Paid",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

function claimStatusTone(status: string): StatusTone {
  const tones: Record<string, StatusTone> = {
    active: "brand",
    submitted: "info",
    approved: "brand",
    paid: "success",
    cancelled: "danger",
  };
  return tones[status] || "neutral";
}

interface Props {
  claims: ClaimWithBrief[];
}

export function MyBriefsClient({ claims }: Props) {
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Briefs</h1>
            <p className="text-text-secondary">Track your claimed briefs and submissions</p>
          </div>

          {!hasAnyClaims ? (
            <div className="bg-surface border border-border rounded-xl p-8 sm:p-12 text-center">
              <h2 className="text-xl font-semibold mb-2">
                Nothing here yet
              </h2>
              <p className="text-text-secondary max-w-md mx-auto mb-6">
                Claim a brief, submit your work within 7 days, and get paid in
                DKK once it&apos;s approved.
              </p>
              <Link
                href="/briefs"
                className="inline-flex px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
              >
                Browse Available Briefs
              </Link>
            </div>
          ) : (
            <>
              {/* Status summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
                {groupedClaims.map((group) => {
                  const count = group.claims.length;
                  const isEmpty = count === 0;
                  return (
                    <div
                      key={group.status}
                      className={`rounded-lg p-4 border ${
                        isEmpty
                          ? "bg-surface/40 border-border"
                          : "bg-surface border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className={`value-text text-2xl font-bold ${isEmpty ? "text-muted" : ""}`}>
                          {count}
                        </p>
                        <span
                          aria-hidden="true"
                          className={`inline-block w-2 h-2 rounded-full ${
                            isEmpty
                              ? "bg-border-strong"
                              : group.tone === "brand"
                                ? "bg-accent"
                                : group.tone === "warning"
                                  ? "bg-warning"
                                  : group.tone === "success"
                                    ? "bg-success"
                                    : "bg-muted"
                          }`}
                        />
                      </div>
                      <p className="text-xs text-muted uppercase tracking-wider">
                        {group.title}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-10">
                {groupedClaims.map((group) => (
                  <section key={group.status}>
                    <div className="flex items-baseline gap-3 mb-4">
                      <h2 className="text-xl font-semibold">{group.title}</h2>
                      <span className="value-text text-muted text-sm">
                        {group.claims.length}
                      </span>
                    </div>
                    <p className="text-text-secondary text-sm mb-4 -mt-3">
                      {group.description}
                    </p>

                    {group.claims.length === 0 ? (
                      <div className="bg-surface/40 border border-dashed border-border rounded-xl p-6 text-center">
                        <p className="text-text-secondary text-sm">
                          Nothing in this stage
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {group.claims.map((claim) => (
                          <div
                            key={claim.id}
                            className="relative bg-surface border border-border rounded-xl p-5 hover:border-border-strong hover:bg-surface-hover transition-all"
                          >
                            <Link
                              href={`/briefs/${claim.brief_id}`}
                              className="absolute inset-0 rounded-xl"
                              aria-label={claim.brief.title}
                            />
                            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-lg truncate">
                                    {claim.brief.title}
                                  </h3>
                                  <StatusPill tone={claimStatusTone(claim.status)}>
                                    {claimStatusLabel(claim.status)}
                                  </StatusPill>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                  <span className="px-2.5 py-1 bg-surface-raised text-foreground text-xs font-medium rounded-full border border-border">
                                    {categoryLabel(claim.brief.category)}
                                  </span>
                                  <span className="px-2.5 py-1 bg-surface-raised text-text-secondary text-xs font-mono rounded-full border border-border">
                                    {formatLabel(claim.brief.format)}
                                  </span>
                                  {claim.brief.gym && (
                                    <span className="px-2.5 py-1 bg-surface-raised text-text-secondary text-xs rounded-full border border-border">
                                      {claim.brief.gym}
                                    </span>
                                  )}
                                </div>

                                {claim.status === "active" && (
                                  <p className="text-sm font-mono text-muted">
                                    Expires {formatDeadline(claim.expires_at)}
                                  </p>
                                )}

                                {claim.status === "paid" && claim.invoice && (
                                  <a
                                    href={`/api/invoices/${claim.invoice.id}/pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                                    </svg>
                                    Invoice {claim.invoice.invoice_number}
                                  </a>
                                )}
                              </div>

                              <div className="text-left sm:text-right shrink-0">
                                <p className="value-text text-xl text-accent font-bold">
                                  {formatPrice(claim.brief.price_dkk)}
                                </p>
                                {claim.brief.deadline && (
                                  <p className="value-text text-muted text-sm mt-1">
                                    Due {formatDeadline(claim.brief.deadline)}
                                  </p>
                                )}
                              </div>
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
