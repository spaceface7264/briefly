"use client";

import { useState } from "react";
import { updateOrgDetails } from "./org-actions";

interface Props {
  orgId: string;
  discoverable: boolean;
  orgName: string;
  orgDescription: string;
  /**
   * Whether the viewer can flip the discoverability toggle. Members
   * see a static status card with an "Admin only" hint. The
   * underlying server action also rejects non-admins via
   * `requireOrgAdmin()`.
   */
  canManage: boolean;
}

export function DiscoverabilityToggle({
  discoverable: initialDiscoverable,
  orgDescription,
  canManage,
}: Props) {
  const [discoverable, setDiscoverable] = useState(initialDiscoverable);
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    const result = await updateOrgDetails({ discoverable: !discoverable });
    if (result.ok) {
      setDiscoverable(!discoverable);
    }
    setSaving(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold mb-1">Creator Discovery</h2>
          <p className="text-muted text-sm">
            When enabled, your organization appears on the Discover page where
            creators can find you and apply to join your roster.
          </p>
        </div>
        {!canManage && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-raised border border-border text-xs text-muted">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Admin only
          </span>
        )}
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">
              {discoverable ? "Discoverable" : "Hidden"}
            </p>
            <p className="text-sm text-muted mt-0.5">
              {discoverable
                ? "Creators can find and apply to your organization"
                : "Only invite codes can add creators to your roster"}
            </p>
          </div>
          {canManage ? (
            <button
              onClick={handleToggle}
              disabled={saving}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                discoverable ? "bg-accent" : "bg-border"
              } ${saving ? "opacity-50" : ""}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                  discoverable ? "translate-x-5" : ""
                }`}
              />
            </button>
          ) : (
            <div
              className={`relative w-11 h-6 rounded-full opacity-60 ${
                discoverable ? "bg-accent" : "bg-border"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background ${
                  discoverable ? "translate-x-5" : ""
                }`}
              />
            </div>
          )}
        </div>

        {canManage && discoverable && !orgDescription && (
          <p className="text-sm text-warning mt-3">
            Add a description in your org settings so creators know what you do.
          </p>
        )}
      </div>
    </section>
  );
}
