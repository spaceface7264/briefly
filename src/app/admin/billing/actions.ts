"use server";

import type Stripe from "stripe";
import { stripe, appUrl } from "@/lib/stripe/server";
import { getOrCreateOrgStripeCustomer } from "@/lib/stripe/customer";
import { requireOrgAdmin } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type ActionResult<T = void> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type SubUpdate = Database["public"]["Tables"]["org_subscriptions"]["Update"];

/**
 * Begin a Stripe Checkout flow for the org admin to subscribe to a
 * paid plan. Creates (or reuses) the org's Stripe customer first so
 * subsequent self-service portal sessions know who they are.
 *
 * The plan must have a real `stripe_*_price_id` populated — the
 * platform admin sets these up once per plan via the Stripe Dashboard
 * + a SQL UPDATE. See docs/monetisation.md.
 */
export async function createCheckoutSession(
  planSlug: string,
  interval: "monthly" | "annual"
): Promise<ActionResult<{ url: string }>> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  // Use admin client so we can read the org_subscriptions row even if
  // the admin's RLS context wouldn't ordinarily permit a write later.
  const adminDb = createAdminClient();

  const { data: plan, error: planErr } = await adminDb
    .from("pricing_plans")
    .select("id, slug, name, stripe_monthly_price_id, stripe_annual_price_id, monthly_price_dkk, annual_price_dkk, trial_days, private_to_org_id")
    .eq("slug", planSlug)
    .single();

  if (planErr || !plan) {
    return { ok: false, error: "Plan not found" };
  }

  if (plan.private_to_org_id && plan.private_to_org_id !== gate.orgId) {
    return { ok: false, error: "Plan not available to this org" };
  }

  const priceId =
    interval === "monthly"
      ? plan.stripe_monthly_price_id
      : plan.stripe_annual_price_id;

  if (!priceId) {
    return {
      ok: false,
      error: `Plan "${plan.slug}" has no Stripe ${interval} price configured. A platform admin needs to populate it via the Stripe Dashboard, then UPDATE pricing_plans SET stripe_${interval}_price_id = '…'.`,
    };
  }

  const { data: org } = await adminDb
    .from("organizations")
    .select("id, name")
    .eq("id", gate.orgId)
    .single();
  if (!org) return { ok: false, error: "Org not found" };

  const { data: admin } = await adminDb
    .from("profiles")
    .select("email, name")
    .eq("id", gate.userId)
    .single();

  const customerId = await getOrCreateOrgStripeCustomer(adminDb, gate.orgId, {
    name: org.name,
    email: admin?.email ?? null,
  });

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: plan.trial_days > 0 ? plan.trial_days : undefined,
      metadata: {
        org_id: gate.orgId,
        plan_slug: plan.slug,
        billing_interval: interval,
      },
    },
    success_url: `${appUrl()}/admin/billing?checkout=success`,
    cancel_url: `${appUrl()}/admin/billing?checkout=cancelled`,
    allow_promotion_codes: true,
  });

  if (!session.url) {
    return { ok: false, error: "Stripe did not return a checkout URL" };
  }
  return { ok: true, url: session.url };
}

/**
 * Open the Stripe-hosted Customer Portal so the org admin can update
 * payment method, switch interval, or cancel.
 */
export async function createPortalSession(): Promise<
  ActionResult<{ url: string }>
> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const adminDb = createAdminClient();
  const { data: subRow } = await adminDb
    .from("org_subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", gate.orgId)
    .single();

  if (!subRow?.stripe_customer_id) {
    return {
      ok: false,
      error: "No Stripe customer on file — start by upgrading first.",
    };
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: subRow.stripe_customer_id,
    return_url: `${appUrl()}/admin/billing`,
  });

  return { ok: true, url: session.url };
}

/**
 * Apply a Stripe subscription event to the matching org_subscriptions
 * row. Called from the webhook handler. Idempotent — re-firing the
 * same event is safe.
 *
 * Uses the service-role admin client because webhook events arrive
 * without a user session.
 */
export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription
): Promise<void> {
  const adminDb = createAdminClient();

  const orgId = subscription.metadata?.org_id;
  const planSlug = subscription.metadata?.plan_slug;
  const interval = subscription.metadata?.billing_interval as
    | "monthly"
    | "annual"
    | undefined;

  if (!orgId) {
    console.error(
      "Stripe subscription is missing org_id metadata:",
      subscription.id
    );
    return;
  }

  const { data: plan } = planSlug
    ? await adminDb
        .from("pricing_plans")
        .select("id")
        .eq("slug", planSlug)
        .single()
    : { data: null };

  // Phase-3 Stripe statuses we accept verbatim. Anything else (e.g.
  // 'incomplete') we still record so the resolver can fall through.
  const status = subscription.status as
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid"
    | "paused";

  type SubAny = Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const subAny = subscription as SubAny;

  const update: SubUpdate = {
    status,
    stripe_subscription_id: subscription.id,
    stripe_customer_id:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    current_period_start: subAny.current_period_start
      ? new Date(subAny.current_period_start * 1000).toISOString()
      : null,
    current_period_end: subAny.current_period_end
      ? new Date(subAny.current_period_end * 1000).toISOString()
      : null,
  };

  if (interval) update.billing_interval = interval;
  if (plan) update.plan_id = plan.id;

  // If the subscription is gone, also revert the plan to Free so the
  // resolver doesn't keep returning the paid plan with a canceled
  // status forever.
  if (status === "canceled" || status === "incomplete_expired") {
    const { data: freePlan } = await adminDb
      .from("pricing_plans")
      .select("id")
      .eq("slug", "free")
      .single();
    if (freePlan) {
      update.plan_id = freePlan.id;
      update.billing_interval = "free";
      update.status = "free";
    }
  }

  await adminDb
    .from("org_subscriptions")
    .update(update)
    .eq("org_id", orgId);
}

