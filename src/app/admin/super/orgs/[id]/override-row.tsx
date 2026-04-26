"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeOverride } from "./actions";

interface OverrideRecord {
  id: string;
  kind: string;
  value: Record<string, unknown>;
  reason: string;
  granted_at: string;
  expires_at: string | null;
  active: boolean;
  granter: { name: string | null; email: string | null } | null;
}

export function OverrideRow({ override }: { override: OverrideRecord }) {
  const router = useRouter();
  const [showRevoke, setShowRevoke] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleRevoke() {
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters");
      return;
    }
    setError(null);
    start(async () => {
      const result = await revokeOverride(override.id, reason.trim());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShowRevoke(false);
      router.refresh();
    });
  }

  const expires = override.expires_at
    ? new Date(override.expires_at).toLocaleDateString("en-GB")
    : "never";

  return (
    <div className="bg-surface border border-border rounded-lg px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-mono text-xs px-1.5 py-0.5 bg-surface-raised rounded mr-2">
              {override.kind}
            </span>
            <span className="font-mono text-xs text-muted">
              {JSON.stringify(override.value)}
            </span>
          </p>
          <p className="text-sm text-muted mt-1.5">
            {override.reason}
          </p>
          <p className="text-xs text-muted mt-1">
            Granted by {override.granter?.name || override.granter?.email || "system"}
            {" · "}
            {new Date(override.granted_at).toLocaleDateString("en-GB")}
            {" · expires "}
            {expires}
          </p>
        </div>

        {override.active && !showRevoke && (
          <button
            type="button"
            onClick={() => setShowRevoke(true)}
            className="text-xs text-muted hover:text-error transition-colors px-2 py-1 shrink-0"
          >
            Revoke
          </button>
        )}
      </div>

      {showRevoke && (
        <div className="mt-3 space-y-2 pt-3 border-t border-border">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Revoke reason (logged)"
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg"
            minLength={3}
          />
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setShowRevoke(false);
                setReason("");
                setError(null);
              }}
              className="text-xs text-muted hover:text-foreground px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={pending}
              className="text-xs bg-error text-background px-3 py-1.5 rounded-lg hover:opacity-80 disabled:opacity-50 transition-opacity font-semibold"
            >
              {pending ? "Revoking…" : "Confirm revoke"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
