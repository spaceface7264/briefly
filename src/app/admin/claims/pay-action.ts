"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";

type PayResult = { ok: true } | { ok: false; error: string };

export async function payClaim(claimId: string): Promise<PayResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return { ok: false, error: "Admin access required" };
  }

  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select(
      "id, status, user_id, brief:briefs(id, price_dkk), creator:profiles!claims_user_id_fkey(stripe_account_id, stripe_payouts_enabled)"
    )
    .eq("id", claimId)
    .single<{
      id: string;
      status: string;
      user_id: string;
      brief: { id: string; price_dkk: number } | null;
      creator: {
        stripe_account_id: string | null;
        stripe_payouts_enabled: boolean;
      } | null;
    }>();

  if (claimError || !claim) {
    return { ok: false, error: "Claim not found" };
  }

  if (claim.status !== "approved") {
    return { ok: false, error: "Claim must be approved before paying" };
  }

  if (!claim.creator?.stripe_account_id || !claim.creator.stripe_payouts_enabled) {
    return { ok: false, error: "Creator has not completed payout onboarding" };
  }

  if (!claim.brief?.price_dkk) {
    return { ok: false, error: "Brief price missing" };
  }

  const { data: existing } = await supabase
    .from("payments")
    .select("id, status")
    .eq("claim_id", claimId)
    .eq("status", "succeeded")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Claim has already been paid" };
  }

  const amountDkk = claim.brief.price_dkk;
  const amountMinor = amountDkk * 100; // DKK -> øre

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      claim_id: claim.id,
      creator_id: claim.user_id,
      amount_dkk: amountDkk,
      stripe_account_id: claim.creator.stripe_account_id,
      status: "pending",
      paid_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return { ok: false, error: `Failed to create payment record: ${insertError?.message}` };
  }

  try {
    const transfer = await stripe().transfers.create(
      {
        amount: amountMinor,
        currency: "dkk",
        destination: claim.creator.stripe_account_id,
        description: `Payout for claim ${claim.id}`,
        metadata: {
          claim_id: claim.id,
          brief_id: claim.brief.id,
          creator_id: claim.user_id,
          payment_id: payment.id,
        },
      },
      { idempotencyKey: `claim-${claim.id}` }
    );

    await supabase
      .from("payments")
      .update({ status: "succeeded", stripe_transfer_id: transfer.id })
      .eq("id", payment.id);

    await supabase
      .from("claims")
      .update({ status: "paid" })
      .eq("id", claim.id);

    revalidatePath("/admin/claims");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe transfer failed";
    await supabase
      .from("payments")
      .update({ status: "failed", error_message: message })
      .eq("id", payment.id);
    return { ok: false, error: message };
  }
}
