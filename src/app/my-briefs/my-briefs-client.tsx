"use client";

import Link from "next/link";
import { Nav } from "@/components/nav";
import type { ClaimStatus } from "@/types/database";
import type { ClaimWithBrief } from "./page";
import {
  formatPrice,
  formatDeadline,
  categoryLabel,
  formatLabel,
} from "@/lib/utils";

const statusGroups: { status: ClaimStatus; title: string; description: string }[] = [
  {
    status: "active",
    title: "In Progress",
    description: "Briefs you are currently working on",
  },
  {
    status: "submitted",
    title: "Under Review",
    description: "Waiting for admin approval",
  },
  {
    status: "approved",
    title: "Approved",
    description: "Ready for payment",
  },
  {
    status: "paid",
    title: "Completed",
    description: "Paid and closed",
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

function claimStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    cancelled: "bg-error/20 text-error",
  };
  return colors[status] || "bg-muted/20 text-muted";
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
            <p className="text-muted">Track your claimed briefs and submissions</p>
          </div>

          {!hasAnyClaims ? (
            <div className="text-center py-16 bg-surface border border-border rounded-xl">
              <p className="text-muted mb-4">You have not claimed any briefs yet</p>
              <Link
                href="/briefs"
                className="inline-flex px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
              >
                Browse Available Briefs
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              {groupedClaims.map((group) => {
                if (group.claims.length === 0) return null;

                return (
                  <section key={group.status}>
                    <div className="mb-4">
                      <h2 className="text-xl font-semibold">{group.title}</h2>
                      <p className="text-muted text-sm">{group.description}</p>
                    </div>

                    <div className="space-y-4">
                      {group.claims.map((claim) => (
                        <div
                          key={claim.id}
                          className="relative bg-surface border border-border rounded-xl p-5 hover:border-accent/50 hover:bg-surface-hover transition-all"
                        >
                          <Link
                            href={`/briefs/${claim.brief_id}`}
                            className="absolute inset-0"
                            aria-label={claim.brief.title}
                          />
                          <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">
                                  {claim.brief.title}
                                </h3>
                                <span
                                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${claimStatusColor(
                                    claim.status
                                  )}`}
                                >
                                  {claimStatusLabel(claim.status)}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full">
                                  {categoryLabel(claim.brief.category)}
                                </span>
                                <span className="px-2.5 py-1 bg-border text-muted text-xs font-mono rounded-full">
                                  {formatLabel(claim.brief.format)}
                                </span>
                                {claim.brief.gym && (
                                  <span className="px-2.5 py-1 bg-border text-muted text-xs rounded-full">
                                    {claim.brief.gym}
                                  </span>
                                )}
                              </div>

                              {claim.status === "active" && (
                                <p className="text-sm text-muted">
                                  <span className="font-mono">
                                    Expires: {formatDeadline(claim.expires_at)}
                                  </span>
                                </p>
                              )}

                              {claim.status === "paid" && claim.invoice && (
                                <a
                                  href={`/api/invoices/${claim.invoice.id}/pdf`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="relative inline-block text-sm text-accent hover:underline"
                                >
                                  Download invoice {claim.invoice.invoice_number}
                                </a>
                              )}
                            </div>

                            <div className="text-right">
                              <p className="font-mono text-xl text-accent font-bold">
                                {formatPrice(claim.brief.price_dkk)}
                              </p>
                              {claim.brief.deadline && (
                                <p className="text-muted text-sm mt-1 font-mono">
                                  Due: {formatDeadline(claim.brief.deadline)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
