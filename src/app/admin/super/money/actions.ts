"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { logSupportAction, requirePlatformAccount } from "@/lib/platform";
import type { Json } from "@/types/database";

// Server actions for the platform-admin money tools at
// /admin/super/money. Each action gates on requirePlatformAccount,
// performs the Stripe mutation with a deterministic idempotency key,
// updates the DB through the service-role admin client (platform
// admins are not org members, so the user's RLS-bound client cannot
// write to org-scoped rows), and emits a best-effort audit row.
//
// Idempotency key formats settled on, per Stripe constraint that the
// same key + different request body returns the original response:
//
//   Refund retry  : refund:<payments.id>:<amountDkk>
//                   (different DKK amount issues a fresh refund;
//                    same DKK amount safely returns the prior one)
//   Transfer retry: transfer-retry:<claims.id>:<gross_dkk>
//                   (mirrors `payment-<payments.id>` from the
//                    automated approve flow but namespaced so the
//                    retry can sit alongside the original record
//                    without colliding)

const REFUND_REASON_MIN = 5;

export async function lookupPayment(formData: FormData): Promise<void> {
  const id = formData.get("payment_id");
  if (typeof id !== "string" || !id.trim()) {
    redirect("/admin/super/money?refund_error=Payment+id+is+required");
  }
  redirect(`/admin/super/money?payment_id=${encodeURIComponent(id.trim())}`);
}

export async function lookupClaim(formData: FormData): Promise<void> {
  const id = formData.get("claim_id");
  if (typeof id !== "string" || !id.trim()) {
    redirect("/admin/super/money?retry_error=Claim+id+is+required");
  }
  redirect(`/admin/super/money?claim_id=${encodeURIComponent(id.trim())}`);
}

type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

interface RefundLookupRow {
  id: string;
  org_id: string;
  claim_id: string;
  creator_id: string;
  total_dkk: number | null;
  amount_dkk: number;
  status: PaymentStatus;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  refunded_amount_dkk: number;
  brief_title_snapshot: string | null;
  creator_name_snapshot: string | null;
}

/**
 * Manual refund. Looks the payments row up by id, refunds against
 * the brief's escrow PaymentIntent (the only PI we hold for a paid
 * claim), updates payments.status -> 'refunded' (or accumulates
 * refunded_amount_dkk for partials), and writes the audit row.
 *
 * Refunds are issued via Stripe `refunds.create({ payment_intent,
 * amount })`. The amount is converted DKK -> ore at the boundary;
 * everything else stays in whole DKK.
 */
