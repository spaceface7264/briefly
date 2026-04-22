"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

export function ClaimActions({ claim, paidInvoice }: ClaimActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [paying, startPaying] = useTransition();
  const [payError, setPayError] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("claims") as any)
      .update({ status: newStatus })
      .eq("id", claim.id);

    if (error) {
      console.error("Update error:", error);
      alert("Failed to update claim status");
      setLoading(false);
      return;
    }

    router.refresh();
    setLoading(false);
  }

  async function handleApprove() {
    if (!confirm(`Approve submission from ${claim.creator?.name || claim.creator?.email}?`)) return;
    await updateStatus("approved");
  }

  async function handleReject() {
    if (!confirm(`Reject and cancel this claim? The creator will need to reclaim the brief.`)) return;
    await updateStatus("cancelled");
  }

  function handlePay() {
    if (!confirm(`Send payout to ${claim.creator?.name || claim.creator?.email} via Stripe?`)) return;
    setPayError(null);
    startPaying(async () => {
      const result = await payClaim(claim.id);
      if (!result.ok) {
        setPayError(result.error);
        return;
      }
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
          onClick={handleApprove}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-success/20 text-success hover:bg-success/30 disabled:opacity-50 rounded-lg transition-colors"
        >
          Approve
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-error/20 text-error hover:bg-error/30 disabled:opacity-50 rounded-lg transition-colors"
        >
          Reject
        </button>

        {showSubmission && (
          <SubmissionModal
            claim={claim}
            onClose={() => setShowSubmission(false)}
            onApprove={handleApprove}
            onReject={handleReject}
            loading={loading}
          />
        )}
      </div>
    );
  }

  if (claim.status === "approved") {
    const payoutsEnabled = claim.creator?.stripe_payouts_enabled ?? false;

    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={handlePay}
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
  claim,
  onClose,
  onApprove,
  onReject,
  loading,
}: {
  claim: ClaimActionsProps["claim"];
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
        <h2 className="text-xl font-bold mb-4">Review Submission</h2>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-muted text-sm mb-1">Brief</p>
            <p className="font-medium">{claim.brief?.title}</p>
          </div>

          <div>
            <p className="text-muted text-sm mb-1">Creator</p>
            <p className="font-medium">{claim.creator?.name || claim.creator?.email}</p>
          </div>

          {claim.submission_url && (
            <div>
              <p className="text-muted text-sm mb-1">Submission URL</p>
              <a
                href={claim.submission_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline break-all"
              >
                {claim.submission_url}
              </a>
            </div>
          )}

          {claim.submission_notes && (
            <div>
              <p className="text-muted text-sm mb-1">Notes from Creator</p>
              <p className="text-foreground whitespace-pre-wrap">{claim.submission_notes}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onApprove}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-success/20 text-success hover:bg-success/30 disabled:opacity-50 font-medium rounded-lg transition-colors"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-error/20 text-error hover:bg-error/30 disabled:opacity-50 font-medium rounded-lg transition-colors"
          >
            Reject
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-border hover:bg-surface-hover font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
