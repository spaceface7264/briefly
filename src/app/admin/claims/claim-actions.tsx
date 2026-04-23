"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal, ConfirmDialog } from "@/components/modal";
import { payClaim } from "./pay-action";

interface ClaimActionsProps {
  claim: {
    id: string;
    status: string;
    submission_url?: string;
    submission_notes?: string;
    brief?: {
      title: string;
    };
    creator?: {
      name: string;
      email: string;
      stripe_payouts_enabled?: boolean;
    };
  };
  paidInvoice?: {
    id: string;
    invoice_number: string | null;
  } | null;
}

type PendingAction = null | "approve" | "reject" | "pay";

export function ClaimActions({ claim, paidInvoice }: ClaimActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [paying, startPaying] = useTransition();
  const [payError, setPayError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const creatorLabel = claim.creator?.name || claim.creator?.email || "this creator";

  async function updateStatus(newStatus: string) {
    setLoading(true);
    setActionError(null);
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("claims") as any)
      .update({ status: newStatus })
      .eq("id", claim.id);

    if (error) {
      console.error("Update error:", error);
      setActionError("Failed to update claim status");
      setLoading(false);
      return;
    }

    setLoading(false);
    setPending(null);
    setShowSubmission(false);
    router.refresh();
  }

  async function handleApprove() {
    await updateStatus("approved");
  }

  async function handleReject() {
    await updateStatus("cancelled");
  }

  function handlePay() {
    setPayError(null);
    startPaying(async () => {
      const result = await payClaim(claim.id);
      if (!result.ok) {
        setPayError(result.error);
        setPending(null);
        return;
      }
      setPending(null);
      router.refresh();
    });
  }

  if (claim.status === "submitted") {
    return (
      <div className="flex items-center gap-2 justify-end">
        {claim.submission_url && (
          <button
            onClick={() => setShowSubmission(true)}
            className="px-3 py-1.5 text-sm text-accent hover:bg-accent-muted rounded-lg transition-colors"
          >
            View
          </button>
        )}
        <button
          onClick={() => setPending("approve")}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-success-muted text-success hover:bg-success/25 disabled:opacity-50 rounded-lg transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => setPending("reject")}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-error-muted text-error hover:bg-error/25 disabled:opacity-50 rounded-lg transition-colors"
        >
          Reject
        </button>

        <SubmissionModal
          open={showSubmission}
          onClose={() => setShowSubmission(false)}
          claim={claim}
          onApprove={() => {
            setShowSubmission(false);
            setPending("approve");
          }}
          onReject={() => {
            setShowSubmission(false);
            setPending("reject");
          }}
        />

        <ConfirmDialog
          open={pending === "approve"}
          onClose={() => !loading && setPending(null)}
          onConfirm={handleApprove}
          title="Approve submission?"
          description={`Approve the submission from ${creatorLabel}. The claim will move to "Approved" and be ready for payout.`}
          confirmLabel="Approve"
          tone="success"
          loading={loading}
        />

        <ConfirmDialog
          open={pending === "reject"}
          onClose={() => !loading && setPending(null)}
          onConfirm={handleReject}
          title="Reject this claim?"
          description={`The claim will be cancelled and ${creatorLabel} will need to reclaim the brief to try again.`}
          confirmLabel="Reject claim"
          tone="danger"
          loading={loading}
        />

        {actionError && (
          <span className="text-xs text-error">{actionError}</span>
        )}
      </div>
    );
  }

  if (claim.status === "approved") {
    const payoutsEnabled = claim.creator?.stripe_payouts_enabled ?? false;

    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => setPending("pay")}
          disabled={paying || !payoutsEnabled}
          title={payoutsEnabled ? undefined : "Creator hasn't connected a payout account"}
          className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-background disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {paying ? "Paying..." : "Pay"}
        </button>
        {!payoutsEnabled && (
          <span className="text-xs text-muted">No payout account</span>
        )}
        {payError && <span className="text-xs text-error">{payError}</span>}

        <ConfirmDialog
          open={pending === "pay"}
          onClose={() => !paying && setPending(null)}
          onConfirm={handlePay}
          title="Send payout?"
          description={`Pay out to ${creatorLabel} via Stripe. This triggers a real transfer and cannot be reversed from the dashboard.`}
          confirmLabel="Send payout"
          tone="brand"
          loading={paying}
        />
      </div>
    );
  }

  if (claim.status === "active") {
    return (
      <span className="text-muted text-sm">Awaiting submission</span>
    );
  }

  if (claim.status === "paid" && paidInvoice) {
    return (
      <a
        href={`/api/invoices/${paidInvoice.id}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 text-sm text-accent hover:bg-accent-muted rounded-lg transition-colors inline-block"
      >
        Invoice {paidInvoice.invoice_number}
      </a>
    );
  }

  return null;
}

function SubmissionModal({
  open,
  onClose,
  claim,
  onApprove,
  onReject,
}: {
  open: boolean;
  onClose: () => void;
  claim: ClaimActionsProps["claim"];
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review submission"
      description={claim.brief?.title}
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={onReject}
            className="px-4 py-2 bg-error-muted text-error hover:bg-error/25 text-sm font-semibold rounded-lg transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-success hover:bg-success/80 text-background text-sm font-semibold rounded-lg transition-colors"
          >
            Approve
          </button>
        </>
      }
    >
      <dl className="space-y-5">
        <div>
          <dt className="text-xs text-muted uppercase tracking-wider mb-1">
            Creator
          </dt>
          <dd className="font-medium">
            {claim.creator?.name || claim.creator?.email}
          </dd>
        </div>

        {claim.submission_url && (
          <div>
            <dt className="text-xs text-muted uppercase tracking-wider mb-1">
              Submission URL
            </dt>
            <dd>
              <a
                href={claim.submission_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-accent hover:underline break-all font-mono text-sm"
              >
                {claim.submission_url}
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </dd>
          </div>
        )}

        {claim.submission_notes && (
          <div>
            <dt className="text-xs text-muted uppercase tracking-wider mb-1">
              Notes from creator
            </dt>
            <dd className="bg-surface border border-border rounded-lg p-3 text-sm whitespace-pre-wrap">
              {claim.submission_notes}
            </dd>
          </div>
        )}
      </dl>
    </Modal>
  );
}
