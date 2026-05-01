"use server";

import type Stripe from "stripe";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe/server";
import { getOrCreateOrgStripeCustomer } from "@/lib/stripe/customer";
import { requireActiveOrg, requireOrgAdmin } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BriefCategory,
  BriefDurationClass,
} from "@/types/database";
import type { Json } from "@/types/database";

type SimpleResult = { ok: true } | { ok: false; error: string };

// For actions that redirect on success — the only value the client
// ever observes is the failure case, so the return type narrows to
// the error variant. Same shape as createBriefWithEscrow's return.
type RedirectingResult = { ok: false; error: string };

interface NewBriefInput {
  title: string;
  description: string;
  category: BriefCategory;
  duration_class: BriefDurationClass;
  price_dkk: number;
  deadline: string | null;
  location: string | null;
  claim_limit: number;
  reference_urls: string[];
  usage_rights: string | null;
  deliverable_specs: Json;
  is_ad_intended: boolean;
  /**
   * Client-generated UUID minted when the form mounts. Used to derive
   * the Stripe idempotency key for the escrow PaymentIntent so a
   * resubmit of the same form instance (e.g. retry after a network
   * blip) deduplicates against the original charge. A fresh form
   * mount mints a new UUID, so a deliberate republish of the same
   * brief still goes through. Transport-only; never persisted.
   */
  client_attempt_id: string;
}

// Failure-only return shape. On success the action calls
// `redirect("/admin/briefs")` which throws and never returns —
// callers should treat any returned value as an error. Lets Next
// hand the browser a 303 response that navigates immediately,
// avoiding the stuck "Charging…" state we'd see if the client tried
// to `router.push` after the action resolved.
type CreateResult = { ok: false; error: string; needsPaymentMethod?: boolean };

/**
 * Create a brief and (if it has a positive price) charge the org's
 * default payment method up front for the full escrow:
 *   amount = price_dkk × claim_limit (DKK).
 *
 * On success the brief lands with funded_status = `funded` and
 * escrow_amount_dkk + escrow_held_dkk both set to the gross amount.
 * The payment intent id is recorded for refund tracking in 1.1e.
 *
 * Charge-then-insert ordering: if the Stripe charge fails for any
 * reason (no payment method, declined, insufficient funds, SCA
 * required), the brief is never created — no orphan rows. The error
 * surfaces to the form with mapped, human-readable copy.
 *
 * Free briefs (price_dkk === 0) skip the charge entirely and land as
 * `unfunded` (current default). Useful for community / non-monetary
 * briefs an org might still want to publish through the platform.
 */
