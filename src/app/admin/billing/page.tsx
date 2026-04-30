import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import {
  formatDkk,
  formatFeeBp,
  resolveOrgPricing,
  type ResolvedPricing,
} from "@/lib/pricing";
import { BillingActions } from "./billing-actions";
import { UpgradeButton } from "./upgrade-button";
import { PaymentMethodButton } from "./payment-method-button";
import {
  getOrgPaymentMethodSummary,
  syncPaymentMethodFromSession,
} from "./actions";

export const dynamic = "force-dynamic";

interface SubscriptionRow {
  status: string;
  billing_interval: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  plan: { name: string; slug: string } | null;
}

interface PlanCard {
  slug: string;
  name: string;
  description: string | null;
  monthly_price_dkk: number;
  annual_price_dkk: number;
  trial_days: number;
  features: { analytics?: boolean; custom_branding?: boolean; discovery_boost?: boolean };
  limits: { max_active_briefs?: number | null; max_creators?: number | null };
  has_monthly_price: boolean;
  has_annual_price: boolean;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    setup?: string;
    session_id?: string;
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await requireActiveOrg(supabase);
  const { checkout, setup, session_id: setupSessionId } = await searchParams;

  // Setup callback: if Stripe sent us back with ?setup=success&session_id=…,
  // sync the resulting pm_id onto the org BEFORE we render so the
  // Payment method section reflects the new card immediately.
  // Idempotent — safe even if the user refreshes with the param still
  // in the URL.
  let setupSyncError: string | null = null;
  if (setup === "success" && setupSessionId) {
    const result = await syncPaymentMethodFromSession(setupSessionId);
    if (!result.ok) setupSyncError = result.error;
  }

  // Confirm the user is an admin of the org — billing is admin-only.
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();
  if (membership?.role !== "admin") {
    redirect("/admin");
  }

  const [pricing, subRow, planRows, pmSummary] = await Promise.all([
    resolveOrgPricing(supabase, orgId),
    supabase
      .from("org_subscriptions")
      .select(
        "status, billing_interval, trial_end, current_period_end, cancel_at_period_end, canceled_at, stripe_subscription_id, stripe_customer_id, plan:pricing_plans(name, slug)"
      )
      .eq("org_id", orgId)
      .single(),
    supabase
      .from("pricing_plans")
      .select(
        "slug, name, description, monthly_price_dkk, annual_price_dkk, trial_days, features, limits, stripe_monthly_price_id, stripe_annual_price_id, visible, legacy, private_to_org_id"
      )
      .eq("visible", true)
      .order("monthly_price_dkk", { ascending: true }),
    getOrgPaymentMethodSummary(),
  ]);

  const paymentMethod = pmSummary.ok ? pmSummary.pm : null;

  const subscription = subRow.data as unknown as SubscriptionRow | null;
  const plans: PlanCard[] = (planRows.data ?? [])
    .filter(
      (p) =>
        !p.legacy &&
        (p.private_to_org_id === null || p.private_to_org_id === orgId)
    )
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      monthly_price_dkk: p.monthly_price_dkk,
      annual_price_dkk: p.annual_price_dkk,
      trial_days: p.trial_days,
      features: (p.features ?? {}) as PlanCard["features"],
      limits: (p.limits ?? {}) as PlanCard["limits"],
      has_monthly_price: Boolean(p.stripe_monthly_price_id),
      has_annual_price: Boolean(p.stripe_annual_price_id),
    }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Billing</h1>
        <p className="text-muted">
          Your plan, your fees, and your invoices.
        </p>
      </div>

      {checkout === "success" && (
        <Banner
          tone="success"
          title="Subscription started"
          body="Stripe will confirm the change within a few seconds. Refresh if your plan still shows the old one."
        />
      )}
      {checkout === "cancelled" && (
        <Banner
          tone="muted"
          title="Checkout cancelled"
          body="No changes were made to your plan."
        />
      )}
      {setup === "success" && !setupSyncError && (
        <Banner
          tone="success"
          title="Payment method saved"
          body="Briefs you publish will charge the upfront escrow to this card."
        />
      )}
      {setup === "success" && setupSyncError && (
        <Banner
          tone="muted"
          title="Couldn't save payment method"
          body={setupSyncError}
        />
      )}
      {setup === "cancelled" && (
        <Banner
          tone="muted"
          title="Setup cancelled"
          body="No payment method was added."
        />
      )}

      <CurrentPlanSection
        pricing={pricing}
        subscription={subscription}
        orgId={orgId}
      />

      <PaymentMethodSection paymentMethod={paymentMethod} />

      <PlanCardsSection
        plans={plans}
        currentPlanSlug={pricing.plan?.slug ?? "free"}
      />

      <p className="text-xs text-muted mt-10">
        Charges and refunds are handled by Stripe. Past invoices live in
        your Stripe Customer Portal — open it from the &ldquo;Manage&rdquo;
        button above.
      </p>
    </div>
  );
}

