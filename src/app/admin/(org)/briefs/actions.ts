"use server";

import type Stripe from "stripe";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe/server";
import { getOrCreateOrgStripeCustomer } from "@/lib/stripe/customer";
import { requireOrgAdmin } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSupportAction } from "@/lib/platform";
import type {
  BriefCategory,
  BriefDurationClass,
} from "@/types/database";
import type { Json } from "@/types/database";
import {
  MIN_TOTAL_ESCROW_DKK,
  MAX_BRIEF_TITLE_LEN,
  getBriefAllowanceState,
  decidePublishCharge,
} from "@/lib/pricing";
import {
  sanitizeCountries,
  sanitizeLanguages,
  sanitizeSkills,
} from "@/lib/creator-profile";
import {
  commitBriefPublishCount,
  decrementBriefPublishCount,
} from "@/lib/billing/allowance";

type SimpleResult = { ok: true } | { ok: false; error: string };

// For actions that redirect on success — the only value the client
// ever observes is the failure case, so the return type narrows to
// the error variant. Same shape as createBriefWithEscrow's return.
type RedirectingResult = { ok: false; error: string };

/**
 * Stable, parameter-derived fingerprint for the publish-time
 * PaymentIntent's idempotency key.
 *
 * Why we need this: Stripe rejects retries that reuse an
 * idempotency key with mismatched parameters
 * (`Keys for idempotent requests can only be used with the same
 * parameters they were first used with`). The original key
 * (`brief-publish-{orgId}-{client_attempt_id}`) was scoped to the
 * form mount, so editing any field between submits triggered the
 * collision. Hashing the call params here means:
 *   - Network-blip retry with identical form state → same hash →
 *     same key → Stripe dedupes (preserves the original intent).
 *   - Edit-then-submit on the same mount → different hash →
 *     different key → fresh PaymentIntent.
 *   - Deliberate republish on a fresh mount → fresh
 *     `client_attempt_id` → different key (added entropy is the
 *     belt-and-suspenders for the rare same-content republish
 *     within Stripe's 24h idempotency window).
 *
 * Uses Web Crypto so the helper runs unchanged on Cloudflare
 * Workers (OpenNext deploy target) as well as Node.
 */
