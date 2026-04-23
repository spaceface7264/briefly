"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNotificationPreference } from "@/app/profile/notification-actions";
import {
  notificationTypesFor,
  type NotificationPreferences,
  type NotificationType,
  type NotificationTypeDef,
} from "@/lib/notifications";
import type { UserRole } from "@/types/database";

interface NotificationsPanelProps {
  role: UserRole;
  preferences: NotificationPreferences;
  /** Per-type warnings shown under a row when toggling off would cause
   *  coverage problems. Renders verbatim when provided for that type. */
  warningsByType?: Partial<Record<NotificationType, React.ReactNode>>;
  title?: string;
  description?: string;
}

export function NotificationsPanel({
  role,
  preferences,
  warningsByType,
  title = "Your email notifications",
  description = "Only applies to your account. You can turn each type on or off individually.",
}: NotificationsPanelProps) {
  const types = notificationTypesFor(role);

  if (types.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold mb-1">{title}</h2>
        <p className="text-muted text-sm">{description}</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
        {types.map((type) => (
          <NotificationRow
            key={type.key}
            type={type}
            initialEnabled={preferences[type.key]}
            warning={warningsByType?.[type.key]}
          />
        ))}
      </div>
    </section>
  );
}

function NotificationRow({
  type,
  initialEnabled,
  warning,
}: {
  type: NotificationTypeDef;
  initialEnabled: boolean;
  warning?: React.ReactNode;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);

    startTransition(async () => {
      const result = await setNotificationPreference(type.key, next);
      if (!result.ok) {
        setEnabled(!next);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{type.label}</p>
          <p className="text-muted text-sm mt-0.5">{type.description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Toggle ${type.label}`}
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

      {enabled && warning && (
        <p className="text-xs text-warning mt-2">{warning}</p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-error-muted border border-error/30 rounded-lg p-2.5 mt-3">
          <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <p className="text-error text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
