"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal, ConfirmDialog } from "@/components/modal";
import { payClaim } from "./pay-action";
import { getClaimAttachmentSignedUrls } from "@/app/briefs/[id]/actions";

type Attachment = {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  signed_url: string;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  /**
   * True when the viewer is an org admin. Members can review and
   * approve/reject submissions (server-side `claims.update` RLS
   * allows it) but cannot release funds — `payClaim` still calls
   * `requireOrgAdmin()`. Hide the Pay button accordingly.
   */
  canPay: boolean;
}

type PendingAction = null | "approve" | "reject" | "pay";

export function ClaimActions({ claim, paidInvoice, canPay }: ClaimActionsProps) {
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
        <button
          onClick={() => setShowSubmission(true)}
          className="px-3 py-1.5 text-sm text-accent hover:bg-accent-muted rounded-lg transition-colors"
        >
          Review
        </button>
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

    if (!canPay) {
      return (
        <div className="flex flex-col items-end gap-1">
          <span
            title="Releasing funds is admin-only — ask an admin"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted bg-surface-raised border border-border rounded-lg select-none cursor-not-allowed"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Awaiting admin payout
          </span>
        </div>
      );
    }

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
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

  // Fetch signed URLs each time the modal opens. Signed URLs have a
  // short TTL (15 min server-side), so re-fetching on every open beats
  // caching and serving stale URLs.
  useEffect(() => {
    if (!open) return;
    setLoadingAttachments(true);
    setAttachmentsError(null);
    setAttachments(null);
    (async () => {
      const result = await getClaimAttachmentSignedUrls(claim.id);
      if (result.ok) {
        setAttachments(result.attachments);
      } else {
        setAttachmentsError(result.error);
      }
      setLoadingAttachments(false);
    })();
  }, [open, claim.id]);

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

        <div>
          <dt className="text-xs text-muted uppercase tracking-wider mb-2">
            Files
          </dt>
          <dd>
            {loadingAttachments && (
              <p className="text-sm text-muted">Loading…</p>
            )}
            {attachmentsError && (
              <p className="text-sm text-error">{attachmentsError}</p>
            )}
            {attachments && attachments.length === 0 && (
              <p className="text-sm text-muted">No files uploaded.</p>
            )}
            {attachments && attachments.length > 0 && (
              <ul className="space-y-3">
                {attachments.map((att) => (
                  <AttachmentPreview key={att.id} attachment={att} />
                ))}
              </ul>
            )}
          </dd>
        </div>

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

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mime_type.startsWith("image/");
  const isVideo = attachment.mime_type.startsWith("video/");

  return (
    <li className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
        <span className="text-sm font-medium truncate">{attachment.filename}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted">{formatBytes(attachment.file_size)}</span>
          <a
            href={attachment.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Download
          </a>
        </div>
      </div>
      {isImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.signed_url}
          alt={attachment.filename}
          className="block w-full max-h-96 object-contain bg-background"
        />
      )}
      {isVideo && (
        <video
          src={attachment.signed_url}
          controls
          preload="metadata"
          className="block w-full max-h-96 bg-background"
        />
      )}
      {!isImage && !isVideo && (
        <div className="px-3 py-3 text-xs text-muted">
          {attachment.mime_type} — open via Download to preview.
        </div>
      )}
    </li>
  );
}