async function fingerprintBriefPublishParams(
  parts: {
    orgId: string;
    escrowDkk: number;
    overageDkk: number;
    priceDkk: number;
    claimLimit: number;
    title: string;
  }
): Promise<string> {
  const payload = [
    parts.orgId,
    String(parts.escrowDkk),
    String(parts.overageDkk),
    String(parts.priceDkk),
    String(parts.claimLimit),
    parts.title.slice(0, 80),
  ].join("|");
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

interface SettleSuccess {
  ok: true;
  paymentIntentId: string | null;
  escrowDkkCharged: number;
  overageDkkCharged: number;
  fundedStatus: "unfunded" | "funded";
}

interface SettleFailure {
  ok: false;
  error: string;
  needsPaymentMethod?: boolean;
}

/**
 * Settle the publish-time charge for a brief: read the org's
 * allowance state, decide whether the publish is covered by the
 * monthly quota or needs an overage, charge Stripe (escrow + overage
 * combined into one PaymentIntent), and atomically increment the
 * publish counter.
 *
 * Combined PI rationale: bundling both amounts in a single charge
 * means one bank line item for the org and one refund target on
 * archive (escrow refunds via partial refund, the overage portion
 * stays charged). It also keeps `briefs.stripe_payment_intent_id` as
 * the single source of truth for "how much did this brief cost
 * Stripe-side" without needing the `overage_payment_intent_id`
 * column to track a second PI.
 *
 * If the brief insert/update fails AFTER this returns, the caller
 * MUST refund the PI (when paymentIntentId is non-null) and call
 * `decrementBriefPublishCount` so the org isn't left with a phantom
 * publish on their meter and a charge on their card.
 */
async function settleBriefPublishCharge(args: {
  orgId: string;
  priceDkk: number;
  claimLimit: number;
  title: string;
  clientAttemptId: string;
}): Promise<SettleSuccess | SettleFailure> {
  const escrowDkk = args.priceDkk * args.claimLimit;
  const adminDb = createAdminClient();

  const allowanceState = await getBriefAllowanceState(adminDb, args.orgId);
  const decision = decidePublishCharge(allowanceState);

  if (decision.kind === "blocked") {
    return { ok: false, error: decision.reason };
  }

  const overageDkk = decision.kind === "overage" ? decision.overageDkk : 0;
  const totalChargeDkk = escrowDkk + overageDkk;

  // Free brief covered by allowance, no charge: still increment the
  // counter so the publish counts against the quota.
  if (totalChargeDkk === 0) {
    const commit = await commitBriefPublishCount(adminDb, args.orgId);
    if (!commit.ok) {
      return { ok: false, error: `Counter increment failed: ${commit.error}` };
    }
    return {
      ok: true,
      paymentIntentId: null,
      escrowDkkCharged: 0,
      overageDkkCharged: 0,
      fundedStatus: "unfunded",
    };
  }

  // From here: there's a real Stripe charge. The escrow floor only
  // applies when escrowDkk > 0; an overage-only charge (free brief +
  // overage) is allowed below the floor since 79 DKK > Stripe's
  // 2.50 DKK minimum and the floor was a guard for tiny escrow
  // totals, not a general lower bound on PaymentIntents.
  if (escrowDkk > 0 && escrowDkk < MIN_TOTAL_ESCROW_DKK) {
    return {
      ok: false,
      error: `Total escrow must be at least ${MIN_TOTAL_ESCROW_DKK} DKK. Increase the price or the slot count.`,
    };
  }

  const { data: org } = await adminDb
    .from("organizations")
    .select("name, stripe_customer_id, default_payment_method_id")
    .eq("id", args.orgId)
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

  const customerId = await getOrCreateOrgStripeCustomer(adminDb, args.orgId, {
    name: org.name,
    email: null,
  });

  const paramsFingerprint = await fingerprintBriefPublishParams({
    orgId: args.orgId,
    escrowDkk,
    overageDkk,
    priceDkk: args.priceDkk,
    claimLimit: args.claimLimit,
    title: args.title,
  });

  const description =
    overageDkk > 0
      ? `Brief publish: ${args.title.slice(0, 80)} (escrow ${escrowDkk} DKK + overage ${overageDkk} DKK)`
      : `Escrow for brief: ${args.title.slice(0, 80)}`;

  let paymentIntentId: string;
  try {
    const paymentIntent = await stripe().paymentIntents.create(
      {
        amount: totalChargeDkk * 100, // DKK to øre
        currency: "dkk",
        customer: customerId,
        payment_method: org.default_payment_method_id,
        confirm: true,
        off_session: true,
        description,
        metadata: {
          org_id: args.orgId,
          escrow_dkk: String(escrowDkk),
          overage_dkk: String(overageDkk),
          claim_limit: String(args.claimLimit),
          price_dkk: String(args.priceDkk),
          client_attempt_id: args.clientAttemptId,
        },
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      },
      {
        idempotencyKey: `brief-publish-${args.orgId}-${args.clientAttemptId}-${paramsFingerprint}`,
      }
    );

    if (paymentIntent.status !== "succeeded") {
      return { ok: false, error: friendlyStripeStatus(paymentIntent.status) };
    }
    paymentIntentId = paymentIntent.id;
  } catch (err) {
    return { ok: false, error: friendlyStripeError(err) };
  }

  const commit = await commitBriefPublishCount(adminDb, args.orgId);
  if (!commit.ok) {
    // Charge succeeded but the counter failed. Refund and surface so
    // the org isn't billed for a publish that won't appear on their
    // brief list.
    try {
      await stripe().refunds.create(
        {
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
          metadata: {
            reason: "publish_counter_increment_failed",
            org_id: args.orgId,
          },
        },
        { idempotencyKey: `brief-publish-rollback-${paymentIntentId}` }
      );
    } catch (refundErr) {
      const refundMsg =
        refundErr instanceof Error ? refundErr.message : "unknown";
      return {
        ok: false,
        error: `Charge succeeded but counter increment failed AND refund failed. Contact support. Counter error: ${commit.error}. Refund error: ${refundMsg}. PaymentIntent: ${paymentIntentId}.`,
      };
    }
    return {
      ok: false,
      error: `Counter increment failed; charge was refunded. ${commit.error}`,
    };
  }

  return {
    ok: true,
    paymentIntentId,
    escrowDkkCharged: escrowDkk,
    overageDkkCharged: overageDkk,
    fundedStatus: escrowDkk > 0 ? "funded" : "unfunded",
  };
}

/**
 * Compensating rollback called when a brief insert/update fails
 * after `settleBriefPublishCharge` has already charged and
 * incremented. Refunds the PI (if any) and decrements the counter.
 * Best-effort — surfaces a support-friendly message if the refund
 * itself fails.
 */
async function rollbackPublishCharge(
  orgId: string,
  paymentIntentId: string | null,
  reasonContext: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const adminDb = createAdminClient();

  if (paymentIntentId) {
    try {
      await stripe().refunds.create(
        {
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
          metadata: { reason: reasonContext, org_id: orgId },
        },
        { idempotencyKey: `brief-publish-rollback-${paymentIntentId}` }
      );
    } catch (refundErr) {
      const refundMsg =
        refundErr instanceof Error ? refundErr.message : "unknown";
      return {
        ok: false,
        error: `Refund failed during rollback (${reasonContext}). PaymentIntent: ${paymentIntentId}. Error: ${refundMsg}.`,
      };
    }
  }

  // Best-effort: if this fails, the org's counter is +1 but no money
  // was misplaced. Logging it from the caller is enough.
  await decrementBriefPublishCount(adminDb, orgId);
  return { ok: true };
}

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
  /** Soft-match targeting. Empty arrays mean "no filter on this
   *  dimension". Values are sanitised server-side against the
   *  controlled vocabularies in src/lib/creator-profile.ts. */
  target_skills: string[];
  target_languages: string[];
  target_countries: string[];
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
  // Money-moving path: settles a publish-time charge against the
  // org's saved card. requireOrgAdmin() also accepts platform admins
  // scoped into this org via support mode; the actingAs flag drives
  // the platform_audit_log write below.
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId, orgId, actingAs } = gate;

  // Defense-in-depth: trim and length-check the title here so a
  // crafted request can't bypass the form's `maxLength` and ship a
  // multi-kilobyte title (which would also break downstream Stripe
  // description, email subject lines, and the briefs list layout).
  const trimmedTitle = (input.title ?? "").trim();
  if (!trimmedTitle) {
    return { ok: false, error: "Title is required." };
  }
  if (trimmedTitle.length > MAX_BRIEF_TITLE_LEN) {
    return {
      ok: false,
      error: `Title must be ${MAX_BRIEF_TITLE_LEN} characters or fewer.`,
    };
  }
  input = { ...input, title: trimmedTitle };

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

  // Settle the publish-time charge: allowance check, then escrow +
  // optional overage in a single PaymentIntent. Returns the PI id
  // (or null when allowance covers a free brief) and the per-side
  // amounts to record on the brief.
  const settle = await settleBriefPublishCharge({
    orgId,
    priceDkk: input.price_dkk,
    claimLimit: input.claim_limit,
    title: input.title,
    clientAttemptId: input.client_attempt_id,
  });
  if (!settle.ok) {
    return {
      ok: false,
      error: settle.error,
      needsPaymentMethod: settle.needsPaymentMethod,
    };
  }

  const escrowAmountDkk = settle.escrowDkkCharged > 0 ? settle.escrowDkkCharged : null;
  const escrowHeldDkk = settle.escrowDkkCharged > 0 ? settle.escrowDkkCharged : null;
  const overageChargeDkk =
    settle.overageDkkCharged > 0 ? settle.overageDkkCharged : null;

  // Insert via the standard (RLS-bound) client so members + admins
  // both retain the existing permission to create briefs in their
  // org. If the insert fails after a successful charge,
  // rollbackPublishCharge refunds + decrements the counter.
  const { data: brief, error: insertErr } = await supabase
    .from("briefs")
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
      target_skills: sanitizeSkills(input.target_skills),
      target_languages: sanitizeLanguages(input.target_languages),
      target_countries: sanitizeCountries(input.target_countries),
      created_by: userId,
      org_id: orgId,
      status: "open",
      published_at: new Date().toISOString(),
      funded_status: settle.fundedStatus,
      escrow_amount_dkk: escrowAmountDkk,
      escrow_held_dkk: escrowHeldDkk,
      stripe_payment_intent_id: settle.paymentIntentId,
      overage_charge_dkk: overageChargeDkk,
    })
    .select("id")
    .single();

  if (insertErr || !brief) {
    const rollback = await rollbackPublishCharge(
      orgId,
      settle.paymentIntentId,
      "brief_insert_failed"
    );
    if (!rollback.ok) {
      const insertMsg = insertErr?.message ?? "unknown";
      return {
        ok: false,
        error: `Brief save failed AND rollback failed. Contact support. Original error: ${insertMsg}. Rollback: ${rollback.error}`,
      };
    }
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to save brief",
    };
  }

  if (actingAs === "platform-support") {
    await logSupportAction(supabase, {
      actorId: userId,
      action: "brief.create_with_escrow",
      targetOrgId: orgId,
      targetTable: "briefs",
      targetRowId: brief.id,
      after: {
        title: input.title,
        price_dkk: input.price_dkk,
        claim_limit: input.claim_limit,
        escrow_dkk_charged: settle.escrowDkkCharged,
        overage_dkk_charged: settle.overageDkkCharged,
        payment_intent_id: settle.paymentIntentId,
      },
    });
  }

  // Success: redirect at the action layer. Throws NEXT_REDIRECT which
  // Next translates into a 303 response; the browser navigates before
  // the client ever sees a "result." The destination's loading.tsx
  // shows immediately, so the form doesn't sit there with stale
  // "Charging…" while /admin/briefs server-renders.
  // The ?flash=brief-published param is consumed by the destination's
  // <FlashToast /> on mount; the toast is the success acknowledgement
  // that the form would otherwise fire if the redirect had returned
  // here instead of throwing NEXT_REDIRECT first. The brief title
  // rides along so the toast can name what just got published.
  const titleParam = encodeURIComponent(input.title.slice(0, 200));
  redirect(`/admin/briefs?flash=brief-published&title=${titleParam}`);
}

