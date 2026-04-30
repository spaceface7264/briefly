"use client";

import { useState, useTransition } from "react";
import { createPaymentMethodSetupSession } from "./actions";

interface Props {
  /** Determines the button label and tone. */
  hasExisting: boolean;
}

/**
 * Triggers the Stripe-hosted setup Checkout. On success the action
 * returns a URL; we navigate to it. The user comes back to
 * /admin/billing?setup=success&session_id=… where the page calls
 * syncPaymentMethodFromSession to record the resulting pm_id.
 */
export function PaymentMethodButton({ hasExisting }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createPaymentMethodSetupSession();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  const label = hasExisting ? "Replace payment method" : "Add payment method";

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="self-start px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {pending ? "Opening Stripe…" : label}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
