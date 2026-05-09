"use client";

import { useState, useTransition } from "react";
import { createPortalSession } from "./actions";

export function BillingActions({
  orgId,
  hasStripeCustomer,
  hasActiveSubscription,
}: {
  orgId: string;
  hasStripeCustomer: boolean;
  hasActiveSubscription: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function openPortal() {
    setError(null);
    start(async () => {
      const result = await createPortalSession();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  if (!hasStripeCustomer && !hasActiveSubscription) {
    return (
      <p className="text-sm text-muted">
        Pick a paid plan below to start a subscription.
        {" "}
        <span className="font-mono text-xs">org={orgId.slice(0, 8)}…</span>
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={openPortal}
        disabled={pending}
        className="px-4 py-2 border border-border-strong hover:bg-surface-hover disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
      >
        {pending ? "Opening Stripe…" : "Manage in Stripe"}
      </button>
      <p className="text-xs text-muted">
        Update payment method, switch interval, cancel — all in the
        Stripe-hosted portal.
      </p>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