function CurrentPlanSection({
  pricing,
  subscription,
  orgId,
}: {
  pricing: ResolvedPricing;
  subscription: SubscriptionRow | null;
  orgId: string;
}) {
  const planName = pricing.plan?.name ?? "Free";
  const interval = subscription?.billing_interval ?? "free";
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const trialEnd = subscription?.trial_end
    ? new Date(subscription.trial_end)
    : null;
  const status = subscription?.status ?? "free";

  const sourceBadge =
    pricing.source === "subscription"
      ? "From your subscription"
      : pricing.source === "org_override"
        ? "Comp account (admin override)"
        : pricing.source === "free_default"
          ? "Free plan"
          : pricing.source;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4">Current plan</h2>
      <div className="bg-surface border border-border rounded-xl p-6 grid sm:grid-cols-3 gap-6">
        <Field label="Plan">
          <p className="text-2xl font-bold">{planName}</p>
          <p className="text-xs text-muted mt-1">{sourceBadge}</p>
        </Field>
        <Field label="Take rate on payouts">
          <p className="text-2xl font-bold">{formatFeeBp(pricing.fee_bp)}</p>
          {pricing.applied_overrides.some((o) => o.kind === "fee_bp") && (
            <p className="text-xs text-warning mt-1">
              Adjusted by override
            </p>
          )}
        </Field>
        <Field label="Status">
          <p className="text-sm font-mono uppercase tracking-wider">{status}</p>
          {trialEnd && status === "trialing" && (
            <p className="text-xs text-muted mt-1">
              Trial ends {trialEnd.toLocaleDateString("en-GB")}
            </p>
          )}
          {periodEnd && status !== "free" && status !== "canceled" && (
            <p className="text-xs text-muted mt-1">
              {subscription?.cancel_at_period_end
                ? `Cancels ${periodEnd.toLocaleDateString("en-GB")}`
                : `Renews ${periodEnd.toLocaleDateString("en-GB")} (${interval})`}
            </p>
          )}
        </Field>
      </div>

      <div className="mt-4">
        <BillingActions
          orgId={orgId}
          hasStripeCustomer={Boolean(subscription?.stripe_customer_id)}
          hasActiveSubscription={Boolean(subscription?.stripe_subscription_id)}
        />
      </div>
    </section>
  );
}

function PaymentMethodSection({
  paymentMethod,
}: {
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}) {
  const hasPm = paymentMethod !== null;
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-2">
        Payment method for brief escrow
      </h2>
      <p className="text-sm text-muted mb-4">
        Charged when you publish a paid brief — the upfront amount is
        held in escrow and released to the creator when you approve
        their submission.
      </p>
      <div className="bg-surface border border-border rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          {hasPm ? (
            <>
              <p className="text-base font-medium">
                <span className="capitalize">{paymentMethod.brand}</span>
                <span className="mx-2 text-muted">••••</span>
                <span className="font-mono">{paymentMethod.last4}</span>
              </p>
              <p className="text-xs text-muted mt-1">
                Expires{" "}
                {String(paymentMethod.expMonth).padStart(2, "0")}/
                {paymentMethod.expYear}
              </p>
            </>
          ) : (
            <>
              <p className="text-base font-medium">No payment method on file</p>
              <p className="text-xs text-muted mt-1">
                Required before you can publish a paid brief.
              </p>
            </>
          )}
        </div>
        <PaymentMethodButton hasExisting={hasPm} />
      </div>
    </section>
  );
}

