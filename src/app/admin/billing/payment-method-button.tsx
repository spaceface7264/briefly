"use client";

import { useTransition } from "react";
import { toast } from "sonner";
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

  function handleClick() {
    startTransition(async () => {
      const result = await createPaymentMethodSetupSession();
      if (!result.ok) {
        toast.error("Couldn't open Stripe", { description: result.error });
        return;
      }
      window.location.href = result.url;
    });
  }

  const label = hasExisting ? "Replace payment method" : "Add payment method";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="self-start px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
    >
      {pending ? "Opening Stripe…" : label}
    </button>
  );
}