/**
 * Save a brief in `draft` status: no escrow charge, no overage, no
 * counter increment. Drafts are editable in /admin/briefs and only
 * billable when the org chooses to publish them.
 *
 * Reuses the same input shape as `createBriefWithEscrow` (sans the
 * idempotency-key fields, which only matter for a charge). Returns
 * the new brief id so the form can route to the draft's edit page.
 */
type DraftInput = Omit<NewBriefInput, "client_attempt_id">;

export async function saveBriefDraft(
  input: DraftInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  // Drafts don't move money but still write under the org's name; gate
  // through requireOrgAdmin so support mode is recognised and audited.
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId, orgId, actingAs } = gate;

  const trimmedTitle = (input.title ?? "").trim();
  if (!trimmedTitle) return { ok: false, error: "Title is required." };
  if (trimmedTitle.length > MAX_BRIEF_TITLE_LEN) {
    return {
      ok: false,
      error: `Title must be ${MAX_BRIEF_TITLE_LEN} characters or fewer.`,
    };
  }
  if (input.price_dkk < 0 || input.claim_limit < 1) {
    return { ok: false, error: "Invalid price or slot count" };
  }

  const { data: brief, error: insertErr } = await supabase
    .from("briefs")
    .insert({
      title: trimmedTitle,
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
      target_skills: sanitizeSkills(input.target_skills),
      target_languages: sanitizeLanguages(input.target_languages),
      target_countries: sanitizeCountries(input.target_countries),
      created_by: userId,
      org_id: orgId,
      status: "draft",
      published_at: null,
      funded_status: "unfunded",
    })
    .select("id")
    .single();

  if (insertErr || !brief) {
    return { ok: false, error: insertErr?.message ?? "Failed to save draft" };
  }

  if (actingAs === "platform-support") {
    await logSupportAction(supabase, {
      actorId: userId,
      action: "brief.draft_save",
      targetOrgId: orgId,
      targetTable: "briefs",
      targetRowId: brief.id,
      after: {
        title: trimmedTitle,
        price_dkk: input.price_dkk,
        claim_limit: input.claim_limit,
      },
    });
  }

  return { ok: true, id: brief.id };
}

