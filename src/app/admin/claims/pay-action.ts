"use server";

import { revalidatePath } from "next/cache";
import { stripe } from "@/lib/stripe/server";
import { calculateVat, formatInvoiceNumber } from "@/lib/invoicing/vat";
import {
  SELF_BILLING_AGREEMENT_VERSION,
  platformDetails,
} from "@/lib/invoicing/platform";
import { requireOrgAdmin } from "@/lib/org";

type PayResult = { ok: true } | { ok: false; error: string };

interface ClaimRow {
  id: string;
  status: string;
  user_id: string;
  brief: { id: string; title: string; price_dkk: number } | null;
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
      "id, status, user_id, brief:briefs(id, title, price_dkk), creator:profiles!claims_user_id_fkey(name, country, billing_address_line1, billing_address_line2, billing_postal_code, billing_city, vat_registered, vat_number, cvr_number, stripe_account_id, stripe_payouts_enabled, self_billing_agreement_version, self_billing_agreement_accepted_at)"
    )
    .eq("id", claimId)
    .single<ClaimRow>();

  if (claimError || !claim) {
    return { ok: false, error: "Claim not found" };
  }

  if (claim.status !== "approved") {
    return { ok: false, error: "Claim must be approved before paying" };
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

  const { data: existing } = await supabase
    .from("payments")
    .select("id, status")
    .eq("claim_id", claimId)
    .eq("status", "succeeded")
    .maybeSingle();

  if (existing) {
    return { ok: false, error: "Claim has already been paid" };
  }

  const subtotalDkk = claim.brief.price_dkk;
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

  try {
    const transfer = await stripe().transfers.create(
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
