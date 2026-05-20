"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal, ConfirmDialog } from "@/components/modal";
import { Avatar } from "@/components/avatar";
import { ClaimCommentThread } from "@/components/claim-comment-thread";
import { payClaim } from "./pay-action";
import { requestRevision, rejectClaim } from "./review-actions";
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
      avatar_url?: string | null;
    };
  };
  paidInvoice?: {
    id: string;
    invoice_number: string | null;
  } | null;
  /**
   * True when the viewer is an org admin. Members can review and
   * request changes / reject (server-side RLS allows it) but cannot
   * release funds — `payClaim` still calls `requireOrgAdmin()`. The
   * combined "Approve & Pay" button is therefore admin-only too; we
   * fall back to a disabled hint for members.
   */
  canPay: boolean;
}

export function ClaimActions({ claim, paidInvoice, canPay }: ClaimActionsProps) {
  const router = useRouter();
  const [showReview, setShowReview] = useState(false);

  const creatorLabel = claim.creator?.name || claim.creator?.email || "this creator";

  if (claim.status === "submitted") {
    return (
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setShowReview(true)}
          className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-background rounded-lg transition-colors"
        >
          Review
        </button>

        <ReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          claim={claim}
          canPay={canPay}
          creatorLabel={creatorLabel}
          onDone={() => {
            setShowReview(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  if (claim.status === "revision_requested") {
    return (
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={() => setShowReview(true)}
          className="px-3 py-1.5 text-sm bg-surface-raised hover:bg-surface-hover border border-border rounded-lg transition-colors"
        >
          View thread
        </button>
        <span className="text-muted text-xs">Awaiting creator</span>

        <ReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          claim={claim}
          canPay={canPay}
          creatorLabel={creatorLabel}
          onDone={() => {
            setShowReview(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  if (claim.status === "approved") {
    return (
      <ApprovedActions claim={claim} canPay={canPay} creatorLabel={creatorLabel} />
    );
  }

  if (claim.status === "active") {
    return <span className="text-muted text-sm">Awaiting submission</span>;
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

/**
 * Standalone "Pay" button for the legacy approved-but-not-yet-paid
 * state. The Approve & Pay one-click action collapses this into a
 * single step, but some claims may sit at approved if they came
 * through the old flow or were re-issued via /admin/super/money.
 */
function ApprovedActions({
  claim,
  canPay,
  creatorLabel,
}: {
  claim: ClaimActionsProps["claim"];
  canPay: boolean;
  creatorLabel: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [paying, startPaying] = useTransition();
  const payoutsEnabled = claim.creator?.stripe_payouts_enabled ?? false;

  if (!canPay) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span
          title="Releasing funds is admin-only — ask an admin"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted bg-surface-raised border border-border rounded-lg select-none cursor-not-allowed"
        >
          Awaiting admin payout
        </span>
      </div>
    );
  }

  function handlePay() {
    startPaying(async () => {
      try {
        const result = await payClaim(claim.id);
        setPending(false);
        if (!result.ok) {
          toast.error("Payout failed", { description: result.error });
          return;
        }
        toast.success(`Paid out to ${creatorLabel}`);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Payout left in a stuck state. Check Stripe Dashboard.";
        toast.error("Payout needs reconciliation", {
          description: message,
          duration: Infinity,
        });
        setPending(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setPending(true)}
        disabled={paying || !payoutsEnabled}
        title={payoutsEnabled ? undefined : "Creator hasn't connected a payout account"}
        className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover text-background disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        {paying ? "Paying..." : "Pay"}
      </button>
      {!payoutsEnabled && (
        <span className="text-xs text-muted">No payout account</span>
      )}

      <ConfirmDialog
        open={pending}
        onClose={() => !paying && setPending(false)}
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

/**
 * Three-way review surface, opened from "Review" on submitted claims
 * or "View thread" on revision_requested claims. Shows the submission
 * (creator info, files, notes, URL) on the left side, the comment
 * thread, and a footer with Approve & Pay / Request changes / Reject
 * buttons whose availability depends on the current claim status.
 */
function ReviewModal({
  open,
  onClose,
  claim,
  canPay,
  creatorLabel,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  claim: ClaimActionsProps["claim"];
  canPay: boolean;
  creatorLabel: string;
  onDone: () => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[] | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

  const [showRevision, setShowRevision] = useState(false);
  const [revisionBody, setRevisionBody] = useState("");
  const [revisionSubmitting, startRevision] = useTransition();

  const [showReject, setShowReject] = useState(false);
  const [rejectBody, setRejectBody] = useState("");
  const [rejectSubmitting, startReject] = useTransition();

  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [paying, startPaying] = useTransition();

  const payoutsEnabled = claim.creator?.stripe_payouts_enabled ?? false;
  const isSubmitted = claim.status === "submitted";

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

  function handleApproveAndPay() {
    setShowApproveConfirm(false);
    startPaying(async () => {
      try {
        const result = await payClaim(claim.id);
        if (!result.ok) {
          toast.error("Approve & Pay failed", { description: result.error });
          return;
        }
        toast.success(`Approved + paid out to ${creatorLabel}`);
        onDone();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Payout left in a stuck state. Check Stripe Dashboard.";
        toast.error("Payout needs reconciliation", {
          description: message,
          duration: Infinity,
        });
      }
    });
  }

  function handleRequestRevision() {
    const body = revisionBody.trim();
    if (!body) {
      toast.error("Feedback is required");
      return;
    }
    startRevision(async () => {
      const result = await requestRevision(claim.id, body);
      if (!result.ok) {
        toast.error("Couldn't request changes", { description: result.error });
        return;
      }
      toast.success("Changes requested", {
        description: `${creatorLabel} will be notified.`,
      });
      setShowRevision(false);
      setRevisionBody("");
      onDone();
    });
  }

  function handleReject() {
    startReject(async () => {
      const result = await rejectClaim(claim.id, rejectBody.trim() || null);
      if (!result.ok) {
        toast.error("Couldn't reject claim", { description: result.error });
        return;
      }
      toast.success("Claim rejected");
      setShowReject(false);
      setRejectBody("");
      onDone();
    });
  }

  const busy = paying || revisionSubmitting || rejectSubmitting;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isSubmitted ? "Review submission" : "Submission thread"}
        description={claim.brief?.title}
        size="lg"
        footer={
          <>
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Close
            </button>
            {isSubmitted && (
              <>
                <button
                  onClick={() => setShowReject(true)}
                  disabled={busy}
                  className="px-4 py-2 bg-error-muted text-error hover:bg-error/25 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => setShowRevision(true)}
                  disabled={busy}
                  className="px-4 py-2 bg-warning-muted text-warning-ink hover:bg-warning/25 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  Request changes
                </button>
                {canPay ? (
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    disabled={busy || !payoutsEnabled}
                    title={
                      payoutsEnabled
                        ? undefined
                        : "Creator hasn't connected a payout account"
                    }
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {paying ? "Paying..." : "Approve & Pay"}
                  </button>
                ) : (
                  <span
                    title="Approving + paying is admin-only — ask an admin"
                    className="px-4 py-2 text-xs text-muted bg-surface-raised border border-border rounded-lg select-none cursor-not-allowed"
                  >
                    Awaiting admin
                  </span>
                )}
              </>
            )}
          </>
        }
      >
        <dl className="space-y-5">
          <div>
            <dt className="text-xs text-muted uppercase tracking-wider mb-2">
              Creator
            </dt>
            <dd>
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  url={claim.creator?.avatar_url}
                  name={claim.creator?.name}
                  email={claim.creator?.email}
                  size="md"
                  alt=""
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {claim.creator?.name || claim.creator?.email || "Unknown"}
                  </p>
                  {claim.creator?.name && claim.creator?.email && (
                    <p className="text-muted text-sm truncate">
                      {claim.creator.email}
                    </p>
                  )}
                </div>
              </div>
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

          <div>
            <dt className="text-xs text-muted uppercase tracking-wider mb-2">
              Conversation
            </dt>
            <dd>
              <ClaimCommentThread claimId={claim.id} viewerRole="org" />
            </dd>
          </div>
        </dl>
      </Modal>

      <ConfirmDialog
        open={showApproveConfirm}
        onClose={() => !paying && setShowApproveConfirm(false)}
        onConfirm={handleApproveAndPay}
        title="Approve and send payout?"
        description={`Approves the submission and immediately pays out to ${creatorLabel} via Stripe. This triggers a real transfer and cannot be reversed from the dashboard.`}
        confirmLabel="Approve & Pay"
        tone="brand"
        loading={paying}
      />

      <Modal
        open={showRevision}
        onClose={() => !revisionSubmitting && setShowRevision(false)}
        title="Request changes"
        description={`Send feedback to ${creatorLabel}. They'll be notified and can re-upload.`}
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowRevision(false)}
              disabled={revisionSubmitting}
              className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRequestRevision}
              disabled={revisionSubmitting || !revisionBody.trim()}
              className="px-4 py-2 bg-warning text-background hover:bg-warning/80 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {revisionSubmitting ? "Sending…" : "Send feedback"}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor="revision-body"
            className="block text-xs text-muted uppercase tracking-wider"
          >
            What needs to change?
          </label>
          <textarea
            id="revision-body"
            value={revisionBody}
            onChange={(e) => setRevisionBody(e.target.value)}
            rows={5}
            autoFocus
            placeholder="Be specific. Reference the asset and what to change."
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-accent focus:ring-1 focus:ring-accent resize-none"
          />
        </div>
      </Modal>

      <Modal
        open={showReject}
        onClose={() => !rejectSubmitting && setShowReject(false)}
        title="Reject this claim?"
        description={`This is terminal. ${creatorLabel} won't be able to revise. Use Request changes if revisions are possible.`}
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowReject(false)}
              disabled={rejectSubmitting}
              className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejectSubmitting}
              className="px-4 py-2 bg-error text-background hover:bg-error/80 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {rejectSubmitting ? "Rejecting…" : "Reject claim"}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <label
            htmlFor="reject-body"
            className="block text-xs text-muted uppercase tracking-wider"
          >
            Optional final note
          </label>
          <textarea
            id="reject-body"
            value={rejectBody}
            onChange={(e) => setRejectBody(e.target.value)}
            rows={3}
            placeholder="Leave blank to reject without a note."
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-accent focus:ring-1 focus:ring-accent resize-none"
          />
        </div>
      </Modal>
    </>
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
