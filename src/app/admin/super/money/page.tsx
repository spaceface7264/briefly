import {
  lookupPayment,
  lookupClaim,
  refundPayment,
  retryTransfer,
} from "./actions";
import { requirePlatformAccountOrRedirect } from "@/lib/platform";
import { formatDkk } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface PaymentLookup {
  id: string;
  org_id: string;
  claim_id: string;
  creator_id: string;
  amount_dkk: number;
  total_dkk: number | null;
  gross_dkk: number;
  status: string;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  refunded_amount_dkk: number;
  brief_title_snapshot: string | null;
  creator_name_snapshot: string | null;
  invoice_number: string | null;
  created_at: string;
}

interface ClaimLookup {
  id: string;
  org_id: string;
  user_id: string;
  status: string;
  brief_id: string;
}

interface BriefLookup {
  id: string;
  title: string;
  price_dkk: number;
  funded_status: string;
  stripe_payment_intent_id: string | null;
  org_id: string;
}

interface CreatorLookup {
  id: string;
  name: string | null;
  stripe_account_id: string | null;
  stripe_payouts_enabled: boolean;
}

interface ExistingPaymentLookup {
  id: string;
  status: string;
  error_message: string | null;
  stripe_transfer_id: string | null;
}

export default async function MoneyToolsPage({
  searchParams,
}: {
  searchParams: Promise<{
    payment_id?: string;
    claim_id?: string;
    refund_error?: string;
    refund_ok?: string;
    retry_error?: string;
    retry_ok?: string;
  }>;
}) {
  const { supabase } = await requirePlatformAccountOrRedirect();
  const params = await searchParams;

  const paymentIdQuery = params.payment_id?.trim() ?? "";
  const claimIdQuery = params.claim_id?.trim() ?? "";

  // Refund lookup. Uses the user's RLS-bound client; the existing
  // platform_admin SELECT bypass on payments / claims / briefs grants
  // cross-org read access without a service-role escalation.
  let payment: PaymentLookup | null = null;
  let paymentBrief: BriefLookup | null = null;
  let paymentLookupError: string | null = null;
  if (paymentIdQuery) {
    const { data: row, error } = await supabase
      .from("payments")
      .select(
        "id, org_id, claim_id, creator_id, amount_dkk, total_dkk, gross_dkk, status, stripe_transfer_id, stripe_refund_id, refunded_amount_dkk, brief_title_snapshot, creator_name_snapshot, invoice_number, created_at"
      )
      .eq("id", paymentIdQuery)
      .maybeSingle();

    if (error) {
      paymentLookupError = error.message;
    } else if (!row) {
      paymentLookupError = "Payment not found";
    } else {
      payment = row as PaymentLookup;
      const { data: claimRow } = await supabase
        .from("claims")
        .select("brief_id")
        .eq("id", payment.claim_id)
        .maybeSingle();
      if (claimRow) {
        const { data: briefRow } = await supabase
          .from("briefs")
          .select(
            "id, title, price_dkk, funded_status, stripe_payment_intent_id, org_id"
          )
          .eq("id", claimRow.brief_id)
          .maybeSingle();
        if (briefRow) {
          paymentBrief = briefRow as BriefLookup;
        }
      }
    }
  }

  // Transfer-retry lookup.
  let claim: ClaimLookup | null = null;
  let claimBrief: BriefLookup | null = null;
  let claimCreator: CreatorLookup | null = null;
  let existingPayment: ExistingPaymentLookup | null = null;
  let claimLookupError: string | null = null;
  if (claimIdQuery) {
    const { data: row, error } = await supabase
      .from("claims")
      .select("id, org_id, user_id, status, brief_id")
      .eq("id", claimIdQuery)
      .maybeSingle();
    if (error) {
      claimLookupError = error.message;
    } else if (!row) {
      claimLookupError = "Claim not found";
    } else {
      claim = row as ClaimLookup;
      const [{ data: briefRow }, { data: creatorRow }, { data: payRow }] =
        await Promise.all([
          supabase
            .from("briefs")
            .select(
              "id, title, price_dkk, funded_status, stripe_payment_intent_id, org_id"
            )
            .eq("id", claim.brief_id)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("id, name, stripe_account_id, stripe_payouts_enabled")
            .eq("id", claim.user_id)
            .maybeSingle(),
          supabase
            .from("payments")
            .select("id, status, error_message, stripe_transfer_id")
            .eq("claim_id", claim.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
      claimBrief = (briefRow as BriefLookup | null) ?? null;
      claimCreator = (creatorRow as CreatorLookup | null) ?? null;
      existingPayment = (payRow as ExistingPaymentLookup | null) ?? null;
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Money tools</h1>
        <p className="text-muted">
          Manual levers for when the automated escrow and payout flows
          leave money in the wrong place. Every action lands in the
          platform audit log.
        </p>
      </div>

      <div className="space-y-8">
        <RefundSection
          paymentId={paymentIdQuery}
          payment={payment}
          brief={paymentBrief}
          lookupError={paymentLookupError}
          actionError={params.refund_error ?? null}
          successRefundId={params.refund_ok ?? null}
        />

        <RetrySection
          claimId={claimIdQuery}
          claim={claim}
          brief={claimBrief}
          creator={claimCreator}
          existingPayment={existingPayment}
          lookupError={claimLookupError}
          actionError={params.retry_error ?? null}
          successTransferId={params.retry_ok ?? null}
        />

        <CreditOrgSection />
      </div>
    </div>
  );
}

function RefundSection({
  paymentId,
  payment,
  brief,
  lookupError,
  actionError,
  successRefundId,
}: {
  paymentId: string;
  payment: PaymentLookup | null;
  brief: BriefLookup | null;
  lookupError: string | null;
  actionError: string | null;
  successRefundId: string | null;
}) {
  const totalDkk = payment ? payment.total_dkk ?? payment.amount_dkk : 0;
  const remainingDkk = payment
    ? totalDkk - (payment.refunded_amount_dkk ?? 0)
    : 0;
  const canRefund =
    payment !== null &&
    brief !== null &&
    Boolean(brief.stripe_payment_intent_id) &&
    remainingDkk > 0;

  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">1. Manual refund</h2>
        <p className="text-muted text-sm">
          Issues a Stripe refund against the brief&apos;s escrow
          PaymentIntent. Funds return to the org&apos;s saved card.
          Allowed for any payment row regardless of brief archive
          state.
        </p>
      </div>

      <form
        action={lookupPayment}
        method="get"
        className="flex flex-col sm:flex-row gap-2 mb-4"
      >
        <input
          type="text"
          name="payment_id"
          defaultValue={paymentId}
          required
          placeholder="payments.id (UUID)"
          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-mono"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-foreground/10 hover:bg-foreground/15 text-foreground font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          Look up
        </button>
      </form>

      {successRefundId && (
        <Banner tone="success">
          Refund issued. Stripe refund id:{" "}
          <code className="font-mono">{successRefundId}</code>
        </Banner>
      )}
      {actionError && <Banner tone="error">{actionError}</Banner>}
      {lookupError && <Banner tone="error">{lookupError}</Banner>}

      {payment && (
        <div className="bg-background border border-border rounded-lg p-4 mt-2">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Field label="Brief">
              {payment.brief_title_snapshot ?? "(no snapshot)"}
            </Field>
            <Field label="Creator">
              {payment.creator_name_snapshot ?? "(no snapshot)"}
            </Field>
            <Field label="Status">
              <StatusPill status={payment.status} />
            </Field>
            <Field label="Invoice">
              <span className="font-mono text-xs">
                {payment.invoice_number ?? "-"}
              </span>
            </Field>
            <Field label="Total">{formatDkk(totalDkk)}</Field>
            <Field label="Already refunded">
              {formatDkk(payment.refunded_amount_dkk ?? 0)}
            </Field>
            <Field label="Remaining refundable">
              <span
                className={
                  remainingDkk > 0 ? "text-accent font-medium" : "text-muted"
                }
              >
                {formatDkk(remainingDkk)}
              </span>
            </Field>
            <Field label="Transfer id">
              <span className="font-mono text-xs break-all">
                {payment.stripe_transfer_id ?? "-"}
              </span>
            </Field>
          </div>

          {!brief?.stripe_payment_intent_id && (
            <Banner tone="warn">
              Brief has no PaymentIntent on file (legacy or unfunded
              brief). Refund cannot be issued through this tool;
              reconcile in Stripe directly.
            </Banner>
          )}

          {canRefund ? (
            <form action={refundPayment} className="space-y-3">
              <input type="hidden" name="payment_id" value={payment.id} />
              <div className="grid sm:grid-cols-[1fr_2fr] gap-3">
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                    Refund amount (whole DKK)
                  </span>
                  <input
                    type="number"
                    name="amount_dkk"
                    min={1}
                    max={remainingDkk}
                    defaultValue={remainingDkk}
                    required
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-mono"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                    Reason (required, audit trail)
                  </span>
                  <input
                    type="text"
                    name="reason"
                    minLength={5}
                    maxLength={500}
                    required
                    placeholder="e.g. creator submission rejected after archive window, manual goodwill refund"
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg transition-colors text-sm"
              >
                Refund DKK
              </button>
            </form>
          ) : payment.status === "refunded" ? (
            <p className="text-xs text-muted mt-2">
              Payment is fully refunded. Nothing left to issue.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RetrySection({
  claimId,
  claim,
  brief,
  creator,
  existingPayment,
  lookupError,
  actionError,
  successTransferId,
}: {
  claimId: string;
  claim: ClaimLookup | null;
  brief: BriefLookup | null;
  creator: CreatorLookup | null;
  existingPayment: ExistingPaymentLookup | null;
  lookupError: string | null;
  actionError: string | null;
  successTransferId: string | null;
}) {
  const isFundedBrief =
    brief !== null &&
    (brief.funded_status === "funded" ||
      brief.funded_status === "partially_released");
  const creatorReady =
    creator !== null &&
    Boolean(creator.stripe_account_id) &&
    creator.stripe_payouts_enabled;
  const noSucceededYet =
    !existingPayment || existingPayment.status !== "succeeded";
  const claimEligible = claim !== null && claim.status === "approved";
  const canRetry =
    claim !== null && isFundedBrief && creatorReady && noSucceededYet && claimEligible;

  return (
    <section className="bg-surface border border-border rounded-xl p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">2. Retry stuck transfer</h2>
        <p className="text-muted text-sm">
          Re-issues the creator transfer for an approved claim where
          the original transfer failed. Brief escrow must be funded
          (or partially released) and the creator must have an
          onboarded Stripe account.
        </p>
      </div>

      <form
        action={lookupClaim}
        method="get"
        className="flex flex-col sm:flex-row gap-2 mb-4"
      >
        <input
          type="text"
          name="claim_id"
          defaultValue={claimId}
          required
          placeholder="claims.id (UUID)"
          className="flex-1 px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-mono"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-foreground/10 hover:bg-foreground/15 text-foreground font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          Look up
        </button>
      </form>

      {successTransferId && (
        <Banner tone="success">
          Transfer issued. Stripe transfer id:{" "}
          <code className="font-mono">{successTransferId}</code>
        </Banner>
      )}
      {actionError && <Banner tone="error">{actionError}</Banner>}
      {lookupError && <Banner tone="error">{lookupError}</Banner>}

      {claim && (
        <div className="bg-background border border-border rounded-lg p-4 mt-2">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Field label="Brief">{brief?.title ?? "(missing)"}</Field>
            <Field label="Creator">{creator?.name ?? "(missing)"}</Field>
            <Field label="Claim status">
              <StatusPill status={claim.status} />
            </Field>
            <Field label="Brief funded status">
              {brief ? <StatusPill status={brief.funded_status} /> : "-"}
            </Field>
            <Field label="Expected gross">
              {brief ? formatDkk(brief.price_dkk) : "-"}
            </Field>
            <Field label="Creator payouts ready">
              {creatorReady ? "Yes" : "No"}
            </Field>
            <Field label="Latest payment row">
              {existingPayment ? (
                <span className="text-xs">
                  <StatusPill status={existingPayment.status} />
                  {existingPayment.error_message && (
                    <span className="block text-muted mt-1">
                      {existingPayment.error_message}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted">No payment row yet</span>
              )}
            </Field>
            <Field label="Existing transfer id">
              <span className="font-mono text-xs break-all">
                {existingPayment?.stripe_transfer_id ?? "-"}
              </span>
            </Field>
          </div>

          {!claimEligible && (
            <Banner tone="warn">
              Claim must be in `approved` status to retry the transfer.
              Current: {claim.status}.
            </Banner>
          )}
          {claim && !creatorReady && (
            <Banner tone="warn">
              Creator has no payout-ready Stripe account. They need to
              finish onboarding before the transfer can land.
            </Banner>
          )}
          {brief && !isFundedBrief && (
            <Banner tone="warn">
              Brief funded_status is `{brief.funded_status}` (need
              `funded` or `partially_released`).
            </Banner>
          )}
          {existingPayment?.status === "succeeded" && (
            <Banner tone="warn">
              A succeeded payment already exists for this claim. No
              retry needed.
            </Banner>
          )}

          {canRetry && (
            <form action={retryTransfer} className="space-y-3">
              <input type="hidden" name="claim_id" value={claim.id} />
              <label className="block">
                <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                  Reason (required, audit trail)
                </span>
                <input
                  type="text"
                  name="reason"
                  minLength={5}
                  maxLength={500}
                  required
                  placeholder="e.g. retry after Stripe outage on 2026-05-04, original transfer never landed"
                  className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
                />
              </label>
              <button
                type="submit"
                className="px-4 py-2 bg-accent/15 hover:bg-accent/25 text-accent font-semibold rounded-lg transition-colors text-sm"
              >
                Retry transfer
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function CreditOrgSection() {
  return (
    <section className="bg-surface border border-border rounded-xl p-5 opacity-60">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">3. Credit org</h2>
        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/10 text-muted font-medium">
          Coming soon
        </span>
      </div>
      <p className="text-muted text-sm">
        Issue a one-off credit against an org&apos;s next invoice or
        as goodwill on a Stripe customer balance. Deferred to v2;
        manual handling via the Stripe dashboard until then.
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted mb-0.5">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "succeeded" || status === "released" || status === "active"
      ? "bg-success/15 text-success"
      : status === "failed" || status === "rejected"
        ? "bg-red-500/15 text-red-300"
        : status === "refunded"
          ? "bg-amber-400/15 text-amber-300"
          : status === "pending" ||
              status === "approved" ||
              status === "funded" ||
              status === "partially_released"
            ? "bg-accent/15 text-accent"
            : "bg-foreground/10 text-muted";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "success" | "error" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-success/10 border-success/30 text-success"
      : tone === "error"
        ? "bg-red-500/10 border-red-500/30 text-red-300"
        : "bg-amber-400/10 border-amber-400/30 text-amber-300";
  return (
    <div className={`border rounded-lg px-3 py-2 text-sm mb-3 ${cls}`}>
      {children}
    </div>
  );
}
