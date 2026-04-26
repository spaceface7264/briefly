"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyToOrg } from "./actions";

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
}

export function OrgCard({
  org,
  openBriefs,
  isMember,
  applicationStatus,
  isAuthenticated,
}: OrgCardProps) {
  const router = useRouter();
  const [showApply, setShowApply] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(applicationStatus === "pending");

  async function handleApply() {
    setSubmitting(true);
    setError(null);
    const result = await applyToOrg(org.id, message);
    if (result.ok) {
      setApplied(true);
      setShowApply(false);
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  }

  const statusLabel = isMember
    ? "Member"
    : applied || applicationStatus === "pending"
      ? "Applied"
      : applicationStatus === "rejected"
        ? "Not accepted"
        : null;

  return (
    <div className="bg-surface border border-border rounded-xl p-6 flex flex-col gap-4 hover:border-border-strong transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {org.logo_url ? (
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-background font-bold text-lg shrink-0"
              style={{ backgroundColor: org.accent_color || "#C8FF00" }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{org.name}</h3>
            {org.industry && (
              <p className="text-xs text-muted">{org.industry}</p>
            )}
          </div>
        </div>

        {statusLabel && (
          <span
            className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-full ${
              isMember
                ? "bg-accent/10 text-accent"
                : applied || applicationStatus === "pending"
                  ? "bg-warning/10 text-warning"
                  : "bg-surface-raised text-muted"
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {org.description && (
        <p className="text-sm text-muted line-clamp-2">{org.description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-xs text-muted font-mono">
          {openBriefs} open brief{openBriefs !== 1 ? "s" : ""}
        </span>

        {!isMember && !applied && applicationStatus !== "pending" && applicationStatus !== "rejected" && (
          <button
            onClick={() => {
              if (!isAuthenticated) {
                router.push("/login");
                return;
              }
              setShowApply(!showApply);
            }}
            className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
          >
            {isAuthenticated ? "Apply to join" : "Log in to apply"}
          </button>
        )}

        {isMember && (
          <button
            onClick={() => router.push("/briefs")}
            className="px-4 py-1.5 border border-border hover:border-border-strong text-sm font-medium rounded-lg transition-colors"
          >
            View briefs
          </button>
        )}
      </div>

      {showApply && (
        <div className="border-t border-border pt-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself (optional)..."
            rows={3}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowApply(false)}
              className="px-4 py-1.5 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={submitting}
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Send application"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