/**
 * Open a Stripe-hosted Checkout in `mode: setup` so the org admin can
 * collect a card without charging it. The resulting payment method is
 * attached to the org's Stripe Customer; on return,
 * `syncPaymentMethodFromSession` records the `pm_…` id on
 * `organizations.default_payment_method_id`.
 *
 * Used by Phase 1.1c onwards as the source for escrow PaymentIntent
 * charges when a brief is published.
 */
export async function createPaymentMethodSetupSession(): Promise<
  ActionResult<{ url: string }>
> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const adminDb = createAdminClient();

  const { data: org } = await adminDb
    .from("organizations")
    .select("id, name")
    .eq("id", gate.orgId)
    .single();
  if (!org) return { ok: false, error: "Org not found" };

  const { data: admin } = await adminDb
    .from("profiles")
    .select("email")
    .eq("id", gate.userId)
    .single();

  const customerId = await getOrCreateOrgStripeCustomer(adminDb, gate.orgId, {
    name: org.name,
    email: admin?.email ?? null,
  });

  const session = await stripe().checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    payment_method_types: ["card"],
    success_url: `${appUrl()}/admin/billing?setup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/admin/billing?setup=cancelled`,
  });

  if (!session.url) {
    return { ok: false, error: "Stripe did not return a setup URL" };
  }
  return { ok: true, url: session.url };
}

/**
 * Called from `/admin/billing` when the page loads with
 * `?setup=success&session_id=…`. Reads the completed setup session,
 * extracts the payment method, sets it as the customer's
 * `invoice_settings.default_payment_method`, and records the id on
 * `organizations.default_payment_method_id`.
 *
 * Idempotent — safe to call multiple times for the same session.
 * Verifies the session's customer belongs to the caller's org so a
 * malicious caller can't pass an arbitrary session id and rebind
 * someone else's payment method.
 */
export async function syncPaymentMethodFromSession(
  sessionId: string
): Promise<ActionResult<{ pmId: string }>> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const adminDb = createAdminClient();

  const { data: org } = await adminDb
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", gate.orgId)
    .single();
  if (!org?.stripe_customer_id) {
    return { ok: false, error: "Org has no Stripe customer on file" };
  }

  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: ["setup_intent.payment_method"],
  });

  if (session.mode !== "setup") {
    return { ok: false, error: "Not a setup session" };
  }

  const sessionCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  if (sessionCustomerId !== org.stripe_customer_id) {
    return {
      ok: false,
      error: "Setup session customer does not match this org",
    };
  }

  const setupIntent = session.setup_intent;
  const setupIntentObj =
    typeof setupIntent === "object" && setupIntent ? setupIntent : null;
  if (!setupIntentObj) {
    return { ok: false, error: "Setup session has no setup intent" };
  }

  const pm = setupIntentObj.payment_method;
  const pmId =
    typeof pm === "string" ? pm : typeof pm === "object" && pm ? pm.id : null;
  if (!pmId) {
    return { ok: false, error: "No payment method on the setup session" };
  }

  // Make this the default for any future invoices/charges on the
  // customer (used by 1.1c when we charge the escrow PaymentIntent).
  await stripe().customers.update(org.stripe_customer_id, {
    invoice_settings: { default_payment_method: pmId },
  });

  await adminDb
    .from("organizations")
    .update({ default_payment_method_id: pmId })
    .eq("id", gate.orgId);

  // Intentionally no revalidatePath: this action is invoked from the
  // /admin/billing Server Component render itself when Stripe redirects
  // back with ?setup=success&session_id=…. Calling revalidatePath
  // during a render is forbidden by Next 16. The page is
  // `dynamic = "force-dynamic"` and fetches fresh data on every load,
  // so the just-saved pm shows up on the same render that triggered
  // this sync.
  return { ok: true, pmId };
}

/**
 * Read the cached payment method's display details for the
 * "Payment method on file" section on /admin/billing. Returns
 * brand + last4 + exp; null if none configured.
 */
export async function getOrgPaymentMethodSummary(): Promise<
  | { ok: true; pm: { brand: string; last4: string; expMonth: number; expYear: number } | null }
  | { ok: false; error: string }
> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const adminDb = createAdminClient();
  const { data: org } = await adminDb
    .from("organizations")
    .select("default_payment_method_id")
    .eq("id", gate.orgId)
    .single();

  if (!org?.default_payment_method_id) {
    return { ok: true, pm: null };
  }

  try {
    const pm = await stripe().paymentMethods.retrieve(
      org.default_payment_method_id
    );
    if (!pm.card) return { ok: true, pm: null };
    return {
      ok: true,
      pm: {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      },
    };
  } catch {
    // PM was deleted / detached on Stripe's side. Treat as none.
    return { ok: true, pm: null };
  }
}
