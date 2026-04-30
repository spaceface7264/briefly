import { stripe } from "@/lib/stripe/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type AdminDb = SupabaseClient<Database>;

interface CreateContext {
  /** Org name — used as the Stripe Customer's `name`. */
  name: string;
  /** Optional admin email to associate with the new customer. */
  email?: string | null;
}

/**
 * Resolve the Stripe Customer ID for an org, creating one if needed.
 *
 * Source-of-truth migration: `organizations.stripe_customer_id` is the
 * canonical column going forward. The legacy
 * `org_subscriptions.stripe_customer_id` (set by the original
 * subscription Checkout flow in 0028) is read as a fallback so orgs
 * that already have a Customer don't get a duplicate one. On read of
 * the legacy column, the value is backfilled to `organizations` so
 * subsequent reads short-circuit there.
 *
 * Caller passes in the service-role client because writes happen
 * across two tables and the read path may need to bypass RLS.
 *
 * Returns the Stripe Customer ID (`cus_…`).
 */
export async function getOrCreateOrgStripeCustomer(
  adminDb: AdminDb,
  orgId: string,
  context: CreateContext
): Promise<string> {
  const { data: org } = await adminDb
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", orgId)
    .maybeSingle();

  if (org?.stripe_customer_id) {
    return org.stripe_customer_id;
  }

  const { data: legacy } = await adminDb
    .from("org_subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", orgId)
    .maybeSingle();

  if (legacy?.stripe_customer_id) {
    // Backfill the canonical column so future reads skip the legacy
    // lookup. Best-effort; if the write fails we still return a usable
    // customer id.
    await adminDb
      .from("organizations")
      .update({ stripe_customer_id: legacy.stripe_customer_id })
      .eq("id", orgId);
    return legacy.stripe_customer_id;
  }

  const customer = await stripe().customers.create({
    name: context.name,
    email: context.email ?? undefined,
    metadata: { org_id: orgId },
  });

  // Write to both columns during the transition. createCheckoutSession
  // reads from org_subscriptions today; once it migrates to this
  // helper (in the same PR as the escrow payment-method work), the
  // org_subscriptions write can drop.
  await Promise.all([
    adminDb
      .from("organizations")
      .update({ stripe_customer_id: customer.id })
      .eq("id", orgId),
    adminDb
      .from("org_subscriptions")
      .update({ stripe_customer_id: customer.id })
      .eq("org_id", orgId),
  ]);

  return customer.id;
}