export async function refundPayment(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    redirect("/");
  }

  const paymentId = formData.get("payment_id");
  const amountRaw = formData.get("amount_dkk");
  const reasonRaw = formData.get("reason");

  if (typeof paymentId !== "string" || !paymentId) {
    redirect("/admin/super/money?refund_error=Payment+id+is+required");
  }
  if (typeof amountRaw !== "string" || !amountRaw) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=Refund+amount+is+required`
    );
  }
  const amountDkk = parseInt(amountRaw, 10);
  if (!Number.isFinite(amountDkk) || amountDkk <= 0) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=Refund+amount+must+be+a+positive+whole+DKK+number`
    );
  }
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim().length >= REFUND_REASON_MIN
      ? reasonRaw.trim().slice(0, 500)
      : null;
  if (!reason) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=Reason+is+required+(min+5+chars)`
    );
  }

  const admin = createAdminClient();

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .select(
      "id, org_id, claim_id, creator_id, total_dkk, amount_dkk, status, stripe_transfer_id, stripe_refund_id, refunded_amount_dkk, brief_title_snapshot, creator_name_snapshot"
    )
    .eq("id", paymentId)
    .maybeSingle<RefundLookupRow>();

  if (paymentError) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=${encodeURIComponent(paymentError.message)}`
    );
  }
  if (!payment) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=Payment+not+found`
    );
  }

  // We refund against the brief's escrow PaymentIntent rather than
  // the transfer to the creator: the org paid the platform via that
  // PI, so refunding it returns money to the org's saved card. The
  // transfer to the creator stays put unless support reverses it
  // separately in the Stripe dashboard.
  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select("id, brief_id, briefs(id, stripe_payment_intent_id, title, org_id)")
    .eq("id", payment.claim_id)
    .maybeSingle();

  if (claimError) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=${encodeURIComponent(claimError.message)}`
    );
  }
  const briefRel = claim?.briefs as
    | { id: string; stripe_payment_intent_id: string | null; title: string; org_id: string }
    | { id: string; stripe_payment_intent_id: string | null; title: string; org_id: string }[]
    | null;
  const brief = Array.isArray(briefRel) ? briefRel[0] ?? null : briefRel;

  if (!brief?.stripe_payment_intent_id) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=Brief+has+no+PaymentIntent+on+file.+Cannot+refund.`
    );
  }

  const totalAvailableDkk = payment.total_dkk ?? payment.amount_dkk;
  const alreadyRefundedDkk = payment.refunded_amount_dkk ?? 0;
  const remainingDkk = totalAvailableDkk - alreadyRefundedDkk;
  if (amountDkk > remainingDkk) {
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=${encodeURIComponent(
        `Refund of ${amountDkk} DKK exceeds remaining ${remainingDkk} DKK on this payment.`
      )}`
    );
  }

  let refund: Stripe.Refund;
  try {
    refund = await stripe().refunds.create(
      {
        payment_intent: brief.stripe_payment_intent_id,
        amount: amountDkk * 100,
        reason: "requested_by_customer",
        metadata: {
          payment_id: payment.id,
          claim_id: payment.claim_id,
          brief_id: brief.id,
          actor_id: gate.userId,
          refund_kind: "manual_support",
        },
      },
      { idempotencyKey: `refund:${payment.id}:${amountDkk}` }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe refund failed";
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=${encodeURIComponent(message)}`
    );
  }

  const newRefundedTotal = alreadyRefundedDkk + amountDkk;
  const fullyRefunded = newRefundedTotal >= totalAvailableDkk;

  const { error: updateError } = await admin
    .from("payments")
    .update({
      status: fullyRefunded ? "refunded" : payment.status,
      stripe_refund_id: refund.id,
      refunded_amount_dkk: newRefundedTotal,
    })
    .eq("id", payment.id);

  if (updateError) {
    // Stripe already returned the money; log loudly but do not roll
    // back. Surface the drift to the admin so they can reconcile by
    // hand from the Stripe refund id in the URL.
    console.error(
      `[refundPayment] Stripe refund ${refund.id} succeeded but payments row ${payment.id} update failed: ${updateError.message}`
    );
    redirect(
      `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_error=${encodeURIComponent(
        `Refund ${refund.id} succeeded but DB update failed: ${updateError.message}. Manual reconciliation required.`
      )}`
    );
  }

  await logSupportAction(supabase, {
    actorId: gate.userId,
    action: "payment.refund",
    targetOrgId: payment.org_id,
    targetTable: "payments",
    targetRowId: payment.id,
    reason,
    before: {
      status: payment.status,
      refunded_amount_dkk: alreadyRefundedDkk,
      stripe_refund_id: payment.stripe_refund_id,
    } as Json,
    after: {
      status: fullyRefunded ? "refunded" : payment.status,
      refunded_amount_dkk: newRefundedTotal,
      stripe_refund_id: refund.id,
      refund_amount_dkk: amountDkk,
    } as Json,
  });

  revalidatePath("/admin/super/money");
  revalidatePath("/admin/super/audit");
  redirect(
    `/admin/super/money?payment_id=${encodeURIComponent(paymentId)}&refund_ok=${encodeURIComponent(refund.id)}`
  );
}

interface ClaimLookupRow {
  id: string;
  org_id: string;
  user_id: string;
  status: string;
  brief_id: string;
  briefs:
    | {
        id: string;
        title: string;
        price_dkk: number;
        funded_status: string;
        org_id: string;
      }
    | {
        id: string;
        title: string;
        price_dkk: number;
        funded_status: string;
        org_id: string;
      }[]
    | null;
  creator:
    | {
        id: string;
        name: string | null;
        stripe_account_id: string | null;
        stripe_payouts_enabled: boolean;
      }
    | {
        id: string;
        name: string | null;
        stripe_account_id: string | null;
        stripe_payouts_enabled: boolean;
      }[]
    | null;
}

/**
 * Retry the creator transfer for a stuck approved claim. Mirrors the
 * Stripe call shape from src/app/admin/claims/pay-action.ts (keep
 * them in sync if that file changes), but does not run the escrow
 * release_escrow_slot RPC: this path is reached only after the
 * automated approve flow either skipped the transfer entirely or
 * the original transfer failed and left a payments row in `failed`.
 * In both cases the escrow accounting has already run.
 *
 * If a `failed` payments row exists for the claim, we update it to
 * `succeeded` with the new transfer id. If no row exists, we insert
 * a minimal row so reporting shows the payout. Either way we re-emit
 * an audit entry so the trail is complete.
 */
export async function retryTransfer(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    redirect("/");
  }

  const claimId = formData.get("claim_id");
  const reasonRaw = formData.get("reason");
  if (typeof claimId !== "string" || !claimId) {
    redirect("/admin/super/money?retry_error=Claim+id+is+required");
  }
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim().length >= REFUND_REASON_MIN
      ? reasonRaw.trim().slice(0, 500)
      : null;
  if (!reason) {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=Reason+is+required+(min+5+chars)`
    );
  }

  const admin = createAdminClient();

  const { data: claim, error: claimError } = await admin
    .from("claims")
    .select(
      "id, org_id, user_id, status, brief_id, briefs(id, title, price_dkk, funded_status, org_id), creator:profiles!claims_user_id_fkey(id, name, stripe_account_id, stripe_payouts_enabled)"
    )
    .eq("id", claimId)
    .maybeSingle<ClaimLookupRow>();

  if (claimError) {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=${encodeURIComponent(claimError.message)}`
    );
  }
  if (!claim) {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=Claim+not+found`
    );
  }

  const brief = Array.isArray(claim.briefs) ? claim.briefs[0] ?? null : claim.briefs;
  const creator = Array.isArray(claim.creator) ? claim.creator[0] ?? null : claim.creator;

  if (!brief) {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=Claim+has+no+brief+attached`
    );
  }
  if (!creator?.stripe_account_id || !creator.stripe_payouts_enabled) {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=Creator+has+no+payout-ready+Stripe+account`
    );
  }
  if (claim.status !== "approved" && claim.status !== "paid") {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=Claim+must+be+approved+to+retry+the+transfer`
    );
  }

  const { data: existingSucceeded } = await admin
    .from("payments")
    .select("id")
    .eq("claim_id", claim.id)
    .eq("status", "succeeded")
    .maybeSingle();
  if (existingSucceeded) {
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=A+succeeded+payment+already+exists+for+this+claim`
    );
  }

  const grossDkk = brief.price_dkk;

  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe().transfers.create(
      {
        amount: grossDkk * 100, // DKK -> ore
        currency: "dkk",
        destination: creator.stripe_account_id,
        description: `Retry transfer for claim ${claim.id}`,
        metadata: {
          claim_id: claim.id,
          brief_id: brief.id,
          creator_id: creator.id,
          actor_id: gate.userId,
          retry_kind: "manual_support",
        },
      },
      { idempotencyKey: `transfer-retry:${claim.id}:${grossDkk}` }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe transfer failed";
    redirect(
      `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=${encodeURIComponent(message)}`
    );
  }

  // Try to update an existing failed payments row first; only insert
  // a stub if none exists. The stub omits VAT / invoice fields so it
  // is unmistakable in reporting as a hand-recovered row that needs
  // a follow-up invoice issuance pass before being shown to the
  // creator. Support flags this in the audit reason.
  const { data: existingFailed } = await admin
    .from("payments")
    .select("id, status")
    .eq("claim_id", claim.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let paymentId: string;
  let beforeRow: Json;

  if (existingFailed) {
    const { error: updateError } = await admin
      .from("payments")
      .update({
        status: "succeeded",
        stripe_transfer_id: transfer.id,
        error_message: null,
      })
      .eq("id", existingFailed.id);
    if (updateError) {
      console.error(
        `[retryTransfer] Stripe transfer ${transfer.id} succeeded but payments row ${existingFailed.id} update failed: ${updateError.message}`
      );
      redirect(
        `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=${encodeURIComponent(
          `Transfer ${transfer.id} succeeded but DB update failed: ${updateError.message}.`
        )}`
      );
    }
    paymentId = existingFailed.id;
    beforeRow = { status: existingFailed.status, stripe_transfer_id: null };
  } else {
    const { data: inserted, error: insertError } = await admin
      .from("payments")
      .insert({
        claim_id: claim.id,
        creator_id: creator.id,
        org_id: claim.org_id,
        amount_dkk: grossDkk,
        gross_dkk: grossDkk,
        stripe_account_id: creator.stripe_account_id,
        stripe_transfer_id: transfer.id,
        status: "succeeded",
        paid_by: gate.userId,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      console.error(
        `[retryTransfer] Stripe transfer ${transfer.id} succeeded but payments insert failed: ${insertError?.message}`
      );
      redirect(
        `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_error=${encodeURIComponent(
          `Transfer ${transfer.id} succeeded but payments insert failed: ${insertError?.message ?? "unknown error"}.`
        )}`
      );
    }
    paymentId = inserted.id;
    beforeRow = { status: null, stripe_transfer_id: null };
  }

  const { error: claimUpdateError } = await admin
    .from("claims")
    .update({ status: "paid" })
    .eq("id", claim.id);
  if (claimUpdateError) {
    console.error(
      `[retryTransfer] Stripe transfer ${transfer.id} succeeded and payment recorded but claim ${claim.id} did not flip to paid: ${claimUpdateError.message}`
    );
  }

  await logSupportAction(supabase, {
    actorId: gate.userId,
    action: "transfer.retry",
    targetOrgId: claim.org_id,
    targetTable: "claims",
    targetRowId: claim.id,
    reason,
    before: beforeRow,
    after: {
      status: "succeeded",
      stripe_transfer_id: transfer.id,
      payment_id: paymentId,
      gross_dkk: grossDkk,
    } as Json,
  });

  revalidatePath("/admin/super/money");
  revalidatePath("/admin/super/audit");
  redirect(
    `/admin/super/money?claim_id=${encodeURIComponent(claimId)}&retry_ok=${encodeURIComponent(transfer.id)}`
  );
}
