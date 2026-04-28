"use client";

import { useState } from "react";
import { OrgDetailModal } from "./org-detail-modal";

interface OrgCardProps {
  org: {
    id: string;
    slug: string;
    name: string;
    logo_url: string | null;
    description: string | null;
    industry: string | null;
    accent_color: string | null;
  };
  openBriefs: number;
  isMember: boolean;
  applicationStatus: string | null;
  isAuthenticated: boolean;
  /** False for org accounts — they can browse but not apply. */
  canApply: boolean;
}

export function OrgCard({
  org,
  openBriefs,
  isMember,
  applicationStatus,
  isAuthenticated,
  canApply,
}: OrgCardProps) {
  const [open, setOpen] = useState(false);
  const [appliedLocally, setAppliedLocally] = useState(false);

  const effectiveStatus = appliedLocally ? "pending" : applicationStatus;

  const statusLabel = isMember
    ? "Member"
    : effectiveStatus === "pending"
      ? "Applied"
      : effectiveStatus === "rejected"
        ? "Not accepted"
        : null;

  const statusToneClass = isMember
    ? "bg-accent/10 text-accent"
    : effectiveStatus === "pending"
      ? "bg-warning/10 text-warning"
      : "bg-surface-raised text-muted";

  const accent = org.accent_color || "#C8FF00";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left group bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-border-strong hover:bg-surface-hover transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:border-accent/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={org.logo_url}
                alt={org.name}
                className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border bg-background"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-background font-bold text-lg shrink-0"
                style={{ backgroundColor: accent }}
              >
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{org.name}</h3>
              {org.industry && (
                <p className="text-xs text-muted truncate">{org.industry}</p>
              )}
            </div>
          </div>

          {statusLabel && (
            <span
              className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${statusToneClass}`}
            >
              {statusLabel}
            </span>
          )}
        </div>

        {org.description && (
          <p className="text-sm text-muted line-clamp-2">{org.description}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-muted font-mono">
            {openBriefs} open brief{openBriefs !== 1 ? "s" : ""}
          </span>
          <span className="text-xs font-medium text-muted group-hover:text-accent transition-colors">
            Read more →
          </span>
        </div>
      </button>

      <OrgDetailModal
        open={open}
        onClose={() => setOpen(false)}
        org={org}
        openBriefs={openBriefs}
        isMember={isMember}
        applicationStatus={effectiveStatus}
        isAuthenticated={isAuthenticated}
        canApply={canApply}
        onApplied={() => setAppliedLocally(true)}
      />
    </>
  );
}