export async function createBriefWithEscrow(
  input: NewBriefInput
): Promise<CreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in" };

  const orgId = await requireActiveOrg(supabase);

  if (input.price_dkk < 0 || input.claim_limit < 1) {
    return { ok: false, error: "Invalid price or slot count" };
  }

  // Minimal shape check on the client-supplied attempt id. We don't
  // need a strict UUID validator here: the value is only used as
  // entropy in the Stripe idempotency key, which Stripe accepts as
  // any string up to 255 chars. We just want to reject empty / wildly
  // long values that would either weaken dedup or blow past the cap.
  if (
    typeof input.client_attempt_id !== "string" ||
    input.client_attempt_id.length === 0 ||
    input.client_attempt_id.length >= 80
  ) {
    return {
      ok: false,
      error: "Invalid form state. Reload the page and try again.",
    };
  }

  const isPaid = input.price_dkk > 0;
  const escrowDkk = input.price_dkk * input.claim_limit;

  let stripePaymentIntentId: string | null = null;
  let fundedStatus: "unfunded" | "funded" = "unfunded";
  let escrowAmountDkk: number | null = null;
  let escrowHeldDkk: number | null = null;

  if (isPaid) {
    const adminDb = createAdminClient();

    const { data: org } = await adminDb
      .from("organizations")
      .select("name, stripe_customer_id, default_payment_method_id")
      .eq("id", orgId)
      .single();

    if (!org) {
      return { ok: false, error: "Org not found" };
    }
    if (!org.default_payment_method_id) {
      return {
        ok: false,
        error:
          "Add a payment method on /admin/billing before publishing a paid brief.",
        needsPaymentMethod: true,
      };
    }

    // Defensive: ensure customer exists. Helper short-circuits if
    // stripe_customer_id is already populated, which it should be
    // since 1.1b can't save a payment method without first creating
    // a Customer.
    const customerId = await getOrCreateOrgStripeCustomer(adminDb, orgId, {
      name: org.name,
      email: null,
    });

    try {
      const paymentIntent = await stripe().paymentIntents.create(
        {
          amount: escrowDkk * 100, // DKK → øre
          currency: "dkk",
          customer: customerId,
          payment_method: org.default_payment_method_id,
          confirm: true,
          off_session: true,
          description: `Escrow for brief: ${input.title.slice(0, 80)}`,
          metadata: {
            org_id: orgId,
            escrow_dkk: String(escrowDkk),
            claim_limit: String(input.claim_limit),
            price_dkk: String(input.price_dkk),
            client_attempt_id: input.client_attempt_id,
          },
          // Don't redirect for next-action handling: surface the error
          // and let the user retry from the org-side.
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
        },
        {
          // Scope the key to org + the form-mount attempt id. A retry
          // of the same submit (network blip, Workers timeout) reuses
          // the key and Stripe returns the original PaymentIntent
          // instead of charging again. A deliberate republish gets a
          // fresh attempt id at form mount and so a fresh key.
          idempotencyKey: `brief-publish-${orgId}-${input.client_attempt_id}`,
        }
      );

      if (paymentIntent.status !== "succeeded") {
        return {
          ok: false,
          error: friendlyStripeStatus(paymentIntent.status),
        };
      }

      stripePaymentIntentId = paymentIntent.id;
      fundedStatus = "funded";
      escrowAmountDkk = escrowDkk;
      escrowHeldDkk = escrowDkk;
    } catch (err) {
      return { ok: false, error: friendlyStripeError(err) };
    }
  }

  // Insert via the standard (RLS-bound) client so members + admins
  // both retain the existing permission to create briefs in their
  // org. If the insert fails after a successful charge, refund
  // immediately to avoid an orphan PaymentIntent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brief, error: insertErr } = await (supabase
    .from("briefs") as any)
    .insert({
      title: input.title,
      description: input.description,
      category: input.category,
      duration_class: input.duration_class,
      price_dkk: input.price_dkk,
      deadline: input.deadline,
      location: input.location,
      claim_limit: input.claim_limit,
      reference_urls: input.reference_urls,
      usage_rights: input.usage_rights,
      deliverable_specs: input.deliverable_specs,
      is_ad_intended: input.is_ad_intended,
      created_by: user.id,
      org_id: orgId,
      funded_status: fundedStatus,
      escrow_amount_dkk: escrowAmountDkk,
      escrow_held_dkk: escrowHeldDkk,
      stripe_payment_intent_id: stripePaymentIntentId,
    })
    .select("id")
    .single();

  if (insertErr || !brief) {
    if (stripePaymentIntentId) {
      // Await the rollback refund. On Cloudflare Workers the runtime
      // tears down the request as soon as the response returns, so a
      // fire-and-forget Promise from a server action gets cancelled
      // mid-flight and the org keeps the charge with no brief to back
      // it. The idempotency key keeps a (very unlikely) double action
      // execution from issuing two refunds against the same PI.
      try {
        await stripe().refunds.create(
          {
            payment_intent: stripePaymentIntentId,
            reason: "requested_by_customer",
            metadata: {
              reason: "brief_insert_failed",
              org_id: orgId,
            },
          },
          {
            idempotencyKey: `brief-publish-rollback-${stripePaymentIntentId}`,
          }
        );
      } catch (refundErr) {
        // Both the insert and the refund failed. Surface the
        // PaymentIntent id explicitly so support can reconcile the
        // charge by hand. Include the original insert error since
        // that's the bug worth investigating.
        const insertMsg = insertErr?.message ?? "unknown";
        const refundMsg =
          refundErr instanceof Error ? refundErr.message : "unknown";
        return {
          ok: false,
          error: `Brief save failed AND escrow refund failed. Contact support. Original error: ${insertMsg}. Refund error: ${refundMsg}. PaymentIntent: ${stripePaymentIntentId}.`,
        };
      }
    }
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to save brief",
    };
  }

  // Success: redirect at the action layer. Throws NEXT_REDIRECT which
  // Next translates into a 303 response; the browser navigates before
  // the client ever sees a "result." The destination's loading.tsx
  // shows immediately, so the form doesn't sit there with stale
  // "Charging…" while /admin/briefs server-renders.
  redirect("/admin/briefs");
}

function friendlyStripeStatus(status: Stripe.PaymentIntent.Status): string {
  switch (status) {
    case "requires_action":
      return "Your card requires extra authentication. Update your payment method on /admin/billing and try again.";
    case "requires_payment_method":
      return "The saved card was declined. Update your payment method on /admin/billing and try again.";
    case "processing":
      return "Stripe is still processing the charge. Try again in a minute.";
    case "canceled":
      return "The charge was cancelled before it could complete.";
    default:
      return `Stripe returned an unexpected payment status: ${status}.`;
  }
}

function friendlyStripeError(err: unknown): string {
  // Stripe SDK errors carry a `code` and `message` we can map to
  // human copy. Fall through to the raw message for anything we
  // don't recognise.
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: string }).code;
    const decline = (err as { decline_code?: string }).decline_code;
    if (decline === "insufficient_funds") {
      return "Card declined: insufficient funds.";
    }
    if (decline === "lost_card" || decline === "stolen_card") {
      return "Card declined. Try a different card on /admin/billing.";
    }
    if (code === "card_declined") {
      return "Card declined. Try a different card on /admin/billing.";
    }
    if (code === "authentication_required") {
      return "Your card needs SCA authentication. Re-add the card on /admin/billing to authenticate it.";
    }
    if (code === "expired_card") {
      return "Card has expired. Update your payment method on /admin/billing.";
    }
  }
  return err instanceof Error ? err.message : "Charge failed";
}