/**
 * Publish a saved draft: settle the publish charge against the org's
 * allowance + overage and flip the brief to status='open'. The brief
 * row's price/claim_limit/title are read from the database (not the
 * client) so a tampered request can't pay for one set of params and
 * publish another.
 */
export async function publishBriefFromDraft(
  briefId: string,
  clientAttemptId: string
): Promise<{ ok: false; error: string; needsPaymentMethod?: boolean }> {
  // Money-moving path: settles the publish charge against the org's
  // saved card, exactly like createBriefWithEscrow but starting from
  // an existing draft. Same gate, same audit trail when run in
  // support mode.
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId, orgId, actingAs } = gate;

  if (
    typeof clientAttemptId !== "string" ||
    clientAttemptId.length === 0 ||
    clientAttemptId.length >= 80
  ) {
    return {
      ok: false,
      error: "Invalid form state. Reload the page and try again.",
    };
  }

  // Read the canonical row server-side. RLS already restricts SELECT
  // to org members, but we still verify org_id and status to harden
  // against a crafted briefId in another org's draft list.
  const adminDb = createAdminClient();
  const { data: brief, error: briefErr } = await adminDb
    .from("briefs")
    .select("id, org_id, title, price_dkk, claim_limit, status")
    .eq("id", briefId)
    .single();
  if (briefErr || !brief) {
    return { ok: false, error: "Draft not found" };
  }
  if (brief.org_id !== orgId) {
    return { ok: false, error: "Draft does not belong to your org" };
  }
  if (brief.status !== "draft") {
    return { ok: false, error: "Brief is already published" };
  }

  const settle = await settleBriefPublishCharge({
    orgId,
    priceDkk: brief.price_dkk,
    claimLimit: brief.claim_limit ?? 1,
    title: brief.title,
    clientAttemptId,
  });
  if (!settle.ok) {
    return {
      ok: false,
      error: settle.error,
      needsPaymentMethod: settle.needsPaymentMethod,
    };
  }

  const escrowAmountDkk = settle.escrowDkkCharged > 0 ? settle.escrowDkkCharged : null;
  const escrowHeldDkk = settle.escrowDkkCharged > 0 ? settle.escrowDkkCharged : null;
  const overageChargeDkk =
    settle.overageDkkCharged > 0 ? settle.overageDkkCharged : null;

  // Use the admin client so the row update isn't blocked by RLS on
  // status transitions (which include 'draft' -> 'open' that members
  // are allowed to do anyway, but the funded_status / escrow fields
  // are sensitive and worth keeping behind the admin path that the
  // settle helper already uses).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (adminDb.from("briefs") as any)
    .update({
      status: "open",
      published_at: new Date().toISOString(),
      funded_status: settle.fundedStatus,
      escrow_amount_dkk: escrowAmountDkk,
      escrow_held_dkk: escrowHeldDkk,
      stripe_payment_intent_id: settle.paymentIntentId,
      overage_charge_dkk: overageChargeDkk,
    })
    .eq("id", briefId);

  if (updErr) {
    const rollback = await rollbackPublishCharge(
      orgId,
      settle.paymentIntentId,
      "draft_publish_update_failed"
    );
    if (!rollback.ok) {
      return {
        ok: false,
        error: `Publish failed AND rollback failed. Contact support. Original error: ${updErr.message}. Rollback: ${rollback.error}`,
      };
    }
    return { ok: false, error: updErr.message };
  }

  if (actingAs === "platform-support") {
    await logSupportAction(supabase, {
      actorId: userId,
      action: "brief.publish",
      targetOrgId: orgId,
      targetTable: "briefs",
      targetRowId: briefId,
      after: {
        title: brief.title,
        price_dkk: brief.price_dkk,
        claim_limit: brief.claim_limit,
        escrow_dkk_charged: settle.escrowDkkCharged,
        overage_dkk_charged: settle.overageDkkCharged,
        payment_intent_id: settle.paymentIntentId,
      },
    });
  }

  const titleParam = encodeURIComponent(brief.title.slice(0, 200));
  redirect(`/admin/briefs?flash=brief-published&title=${titleParam}`);
}