function PlanCardsSection({
  plans,
  currentPlanSlug,
}: {
  plans: PlanCard[];
  currentPlanSlug: string;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Available plans</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((p) => {
          const isCurrent = p.slug === currentPlanSlug;
          const monthlyConfigured = p.has_monthly_price;
          const annualConfigured = p.has_annual_price;
          return (
            <div
              key={p.slug}
              className={`bg-surface border rounded-xl p-6 ${
                isCurrent ? "border-accent" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-wider text-muted mb-1">
                    {p.slug}
                  </p>
                  <h3 className="text-xl font-bold">{p.name}</h3>
                </div>
                {isCurrent && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-accent/10 text-accent">
                    Current
                  </span>
                )}
              </div>
              {p.description && (
                <p className="text-sm text-muted mb-4">{p.description}</p>
              )}

              <div className="space-y-1 mb-4">
                <PriceRow
                  label="Monthly"
                  amount={p.monthly_price_dkk}
                  configured={monthlyConfigured || p.monthly_price_dkk === 0}
                />
                <PriceRow
                  label="Annual"
                  amount={p.annual_price_dkk}
                  configured={annualConfigured || p.annual_price_dkk === 0}
                />
              </div>

              <ul className="space-y-1.5 text-sm text-muted mb-4">
                <Bullet>
                  Active briefs:{" "}
                  {p.limits.max_active_briefs == null
                    ? "Unlimited"
                    : p.limits.max_active_briefs}
                </Bullet>
                <Bullet>
                  Creators:{" "}
                  {p.limits.max_creators == null
                    ? "Unlimited"
                    : p.limits.max_creators}
                </Bullet>
                {p.features.analytics && <Bullet>Analytics</Bullet>}
                {p.features.custom_branding && <Bullet>Custom branding</Bullet>}
                {p.features.discovery_boost && <Bullet>Discovery boost</Bullet>}
              </ul>

              {!isCurrent && p.monthly_price_dkk > 0 && (
                <UpgradeForm
                  planSlug={p.slug}
                  monthlyConfigured={monthlyConfigured}
                  annualConfigured={annualConfigured}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function UpgradeForm({
  planSlug,
  monthlyConfigured,
  annualConfigured,
}: {
  planSlug: string;
  monthlyConfigured: boolean;
  annualConfigured: boolean;
}) {
  if (!monthlyConfigured && !annualConfigured) {
    return (
      <p className="text-xs text-warning">
        Stripe price IDs aren&apos;t configured for this plan. A platform
        admin needs to set them up before this is purchasable.
      </p>
    );
  }
  return (
    <div className="flex gap-2">
      {monthlyConfigured && (
        <UpgradeButton planSlug={planSlug} interval="monthly" label="Pick monthly" />
      )}
      {annualConfigured && (
        <UpgradeButton planSlug={planSlug} interval="annual" label="Pick annual" />
      )}
    </div>
  );
}

function PriceRow({
  label,
  amount,
  configured,
}: {
  label: string;
  amount: number;
  configured: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">
        {amount === 0 ? "Free" : formatDkk(amount)}
        {!configured && amount > 0 && (
          <span className="ml-2 text-xs text-warning">(price ID not set)</span>
        )}
      </span>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-accent shrink-0">·</span>
      <span>{children}</span>
    </li>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "success" | "muted";
  title: string;
  body: string;
}) {
  const cls =
    tone === "success"
      ? "bg-success-muted border-success/30 text-success"
      : "bg-surface border-border text-muted";
  return (
    <div className={`mb-6 border rounded-lg p-4 ${cls}`}>
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-0.5">{body}</p>
    </div>
  );
}
