import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
        await supabase
          .from("claims")
          .update({ status: "approved" })
          .eq("id", payment.claim_id)
          .eq("status", "paid");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
