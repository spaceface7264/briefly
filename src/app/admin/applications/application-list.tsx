"use client";

import { useState } from "react";
import { reviewApplication } from "./actions";

export interface Application {
  id: string;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string | null;
    instagram_handle: string | null;
  } | null;
}

export function ApplicationList({
  pending,
  reviewed,
}: {
  pending: Application[];
  reviewed: Application[];
}) {
  return (
    <div className="space-y-8">
      {pending.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Pending</h2>
          <div className="space-y-3">
            {pending.map((app) => (
              <ApplicationRow key={app.id} application={app} />
            ))}
          </div>
        </section>
      )}

      {reviewed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 text-muted">Reviewed</h2>
          <div className="space-y-3">
            {reviewed.map((app) => (
              <ApplicationRow key={app.id} application={app} />
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && reviewed.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted">No applications yet.</p>
          <p className="text-muted text-sm mt-1">
            Make your organization discoverable in Settings to start receiving applications.
          </p>
        </div>
      )}
    </div>
  );
}

function ApplicationRow({ application }: { application: Application }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const isPending = application.status === "pending";

  async function handleReview(decision: "approved" | "rejected") {
    setLoading(true);
    const res = await reviewApplication(application.id, decision);
    if (res.ok) {
      setResult(decision);
    }
    setLoading(false);
  }

  const displayStatus = result || application.status;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium truncate">
            {application.applicant?.name || application.applicant?.email || "Unknown"}
          </p>
          {application.applicant?.instagram_handle && (
            <span className="text-xs text-muted">
              @{application.applicant.instagram_handle}
            </span>
          )}
        </div>
        {application.applicant?.email && (
          <p className="text-sm text-muted truncate">
            {application.applicant.email}
          </p>
        )}
        {application.message && (
          <p className="text-sm text-muted mt-2 italic">
            &ldquo;{application.message}&rdquo;
          </p>
        )}
        <p className="text-xs text-muted mt-2 font-mono">
          Applied {new Date(application.created_at).toLocaleDateString("en-GB")}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isPending && !result ? (
          <>
            <button
              onClick={() => handleReview("approved")}
              disabled={loading}
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => handleReview("rejected")}
              disabled={loading}
              className="px-4 py-1.5 border border-border hover:border-border-strong text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </>
        ) : (
          <span
            className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              displayStatus === "approved"
                ? "bg-accent/10 text-accent"
                : "bg-surface-raised text-muted"
            }`}
          >
            {displayStatus === "approved" ? "Approved" : "Rejected"}
          </span>
        )}
      </div>
    </div>
  );
}
