"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { startStripeOnboarding } from "../stripe-actions";
import { saveBillingDetails, type BillingDetailsInput } from "../billing-actions";
import { COUNTRY_LABELS, EU_COUNTRIES } from "@/lib/invoicing/vat";
import {
  SELF_BILLING_AGREEMENT_TEXT,
  SELF_BILLING_AGREEMENT_VERSION,
} from "@/lib/invoicing/platform";
import type { Profile } from "@/types/database";

interface Props {
  profile: Profile | null;
}

export function PayoutsClient({ profile }: Props) {
  const payoutsEnabled = profile?.stripe_payouts_enabled ?? false;
  const hasStripeAccount = Boolean(profile?.stripe_account_id);
  const detailsSubmitted = profile?.stripe_details_submitted ?? false;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payouts</h1>
        <p className="text-muted">
          Fill in your billing details, accept the self-billing agreement, and
          connect a Stripe payout account to receive payments.
        </p>
      </div>

      <BillingDetailsForm profile={profile} />

      <div className="mt-8 pt-8 border-t border-border">
        <h2 className="text-xl font-bold mb-4">Stripe Connect</h2>
        <StripeConnectSection
          hasAccount={hasStripeAccount}
          detailsSubmitted={detailsSubmitted}
          payoutsEnabled={payoutsEnabled}
        />
      </div>
    </>
  );
}

function BillingDetailsForm({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [country, setCountry] = useState(profile?.country ?? "DK");
  const [line1, setLine1] = useState(profile?.billing_address_line1 ?? "");
  const [line2, setLine2] = useState(profile?.billing_address_line2 ?? "");
  const [postalCode, setPostalCode] = useState(profile?.billing_postal_code ?? "");
  const [city, setCity] = useState(profile?.billing_city ?? "");
  const [vatRegistered, setVatRegistered] = useState(
    profile?.vat_registered ?? false
  );
  const [vatNumber, setVatNumber] = useState(profile?.vat_number ?? "");
  const [cvrNumber, setCvrNumber] = useState(profile?.cvr_number ?? "");

  const currentAgreementAccepted =
    profile?.self_billing_agreement_version === SELF_BILLING_AGREEMENT_VERSION &&
    Boolean(profile?.self_billing_agreement_accepted_at);

  const [acceptAgreement, setAcceptAgreement] = useState(
    currentAgreementAccepted
  );
  const [showAgreement, setShowAgreement] = useState(false);

  const countryOptions = ["DK", ...[...EU_COUNTRIES].filter((c) => c !== "DK").sort()];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const input: BillingDetailsInput = {
      country,
      billingAddressLine1: line1,
      billingAddressLine2: line2,
      billingPostalCode: postalCode,
      billingCity: city,
      vatRegistered,
      vatNumber,
      cvrNumber,
      acceptSelfBillingAgreement: acceptAgreement,
    };

    startTransition(async () => {
      const result = await saveBillingDetails(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          >
            {countryOptions.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_LABELS[code] ?? code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Postal code</label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Address line 1</label>
        <input
          type="text"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          placeholder="Street and number"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Address line 2</label>
        <input
          type="text"
          value={line2}
          onChange={(e) => setLine2(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          placeholder="Apartment, floor, c/o (optional)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">City</label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
        />
      </div>

      <div className="pt-2 border-t border-border">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={vatRegistered}
            onChange={(e) => setVatRegistered(e.target.checked)}
            className="accent-accent"
          />
          <span className="text-sm font-medium">I am VAT-registered</span>
        </label>
        <p className="text-muted text-xs mt-1">
          Required if your annual revenue is above the VAT threshold in your
          country (in Denmark: 50,000 DKK).
        </p>
      </div>

      {vatRegistered && (
        <div>
          <label className="block text-sm font-medium mb-1">VAT number</label>
          <input
            type="text"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            placeholder={country === "DK" ? "DK12345678" : "e.g. DE123456789"}
          />
        </div>
      )}

      {country === "DK" && (
        <div>
          <label className="block text-sm font-medium mb-1">
            CVR number <span className="text-muted">(optional, for businesses)</span>
          </label>
          <input
            type="text"
            value={cvrNumber}
            onChange={(e) => setCvrNumber(e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            placeholder="12345678"
          />
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={acceptAgreement}
            onChange={(e) => setAcceptAgreement(e.target.checked)}
            className="accent-accent mt-1"
          />
          <span className="text-sm">
            I accept the{" "}
            <button
              type="button"
              onClick={() => setShowAgreement((v) => !v)}
              className="text-accent hover:underline"
            >
              self-billing agreement
            </button>
            {" "}(
            <a
              href="/legal/self-billing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              open in a new tab
            </a>
            ). The platform may issue invoices on my behalf for payouts
            delivered through this platform.
          </span>
        </label>
        {currentAgreementAccepted && profile?.self_billing_agreement_accepted_at && (
          <p className="text-muted text-xs mt-1">
            Accepted on{" "}
            {new Date(profile.self_billing_agreement_accepted_at).toLocaleDateString("en-GB")}{" "}
            (version {profile.self_billing_agreement_version}).
          </p>
        )}
        {showAgreement && (
          <pre className="mt-3 p-4 bg-surface border border-border rounded-lg text-xs whitespace-pre-wrap font-mono text-muted">
            {SELF_BILLING_AGREEMENT_TEXT}
          </pre>
        )}
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-semibold rounded-lg transition-colors text-sm"
        >
          {pending ? "Saving..." : "Save billing details"}
        </button>
        {saved && <span className="text-success text-sm">Saved</span>}
      </div>
    </form>
  );
}

function StripeConnectSection({
  hasAccount,
  detailsSubmitted,
  payoutsEnabled,
}: {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    startTransition(async () => {
      await startStripeOnboarding();
    });
  }

  let statusLabel = "Not connected";
  let statusTone: StatusTone = "neutral";
  let ctaLabel = "Connect payout account";

  if (payoutsEnabled) {
    statusLabel = "Payouts enabled";
    statusTone = "success";
    ctaLabel = "Update payout details";
  } else if (hasAccount && detailsSubmitted) {
    statusLabel = "Under review";
    statusTone = "warning";
    ctaLabel = "Update payout details";
  } else if (hasAccount) {
    statusLabel = "Onboarding incomplete";
    statusTone = "warning";
    ctaLabel = "Continue onboarding";
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <StatusPill tone={statusTone}>{statusLabel}</StatusPill>
      <button
        type="button"
        onClick={handleConnect}
        disabled={pending}
        className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-semibold rounded-lg transition-colors text-sm"
      >
        {pending ? "Redirecting..." : ctaLabel}
      </button>
    </div>
  );
}