/**
 * Update an existing draft. Only allowed while status='draft' so we
 * can't accidentally rewrite a published brief through this path.
 */
export async function updateBriefDraft(
  briefId: string,
  input: DraftInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { supabase, userId, orgId, actingAs } = gate;

  const trimmedTitle = (input.title ?? "").trim();
  if (!trimmedTitle) return { ok: false, error: "Title is required." };
  if (trimmedTitle.length > MAX_BRIEF_TITLE_LEN) {
    return {
      ok: false,
      error: `Title must be ${MAX_BRIEF_TITLE_LEN} characters or fewer.`,
    };
  }
  if (input.price_dkk < 0 || input.claim_limit < 1) {
    return { ok: false, error: "Invalid price or slot count" };
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("briefs")
    .select("id, org_id, status")
    .eq("id", briefId)
    .single();
  if (fetchErr || !existing) {
    return { ok: false, error: "Draft not found" };
  }
  if (existing.org_id !== orgId) {
    return { ok: false, error: "Draft does not belong to your org" };
  }
  if (existing.status !== "draft") {
    return { ok: false, error: "Cannot edit a published brief through draft update" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabase.from("briefs") as any)
    .update({
      title: trimmedTitle,
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
      target_skills: sanitizeSkills(input.target_skills),
      target_languages: sanitizeLanguages(input.target_languages),
      target_countries: sanitizeCountries(input.target_countries),
    })
    .eq("id", briefId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  if (actingAs === "platform-support") {
    await logSupportAction(supabase, {
      actorId: userId,
      action: "brief.draft_update",
      targetOrgId: orgId,
      targetTable: "briefs",
      targetRowId: briefId,
      after: {
        title: trimmedTitle,
        price_dkk: input.price_dkk,
        claim_limit: input.claim_limit,
      },
    });
  }

  return { ok: true };
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
 * Archive a single brief and refund any unreleased escrow.
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
 * escrow_held_dkk is zeroed. Internal helper shared by the
 * redirecting single-brief action and the bulk variant; returns a
 * per-brief result so the bulk caller can build a summary without
 * short-circuiting on the first failure.
 */
async function archiveOneBriefWithRefund(
  briefId: string,
  orgId: string
): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  const adminDb = createAdminClient();

  const { data: brief, error: briefErr } = await adminDb
    .from("briefs")
    .select(
      "id, org_id, title, status, funded_status, escrow_held_dkk, stripe_payment_intent_id"
    )
    .eq("id", briefId)
    .single();
  if (briefErr || !brief) {
    return { ok: false, error: "Brief not found" };
  }
  if (brief.org_id !== orgId) {
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
            org_id: orgId,
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

  return { ok: true, title: brief.title ?? "" };
}

/**
 * Archive a brief and refund any unreleased escrow back to the org's
 * payment method. Phase 1.1e of the post-genericization roadmap.
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

  const result = await archiveOneBriefWithRefund(briefId, gate.orgId);
  if (!result.ok) return { ok: false, error: result.error };

  const titleParam = encodeURIComponent(result.title);
  redirect(`/admin/briefs?flash=brief-archived&title=${titleParam}`);
}

/**
 * Reopen a single brief. Internal helper shared by the single-action
 * and bulk variants.
 *
 * Refunded briefs are blocked — the escrow is gone, so there's
 * nothing to back creator payouts. The admin must publish a new
 * brief (which charges the org's card) instead. Unfunded / free
 * briefs reopen freely. Briefs archived without ever being funded
 * (legacy data) also pass through.
 */
async function reopenOneBrief(
  briefId: string,
  orgId: string
): Promise<SimpleResult> {
  const adminDb = createAdminClient();

  const { data: brief, error: briefErr } = await adminDb
    .from("briefs")
    .select("id, org_id, status, funded_status")
    .eq("id", briefId)
    .single();
  if (briefErr || !brief) {
    return { ok: false, error: "Brief not found" };
  }
  if (brief.org_id !== orgId) {
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

/**
 * Reopen an archived brief. See `reopenOneBrief` for the underlying
 * rules.
 */
export async function reopenBrief(briefId: string): Promise<SimpleResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  return reopenOneBrief(briefId, gate.orgId);
}

/**
 * Hard-delete a single brief. Only allowed when the brief has zero
 * claims of any status — once a creator has interacted with the
 * brief there's a payment / submission audit trail to preserve, so
 * those briefs must be archived instead.
 *
 * Funded escrow is refunded before the row is removed, with state
 * persisted between the refund and the delete so a partial failure
 * leaves the brief in `archived + refunded` rather than orphaning a
 * Stripe PaymentIntent. A retry then skips the refund branch
 * entirely (idempotent).
 *
 * Admin-only — refunds move real money and the operation is
 * irreversible.
 */
async function deleteOneBrief(
  briefId: string,
  orgId: string
): Promise<SimpleResult> {
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
  if (brief.org_id !== orgId) {
    return { ok: false, error: "Brief does not belong to your org" };
  }

  // Block delete when any claim row exists for this brief — even
  // cancelled claims keep an audit trail (reclaim cooldowns, payouts,
  // notifications) we don't want to silently drop. `head: true`
  // returns just the count without hauling rows back.
  const { count: claimCount, error: countErr } = await adminDb
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("brief_id", brief.id);
  if (countErr) {
    return { ok: false, error: `Couldn't check claims: ${countErr.message}` };
  }
  if ((claimCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Brief has been claimed and can't be deleted. Archive it instead.",
    };
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
            org_id: orgId,
            brief_id: brief.id,
            refund_kind: "escrow_delete",
          },
        },
        { idempotencyKey: `delete-refund-${brief.id}` }
      );
    } catch (err) {
      return {
        ok: false,
        error: `Refund failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      };
    }

    // Persist the refund before attempting the row delete. If the
    // delete then fails the brief is left as archived + refunded
    // rather than `funded` with a stale PaymentIntent — and a retry
    // will skip the refund branch entirely.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updErr } = await (adminDb.from("briefs") as any)
      .update({
        status: "archived",
        funded_status: "refunded",
        escrow_held_dkk: 0,
      })
      .eq("id", brief.id);
    if (updErr) {
      return {
        ok: false,
        error: `Refund succeeded but bookkeeping failed: ${updErr.message}. Contact support.`,
      };
    }
  }

  const { error: delErr } = await adminDb
    .from("briefs")
    .delete()
    .eq("id", brief.id);
  if (delErr) {
    return { ok: false, error: `Couldn't delete brief: ${delErr.message}` };
  }

  return { ok: true };
}

export type BulkBriefResult = {
  ok: true;
  succeeded: number;
  failed: { briefId: string; error: string }[];
};

function emptyBulkResult(): BulkBriefResult {
  return { ok: true, succeeded: 0, failed: [] };
}

/**
 * Bulk variant of `archiveBriefWithRefund`. Per-brief errors are
 * collected so the caller can show a summary toast. The action does
 * not redirect — the client refreshes the route after consuming the
 * result.
 */
export async function archiveBriefsBulk(
  briefIds: string[]
): Promise<BulkBriefResult | { ok: false; error: string }> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const result = emptyBulkResult();
  for (const id of briefIds) {
    const outcome = await archiveOneBriefWithRefund(id, gate.orgId);
    if (outcome.ok) result.succeeded += 1;
    else result.failed.push({ briefId: id, error: outcome.error });
  }
  return result;
}

/**
 * Bulk variant of `reopenBrief`.
 */
export async function reopenBriefsBulk(
  briefIds: string[]
): Promise<BulkBriefResult | { ok: false; error: string }> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const result = emptyBulkResult();
  for (const id of briefIds) {
    const outcome = await reopenOneBrief(id, gate.orgId);
    if (outcome.ok) result.succeeded += 1;
    else result.failed.push({ briefId: id, error: outcome.error });
  }
  return result;
}

/**
 * Bulk hard-delete. Refuses any brief that has claim history;
 * refunds funded escrow before removing the row. See `deleteOneBrief`
 * for full per-brief semantics.
 */
export async function deleteBriefsBulk(
  briefIds: string[]
): Promise<BulkBriefResult | { ok: false; error: string }> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const result = emptyBulkResult();
  for (const id of briefIds) {
    const outcome = await deleteOneBrief(id, gate.orgId);
    if (outcome.ok) result.succeeded += 1;
    else result.failed.push({ briefId: id, error: outcome.error });
  }
  return result;
}
