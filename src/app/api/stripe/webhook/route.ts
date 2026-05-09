import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncSubscriptionFromStripe } from "@/app/admin/(org)/billing/actions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;

      const { error } = await supabase
        .from("profiles")
        .update({
          stripe_payouts_enabled: account.payouts_enabled ?? false,
          stripe_details_submitted: account.details_submitted ?? false,
        })
        .eq("stripe_account_id", account.id);

      if (error) {
        console.error("Failed to update profile from account.updated:", error);
        return NextResponse.json({ error: "db error" }, { status: 500 });
      }
      break;
    }

    case "transfer.reversed": {
      const transfer = event.data.object as Stripe.Transfer;
      const paymentId = transfer.metadata?.payment_id;

      if (!paymentId) {
        console.error("transfer.reversed missing payment_id metadata:", transfer.id);
        break;
      }

      const { error } = await supabase
        .from("payments")
        .update({
          status: "failed" as const,
          error_message: `Transfer ${transfer.id} reversed`,
        })
        .eq("id", paymentId);

      if (error) {
        console.error("Failed to mark payment as reversed:", error);
        return NextResponse.json({ error: "db error" }, { status: 500 });
      }

      // Revert claim back to approved so admin can retry payment
      const { data: payment } = await supabase
        .from("payments")
        .select("claim_id")
        .eq("id", paymentId)
        .single();

      if (payment?.claim_id) {
        const { error: claimRevertError } = await supabase
          .from("claims")
          .update({ status: "approved" })
          .eq("id", payment.claim_id)
          .eq("status", "paid");
        if (claimRevertError) {
          console.error(
            "Failed to revert claim to approved after transfer.reversed:",
            claimRevertError
          );
          return NextResponse.json({ error: "db error" }, { status: 500 });
        }
      }
      break;
    }

    // Subscription lifecycle. The same handler covers create, update,
    // and delete — Stripe sends the full subscription object on each
    // and syncSubscriptionFromStripe is idempotent.
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.trial_will_end":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const subscription = event.data.object as Stripe.Subscription;
      try {
        await syncSubscriptionFromStripe(subscription);
      } catch (err) {
        console.error("Failed to sync subscription:", err);
        return NextResponse.json({ error: "sync error" }, { status: 500 });
      }
      break;
    }

    // Re-confirm the subscription's plan/period after a renewal pays.
    // Stripe sends the renewal invoice as `invoice.paid`; pulling the
    // subscription via the API gets us the latest period dates.
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      if (!subId) break;
      try {
        const subscription = await stripe().subscriptions.retrieve(subId);
        await syncSubscriptionFromStripe(subscription);

        // Pricing v2: a successful renewal invoice resets the org's
        // brief-publish counter for the new period and bumps the
        // anchor. Skip on payment_failed: we don't want to gift a
        // fresh quota when the card declined.
        if (event.type === "invoice.paid") {
          const orgId = subscription.metadata?.org_id;
          if (orgId) {
            // Use Stripe's period_start when available; fall back to
            // now() so the anchor never drifts behind reality.
            type SubAny = Stripe.Subscription & {
              current_period_start?: number | null;
            };
            const periodStartTs = (subscription as SubAny).current_period_start;
            const anchor = periodStartTs
              ? new Date(periodStartTs * 1000).toISOString()
              : new Date().toISOString();
            const { error } = await supabase.rpc("reset_brief_publish_period", {
              p_org_id: orgId,
              p_anchor: anchor,
            });
            if (error) {
              console.error(
                "Failed to reset brief publish period:",
                error.message
              );
              return NextResponse.json({ error: "rpc error" }, { status: 500 });
            }
          }
        }
      } catch (err) {
        console.error("Failed to sync subscription from invoice:", err);
        return NextResponse.json({ error: "sync error" }, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
