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

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const supabase = createAdminClient();

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
  }

  return NextResponse.json({ received: true });
}
