"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEmailNotificationsEnabled } from "./actions";

interface NotificationsToggleProps {
  enabled: boolean;
  notifiedAdminCount: number;
  totalAdminCount: number;
}

export function NotificationsToggle({
  enabled: initialEnabled,
  notifiedAdminCount,
  totalAdminCount,
}: NotificationsToggleProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);

    startTransition(async () => {
      const result = await setEmailNotificationsEnabled(next);
      if (!result.ok) {
        setEnabled(!next);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const othersNotified = enabled
    ? notifiedAdminCount - 1
    : notifiedAdminCount;
  const isOnlyNotified = enabled && othersNotified === 0 && totalAdminCount > 1;
  const noOneNotified = !enabled && notifiedAdminCount === 0;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">Your email notifications</h2>
        <p className="text-muted text-sm">
          Only applies to your account. Other admins manage their own.
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-medium">Submission alerts</p>
            <p className="text-muted text-sm mt-0.5">
              Email when a creator submits work that needs review.
            </p>
            {isOnlyNotified && (
              <p className="text-xs text-warning mt-2">
                You&apos;re the only admin currently notified. If you turn
                this off, submissions will go unreviewed.
              </p>
            )}
            {noOneNotified && (
              <p className="text-xs text-warning mt-2">
                No admin is currently set to receive submission alerts.
                At least one should be.
              </p>
            )}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Toggle submission email alerts"
            onClick={toggle}
            disabled={pending}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
              enabled ? "bg-accent" : "bg-surface-raised border border-border"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-3">
          <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <p className="text-error text-sm">{error}</p>
        </div>
      )}
    </section>
  );
}