/**
 * Archive a brief and refund any unreleased escrow back to the org's
 * payment method. Phase 1.1e of the post-genericization roadmap.
 *
 * Refund logic per `funded_status` at archive time:
 *   - `funded`             → refund full escrow_held_dkk (no slots
 *                            were paid out)
 *   - `partially_released` → refund the remaining escrow_held_dkk
 *                            (released amounts stay with creators)
 *   - `released`           → nothing to refund (held = 0)
 *   - `refunded`           → nothing to refund (already done)
 *   - `unfunded`           → nothing to refund (legacy / free brief)
 *
 * After a successful refund, funded_status flips to `refunded` and
 * escrow_held_dkk is zeroed.
 *
 * Stripe `refunds.create({ payment_intent, amount })` issues a
 * partial refund against the original PaymentIntent, going back to
 * the original payment method.
 *
 * Admin-only — refunds move real money. Members can publish briefs
 * (which pulls from the org's saved card) but only admins can move
 * money back out.
 *
 * Redirects to /admin/briefs on success so the browser navigates
 * immediately without the form / detail page rendering stale state.
 */
export async function archiveBriefWithRefund(
  briefId: string
): Promise<RedirectingResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const adminDb = createAdminClient();

  const { data: brief, error: briefErr } = await adminDb
    .from("briefs")
    .select(
      "id, org_id, status, funded_status, escrow_held_dkk, stripe_payment_intent_id"
    )
    .eq("id", briefId)
    .single();
  if (briefErr || !brief) {
    return { ok: false, error: "Brief not found" };
  }
  if (brief.org_id !== gate.orgId) {
    return { ok: false, error: "Brief does not belong to your org" };
  }
  if (brief.status === "archived") {
    return { ok: false, error: "Brief is already archived" };
  }

  const heldDkk = brief.escrow_held_dkk ?? 0;
  const needsRefund =
    (brief.funded_status === "funded" ||
      brief.funded_status === "partially_released") &&
    heldDkk > 0;

  if (needsRefund) {
    if (!brief.stripe_payment_intent_id) {
      return {
        ok: false,
        error:
          "Brief has held escrow but no PaymentIntent on file — cannot refund. Contact platform support.",
      };
    }
    try {
      await stripe().refunds.create(
        {
          payment_intent: brief.stripe_payment_intent_id,
          amount: heldDkk * 100, // DKK → øre
          reason: "requested_by_customer",
          metadata: {
            org_id: gate.orgId,
            brief_id: brief.id,
            refund_kind: "escrow_archive",
          },
        },
        { idempotencyKey: `archive-refund-${brief.id}` }
      );
    } catch (err) {
      return {
        ok: false,
        error: `Refund failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      };
    }
  }

  const updatePayload: Record<string, unknown> = { status: "archived" };
  if (needsRefund) {
    updatePayload.funded_status = "refunded";
    updatePayload.escrow_held_dkk = 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (adminDb.from("briefs") as any)
    .update(updatePayload)
    .eq("id", brief.id);
  if (updErr) {
    return {
      ok: false,
      error: `Refund succeeded but archive failed: ${updErr.message}. Contact support.`,
    };
  }

  redirect("/admin/briefs");
}

/**
 * Reopen an archived brief.
 *
 * Refunded briefs are blocked here — the escrow is gone, so there's
 * nothing to back creator payouts. The admin must publish a new
 * brief (which charges the org's card) instead. Unfunded / free
 * briefs reopen freely. Briefs that were archived without ever being
 * funded (legacy data) also pass through.
 */
export async function reopenBrief(briefId: string): Promise<SimpleResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const adminDb = createAdminClient();

  const { data: brief, error: briefErr } = await adminDb
    .from("briefs")
    .select("id, org_id, status, funded_status")
    .eq("id", briefId)
    .single();
  if (briefErr || !brief) {
    return { ok: false, error: "Brief not found" };
  }
  if (brief.org_id !== gate.orgId) {
    return { ok: false, error: "Brief does not belong to your org" };
  }
  if (brief.status !== "archived") {
    return { ok: false, error: "Brief is not archived" };
  }
  if (brief.funded_status === "refunded") {
    return {
      ok: false,
      error:
        "This brief was refunded when archived — escrow is gone. Publish a new brief instead.",
    };
  }

  const { error: updErr } = await adminDb
    .from("briefs")
    .update({ status: "open" })
    .eq("id", brief.id);
  if (updErr) {
    // Surface plan-limit errors with the standard prefix so the
    // client can show the upgrade prompt.
    return { ok: false, error: updErr.message };
  }

  return { ok: true };
}
