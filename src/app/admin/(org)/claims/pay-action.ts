"use server";

import type Stripe from "stripe";
import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe/server";
import { calculateVat, formatInvoiceNumber } from "@/lib/invoicing/vat";
import {
  SELF_BILLING_AGREEMENT_VERSION,
  platformDetails,
} from "@/lib/invoicing/platform";
import { requireOrgAdmin } from "@/lib/org";
import { computeFee, resolveUserPricing } from "@/lib/pricing";

type PayResult = { ok: true } | { ok: false; error: string };

interface ClaimRow {
  id: string;
  status: string;
  user_id: string;
  brief: {
    id: string;
    title: string;
    price_dkk: number;
    funded_status: string;
    escrow_amount_dkk: number | null;
    escrow_held_dkk: number | null;
  } | null;
  creator: {
    name: string | null;
    country: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_postal_code: string | null;
    billing_city: string | null;
    vat_registered: boolean;
    vat_number: string | null;
    cvr_number: string | null;
    stripe_account_id: string | null;
    stripe_payouts_enabled: boolean;
    self_billing_agreement_version: string | null;
    self_billing_agreement_accepted_at: string | null;
  } | null;
}

export async function payClaim(claimId: string): Promise<PayResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId: adminUserId, orgId } = gate;

  const { data: claim, error: claimError } = await supabase
    .from("claims")
    .select(
      "id, status, user_id, brief:briefs(id, title, price_dkk, funded_status, escrow_amount_dkk, escrow_held_dkk), creator:profiles!claims_user_id_fkey(name, country, billing_address_line1, billing_address_line2, billing_postal_code, billing_city, vat_registered, vat_number, cvr_number, stripe_account_id, stripe_payouts_enabled, self_billing_agreement_version, self_billing_agreement_accepted_at)"
    )
    .eq("id", claimId)
    .single<ClaimRow>();

  if (claimError || !claim) {
    return { ok: false, error: "Claim not found" };
  }

  if (claim.status !== "submitted" && claim.status !== "approved") {
    return {
      ok: false,
      error: "Only submitted or approved claims can be paid",
    };
  }

  const creator = claim.creator;
  if (!creator?.stripe_account_id || !creator.stripe_payouts_enabled) {
    return { ok: false, error: "Creator has not completed payout onboarding" };
  }

  if (
    !creator.country ||
    !creator.billing_address_line1 ||
    !creator.billing_postal_code ||
    !creator.billing_city
  ) {
    return { ok: false, error: "Creator has not filled in billing details" };
  }

  if (
    creator.self_billing_agreement_version !== SELF_BILLING_AGREEMENT_VERSION ||
    !creator.self_billing_agreement_accepted_at
  ) {
    return {
      ok: false,
      error: "Creator has not accepted the current self-billing agreement",
    };
  }

  if (creator.vat_registered && !creator.vat_number) {
    return { ok: false, error: "Creator is VAT-registered but has no VAT number on file" };
  }

  if (!claim.brief?.price_dkk) {
    return { ok: false, error: "Brief price missing" };
  }

  // Escrow gating (Phase 1.1d). Briefs published from 1.1c onwards
  // pre-fund the platform balance for `price_dkk x claim_limit` and
  // land with funded_status in (funded, partially_released). Each
  // payClaim call decrements escrow_held_dkk by the slot's gross
  // amount; the brief moves to `released` when held hits zero.
  //
  // Legacy briefs (created before 1.1c) land as `unfunded` because no
  // escrow PaymentIntent ran. We let those through unchanged so the
  // existing transfer-from-platform-balance flow keeps working, but
  // skip the escrow accounting since there is nothing to decrement.
  //
  // The actual `held >= slot` and `funded_status` checks now run as
  // an atomic UPDATE inside release_escrow_slot (migration 0039) so
  // two concurrent payClaim calls cannot both pass a stale read-time
  // guard and double-pay the same slot. See 0039 header for details.
  const briefRecord = claim.brief;
  const slotGrossDkk = briefRecord.price_dkk;
  const briefIsEscrowed = briefRecord.funded_status !== "unfunded";

  const { data: existing } = await supabase
    .from("payments")
    .select("id, status")
    .eq("claim_id", claimId)
    .eq("status", "succeeded")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Claim has already been paid" };
  }

  // Resolve the platform fee at time-of-payout. The values are
  // frozen onto the payments row below so future rate changes
  // never retroactively rewrite historical invoices.
  // resolveUserPricing layers any per-creator override on top of the
  // org's resolved pricing — handles "comp this specific creator at
  // 0%" without affecting anyone else in the same org.
  const grossDkk = claim.brief.price_dkk;
  const pricing = await resolveUserPricing(supabase, claim.user_id, orgId);
  const { feeDkk, netDkk } = computeFee(grossDkk, pricing.fee_bp);

  // VAT is calculated on the creator's actual receipts (post-fee),
  // since the self-billed invoice represents the creator's net sale
  // to the platform — the fee is the platform's share, not part of
  // the creator's taxable supply.
  const subtotalDkk = netDkk;
  const vat = calculateVat(subtotalDkk, {
    country: creator.country,
    vatRegistered: creator.vat_registered,
  });

  const year = new Date().getUTCFullYear();

  const { data: seqResult, error: seqError } = await supabase.rpc(
    "allocate_invoice_number",
    { p_org_id: orgId, p_year: year }
  );

  if (seqError || seqResult == null) {
    return {
      ok: false,
      error: `Failed to allocate invoice number: ${seqError?.message ?? "unknown error"}`,
    };
  }

  const invoiceSeq = seqResult;
  const invoiceNumber = formatInvoiceNumber(year, invoiceSeq);
  const platform = platformDetails();

  const creatorAddress = [
    creator.billing_address_line1,
    creator.billing_address_line2,
    `${creator.billing_postal_code ?? ""} ${creator.billing_city ?? ""}`.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      claim_id: claim.id,
      creator_id: claim.user_id,
      amount_dkk: vat.totalDkk,
      subtotal_dkk: vat.subtotalDkk,
      vat_rate_bp: vat.rateBp,
      vat_amount_dkk: vat.vatAmountDkk,
      total_dkk: vat.totalDkk,
      vat_scheme: vat.scheme,
      gross_dkk: grossDkk,
      platform_fee_bp: pricing.fee_bp,
      platform_fee_dkk: feeDkk,
      stripe_account_id: creator.stripe_account_id,
      status: "pending",
      paid_by: adminUserId,
      org_id: orgId,
      invoice_year: year,
      invoice_seq: invoiceSeq,
      invoice_number: invoiceNumber,
      invoice_issued_at: new Date().toISOString(),
      creator_name_snapshot: creator.name,
      creator_address_snapshot: creatorAddress,
      creator_country_snapshot: creator.country,
      creator_vat_number_snapshot: creator.vat_number,
      creator_cvr_snapshot: creator.cvr_number,
      platform_name_snapshot: platform.name,
      platform_address_snapshot: platform.address,
      platform_cvr_snapshot: platform.cvr,
      platform_vat_snapshot: platform.vatNumber,
      brief_title_snapshot: claim.brief.title,
      self_billing_agreement_version_snapshot: creator.self_billing_agreement_version,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return { ok: false, error: `Failed to create payment record: ${insertError?.message}` };
  }

  // Atomic escrow decrement (Phase 1.1d security fix). We move
  // escrow_held_dkk + funded_status in a single UPDATE before the
  // Stripe transfer fires, so concurrent payClaim calls on the same
  // brief cannot both see the same starting balance and double-pay.
  // If the RPC raises escrow_release_failed, the brief is already
  // drained / refunded / never escrowed properly; mark the payment
  // failed and bail out before touching Stripe.
  if (briefIsEscrowed) {
    const { error: releaseError } = await supabase.rpc("release_escrow_slot", {
      p_brief_id: briefRecord.id,
      p_slot_dkk: slotGrossDkk,
    });
    if (releaseError) {
      const friendly =
        "Brief escrow does not have enough held to release this slot. Likely already paid out or partially refunded.";
      const { error: markFailedError } = await supabase
        .from("payments")
        .update({ status: "failed", error_message: friendly })
        .eq("id", payment.id);
      if (markFailedError) {
        // Log loudly so support can manually mark the payment row.
        // The original release failure still surfaces to the caller.
        console.error(
          `[payClaim] Failed to mark payment ${payment.id} as failed after release_escrow_slot error: ${markFailedError.message}`
        );
      }
      return { ok: false, error: friendly };
    }
  }

  // The try/catch wraps ONLY the Stripe call. Once the transfer
  // returns, the money is out of the platform; any failure on the
  // post-transfer DB writes is silent corruption (drift between
  // Stripe and our state), not something to "roll back" by restoring
  // escrow. Surface those errors loudly via throw, with the Stripe
  // transfer id in the message so ops can reconcile by hand.
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe().transfers.create(
      {
        amount: vat.totalDkk * 100, // DKK -> øre
        currency: "dkk",
        destination: creator.stripe_account_id,
        description: `Invoice ${invoiceNumber}`,
        metadata: {
          claim_id: claim.id,
          brief_id: claim.brief.id,
          creator_id: claim.user_id,
          payment_id: payment.id,
          invoice_number: invoiceNumber,
        },
      },
      { idempotencyKey: `payment-${payment.id}` }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe transfer failed";
    let errorMessage = message;

    // Credit the held amount back since the transfer never landed.
    // If restore itself fails we still surface the original Stripe
    // error to the admin, but we append the restore failure to
    // error_message so support can manually reconcile the brief.
    if (briefIsEscrowed) {
      const { error: restoreError } = await supabase.rpc("restore_escrow_slot", {
        p_brief_id: briefRecord.id,
        p_slot_dkk: slotGrossDkk,
      });
      if (restoreError) {
        errorMessage = `${message} | escrow restore failed: ${restoreError.message}`;
      }
    }

    const { error: markFailedError } = await supabase
      .from("payments")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", payment.id);
    if (markFailedError) {
      // Log loudly so support can manually mark the payment row.
      // Don't shadow the original Stripe error in the user-facing
      // message; that's what the admin needs to act on first.
      console.error(
        `[payClaim] Failed to mark payment ${payment.id} as failed after Stripe transfer error: ${markFailedError.message}`
      );
    }
    return { ok: false, error: message };
  }

  // Stripe transfer landed. The post-transfer DB writes below MUST
  // surface their errors. If we silently swallow a trigger / RLS
  // denial here we end up with money out of the platform but the
  // payment row stuck in `pending` and the claim stuck in `approved`,
  // exactly the silent-corruption shape that the escrow trigger in
  // 0038 was added to surface. Throw so the admin sees the drift
  // immediately and ops can reconcile from the Stripe transfer id.
  // No rollback path here on purpose; the money is already out.
  const { error: payUpdateError } = await supabase
    .from("payments")
    .update({ status: "succeeded", stripe_transfer_id: transfer.id })
    .eq("id", payment.id);
  if (payUpdateError) {
    throw new Error(
      `Stripe transfer ${transfer.id} succeeded but payments row ${payment.id} did not update: ${payUpdateError.message}. Manual reconciliation required.`
    );
  }

  const { error: claimUpdateError } = await supabase
    .from("claims")
    .update({ status: "paid" })
    .eq("id", claim.id);
  if (claimUpdateError) {
    throw new Error(
      `Stripe transfer ${transfer.id} succeeded and payment marked succeeded, but claim ${claim.id} did not flip to paid: ${claimUpdateError.message}. Manual reconciliation required.`
    );
  }

  revalidatePath("/admin/claims");
  return { ok: true };
}
