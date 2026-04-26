"use client";

import { useState, useTransition } from "react";
import { createCheckoutSession } from "./actions";

export function UpgradeButton({
  planSlug,
  interval,
  label,
}: {
  planSlug: string;
  interval: "monthly" | "annual";
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleClick() {
    setError(null);
    start(async () => {
      const result = await createCheckoutSession(planSlug, interval);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <div className="flex flex-col gap-2 flex-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
      >
        {pending ? "Opening Stripe…" : label}
      </button>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
