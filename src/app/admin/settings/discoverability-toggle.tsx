"use client";

import { useState } from "react";
import { updateOrgDetails } from "./org-actions";

interface Props {
  orgId: string;
  discoverable: boolean;
  orgName: string;
  orgDescription: string;
}

export function DiscoverabilityToggle({
  orgId,
  discoverable: initialDiscoverable,
  orgName,
  orgDescription,
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
      <div>
        <h2 className="text-xl font-semibold mb-1">Creator Discovery</h2>
        <p className="text-muted text-sm">
          When enabled, your organization appears on the Discover page where
          creators can find you and apply to join your roster.
        </p>
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
        </div>

        {discoverable && !orgDescription && (
          <p className="text-sm text-warning mt-3">
            Add a description in your org settings so creators know what you do.
          </p>
        )}
      </div>
    </section>
  );
}
