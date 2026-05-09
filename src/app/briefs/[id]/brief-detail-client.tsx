"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { useOrgId } from "@/lib/org-context";
import ReactMarkdown from "react-markdown";
import { Nav } from "@/components/nav";
import { ContentTips } from "@/components/content-tips";
import { ConfirmDialog, Modal } from "@/components/modal";
import { createClient } from "@/lib/supabase/client";
import {
  prepareSubmissionUploads,
  confirmSubmission,
  getClaimAttachmentSignedUrls,
} from "./actions";
import { BrandKitPanel, type BrandKitPanelData } from "./brand-kit-panel";
import type { Brief, Claim } from "@/types/database";

type SubmissionAttachment = {
  id: string;
  filename: string;
  mime_type: string;
  file_size: number;
  signed_url: string;
};

const SUBMISSIONS_BUCKET = "submissions";

// 50 MB while on the Supabase Free tier (project-wide cap binds
// below the bucket's 250 MB). Bump to 250 with the matching constant
// in actions.ts when the project moves to Pro.
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
import {
  formatPrice,
  formatDeadline,
  categoryLabel,
  durationClassLabel,
  humanizeKey,
} from "@/lib/utils";

interface Props {
  brief: Brief;
  claimCount: number;
  userClaim: Claim | null;
  reclaimBlockedUntil: string | null;
  reclaimCooldownDays: number;
  /** Present only when the viewer has an active claim on this brief.
   *  The server-side gate in page.tsx decides; we just render. */
  brandKit: BrandKitPanelData | null;
}

const categoryDot: Record<string, string> = {
  entertaining: "bg-brand",
  ad: "bg-warning",
  guide: "bg-info",
  event: "bg-success",
  community: "bg-brand/60",
};

const terminalClaimStatusLabel: Partial<Record<Claim["status"], string>> = {
  submitted: "Under review",
  approved: "Approved",
  paid: "Paid",
};

function formatShortDate(date: string | null | undefined) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function BriefDetailClient({
  brief,
  claimCount,
  userClaim,
  reclaimBlockedUntil,
  reclaimCooldownDays,
  brandKit,
}: Props) {
  const router = useRouter();
  const orgId = useOrgId();
  const [claiming, setClaiming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const claimLimit = brief.claim_limit || 1;
  const slotsAvailable = claimLimit - claimCount;
  const isReclaimBlocked = Boolean(
    reclaimBlockedUntil && new Date(reclaimBlockedUntil) > new Date()
  );
  const canClaim =
    brief.status === "open" &&
    slotsAvailable > 0 &&
    !userClaim &&
    !isReclaimBlocked;
  const hasClaim = Boolean(userClaim);
  const isActiveClaim = Boolean(
    userClaim &&
      userClaim.status !== "submitted" &&
      userClaim.status !== "approved" &&
      userClaim.status !== "paid" &&
      userClaim.status !== "cancelled"
  );
  const dueLabel = brief.deadline ? ` · Due ${formatShortDate(brief.deadline)}` : "";
  const claimStatusLabel = userClaim
    ? isActiveClaim
      ? `Claimed${userClaim.expires_at ? ` until ${formatShortDate(userClaim.expires_at)}` : ""}${dueLabel}`
      : `${terminalClaimStatusLabel[userClaim.status] || "Claimed"}${dueLabel}`
    : "";

  async function handleClaim() {
    if (isReclaimBlocked && reclaimBlockedUntil) {
      toast.error("Cooldown active", {
        description: `You can reclaim this brief after ${formatDeadline(reclaimBlockedUntil)} (${reclaimCooldownDays} day cooldown).`,
      });
      return;
    }

    setClaiming(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Sign in required", {
        description: "You must be logged in to claim a brief.",
      });
      setClaiming(false);
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase
      .from("claims") as any)
      .insert({
        brief_id: brief.id,
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
        org_id: orgId,
      });

    if (insertError) {
      console.error("Claim error:", insertError);
      toast.error("Couldn't claim brief", {
        description:
          "It may be full or you already claimed it. Refresh and try again.",
      });
      setClaiming(false);
      return;
    }

    const trimmed = brief.title?.trim() ?? "";
    const displayTitle =
      trimmed.length > 80 ? `${trimmed.slice(0, 79)}…` : trimmed;
    toast.success(
      "Brief claimed",
      displayTitle ? { description: displayTitle } : undefined
    );
    router.push("/my-briefs");
    router.refresh();
  }

  const specs = brief.deliverable_specs as Record<string, string>;

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-12">
          {/* Breadcrumb */}
          <Link
            href="/briefs"
            className="inline-flex items-center gap-1.5 text-muted hover:text-foreground text-sm mb-5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            briefs
          </Link>

          {/* Header — full width, compact */}
          <header className="mb-8">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${categoryDot[brief.category] || "bg-muted"}`}
              />
              <span className="text-muted">{categoryLabel(brief.category)}</span>
              <span className="text-border">/</span>
              <span className="text-muted">{durationClassLabel(brief.duration_class)}</span>
              {brief.location && (
                <>
                  <span className="text-border">/</span>
                  <span className="text-muted">{brief.location}</span>
                </>
              )}
              {hasClaim && userClaim && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-ink/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-ink">
                    <span
                      className={`w-1.5 h-1.5 rounded-full bg-accent-ink ${isActiveClaim ? "animate-status-pulse" : ""}`}
                      aria-hidden="true"
                    />
                    {claimStatusLabel}
                  </span>
                </>
              )}
              {brief.is_ad_intended && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-warning-ink font-medium">For Ads</span>
                </>
              )}
            </div>

            {/* Title + Price row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-6">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {brief.title}
              </h1>
              <div className="shrink-0 sm:text-right">
                <p className="value-text text-2xl sm:text-3xl text-accent-ink font-bold leading-none">
                  {formatPrice(brief.price_dkk)}
                </p>
                <p className="mt-2 text-xs font-medium text-info">
                  Payout after submission approval
                </p>
              </div>
            </div>
          </header>

          {/* Two-column content */}
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            {/* Main content */}
            <div className="space-y-8 min-w-0">
              {/* Description */}
              <section>
                <SectionLabel>Description</SectionLabel>
                <div className="prose-brief">
                  <ReactMarkdown
                    components={{
                      a: ({ children, href, ...props }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                      ),
                    }}
                  >
                    {brief.description}
                  </ReactMarkdown>
                </div>
              </section>

              {/* Brand kit (claimed creators only). Server-side gate
                  in page.tsx decides whether to fetch + sign URLs;
                  brandKit is null when the viewer has no live claim. */}
              {brandKit && <BrandKitPanel brandKit={brandKit} />}

              {/* Deliverable Specs */}
              {specs && Object.keys(specs).length > 0 && (
                <section>
                  <SectionLabel>Specs</SectionLabel>
                  <div className="grid gap-px bg-border rounded-lg overflow-hidden border border-border">
                    {Object.entries(specs).map(([key, value]) => (
                      <div key={key} className="flex items-baseline gap-4 bg-surface px-4 py-3">
                        <dt className="text-muted text-sm w-32 shrink-0">
                          {humanizeKey(key)}
                        </dt>
                        <dd className="text-base text-foreground">{value}</dd>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Usage Rights */}
              {brief.usage_rights && (
                <section>
                  <SectionLabel>Usage Rights</SectionLabel>
                  <p className="text-text-secondary text-base leading-relaxed">{brief.usage_rights}</p>
                </section>
              )}

              {/* Reference URLs */}
              {brief.reference_urls && brief.reference_urls.length > 0 && (
                <section>
                  <SectionLabel>References</SectionLabel>
                  <div className="space-y-2">
                    {brief.reference_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-brand-ink hover:text-brand-hover text-sm break-all transition-colors group/ref"
                      >
                        <svg className="w-3 h-3 shrink-0 opacity-40 group-hover/ref:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {url}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4">
              <div className="sticky top-20 space-y-4">
                {/* Action card */}
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  {/* Availability bar */}
                  <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
                    <span className="text-xs text-muted uppercase tracking-wider font-medium">Slots</span>
                    <span className="value-text text-sm">
                      <span className={slotsAvailable > 0 ? "text-foreground" : "text-warning"}>
                        {slotsAvailable}
                      </span>
                      <span className="text-muted">/{claimLimit}</span>
                    </span>
                  </div>

                  {/* Action area */}
                  <div className="p-4">
                    {userClaim ? (
                      <ClaimedState
                        claim={userClaim}
                        reclaimCooldownDays={reclaimCooldownDays}
                        onCancelled={() => router.refresh()}
                      />
                    ) : canClaim ? (
                      <>
                        <p className="text-text-secondary text-xs mb-4 leading-relaxed">
                          Claim to reserve a slot for 7 days.
                        </p>

                        {!showConfirm ? (
                          <button
                            onClick={() => setShowConfirm(true)}
                            className="w-full min-h-11 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold text-sm rounded-full transition-colors"
                          >
                            Claim Brief
                          </button>
                        ) : (
                          <div className="space-y-2.5 bg-warning/5 border border-warning/20 rounded-md p-3">
                            <p className="text-sm text-text-secondary">
                              <span className="font-medium text-warning-ink">Heads up:</span>{" "}
                              reserves for 7 days. Release anytime.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-full transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleClaim}
                                disabled={claiming}
                                className="flex-1 min-h-11 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-full transition-colors"
                              >
                                {claiming ? "Claiming..." : "Confirm"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-warning-ink text-sm text-center py-2">
                        {isReclaimBlocked && reclaimBlockedUntil
                          ? `Reclaim available ${formatDeadline(reclaimBlockedUntil)} (${reclaimCooldownDays} day cooldown after release)`
                          : brief.status !== "open"
                            ? "Brief is no longer open"
                            : "All slots claimed"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Content Tips */}
                <ContentTips category={brief.category} isAdIntended={brief.is_ad_intended} />
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted uppercase tracking-[0.12em] mb-3">
      {children}
    </h2>
  );
}

function ClaimedState({
  claim,
  reclaimCooldownDays,
  onCancelled,
}: {
  claim: Claim;
  reclaimCooldownDays: number;
  onCancelled: () => void;
}) {
  const router = useRouter();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [showSubmission, setShowSubmission] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    setError("");
    const incoming = Array.from(newFiles);
    const combined = [...files, ...incoming];
    if (combined.length > MAX_ATTACHMENTS) {
      setError(`Max ${MAX_ATTACHMENTS} files per submission`);
      return;
    }
    for (const f of incoming) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name} exceeds the 50 MB limit`);
        return;
      }
      if (!ALLOWED_MIME.has(f.type)) {
        setError(`${f.name}: file type "${f.type}" is not allowed`);
        return;
      }
    }
    setFiles(combined);
  }

  function removeFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  async function handleCancel() {
    setCancelling(true);
    setError("");

    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("claims")
      .update({ status: "cancelled" })
      .eq("id", claim.id);

    if (updateError) {
      console.error("Cancel error:", updateError);
      setError("Failed to cancel claim");
      toast.error("Couldn't release claim", {
        description: "Please try again.",
      });
      setCancelling(false);
      return;
    }

    toast.success("Claim released");
    onCancelled();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUrl = submissionUrl.trim();
    if (!trimmedUrl && files.length === 0) {
      setError("Add a URL or at least one file to submit");
      return;
    }

    setSubmitting(true);
    setError("");

    // Two-step flow: ask the server for signed upload URLs, push the
    // file bytes directly to Supabase Storage from the browser, then
    // call back to record the attachments and flip the claim. This
    // avoids both the Next server-action body limit and the
    // Cloudflare Workers request size limit on the prod deploy
    // target.
    const fileSpecs = files.map((f) => ({
      filename: f.name,
      mime_type: f.type,
      file_size: f.size,
    }));

    const prep = await prepareSubmissionUploads(claim.id, fileSpecs);
    if (!prep.ok) {
      setError(prep.error);
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    try {
      await Promise.all(
        files.map(async (file, i) => {
          const upload = prep.uploads[i];
          const { error: uploadErr } = await supabase.storage
            .from(SUBMISSIONS_BUCKET)
            .uploadToSignedUrl(upload.storage_path, upload.token, file, {
              contentType: file.type,
              upsert: false,
            });
          if (uploadErr) {
            throw new Error(`Upload failed for ${file.name}: ${uploadErr.message}`);
          }
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setSubmitting(false);
      return;
    }

    const attachments = files.map((f, i) => ({
      storage_path: prep.uploads[i].storage_path,
      filename: f.name,
      mime_type: f.type,
      file_size: f.size,
    }));

    const result = await confirmSubmission(
      claim.id,
      trimmedUrl || null,
      submissionNotes.trim() || null,
      attachments
    );
    if (!result.ok) {
      setError(result.error);
      toast.error("Submission failed", { description: result.error });
      setSubmitting(false);
      return;
    }

    toast.success("Submission sent", {
      description: "We'll email you when the org reviews it.",
    });
    router.refresh();
  }

  // Completed states
  if (claim.status === "submitted" || claim.status === "approved" || claim.status === "paid") {
    const stateConfig = {
      submitted: {
        icon: (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        ),
        color: "text-info bg-info/10",
        label: "Under review",
        desc: "We'll email you when reviewed.",
      },
      approved: {
        icon: (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ),
        color: "text-success bg-success/10",
        label: "Approved",
        desc: "Payment is on its way.",
      },
      paid: {
        icon: (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        ),
        color: "text-success bg-success/10",
        label: "Completed",
        desc: "Payment sent.",
      },
    }[claim.status]!;

    return (
      <div className="text-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${stateConfig.color}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {stateConfig.icon}
          </svg>
        </div>
        <p className="font-semibold text-sm mb-0.5">{stateConfig.label}</p>
        <p className="text-muted text-sm mb-3">{stateConfig.desc}</p>
        <button
          onClick={() => setShowSubmission(true)}
          className="block w-full min-h-11 py-2 mb-1.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-full transition-colors"
        >
          View your submission
        </button>
        <Link
          href="/my-briefs"
          className="block w-full min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-full transition-colors text-center"
        >
          My Briefs
        </Link>

        <MySubmissionModal
          open={showSubmission}
          onClose={() => setShowSubmission(false)}
          claim={claim}
        />
      </div>
    );
  }

  // Active — can submit or cancel
  return (
    <div>
      {!showSubmitForm && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-ink">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-ink animate-status-pulse" />
              Claimed
            </span>
            <span className="value-text font-mono text-muted text-sm">
              exp {formatDeadline(claim.expires_at)}
            </span>
          </div>

          {error && (
            <p className="text-error text-xs mb-3">{error}</p>
          )}

          <div className="space-y-1.5">
            <button
              onClick={() => setShowSubmitForm(true)}
              className="w-full min-h-11 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-full transition-colors"
            >
              Submit work
            </button>
            <Link
              href="/my-briefs"
              className="block w-full min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-full transition-colors text-center"
            >
              My Briefs
            </Link>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full min-h-11 py-2 text-muted hover:text-error text-sm transition-colors"
            >
              Release claim
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => !cancelling && setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title="Release claim?"
        description={`Your slot will open for other creators. You can reclaim this brief again after ${reclaimCooldownDays} days.`}
        confirmLabel={cancelling ? "Releasing..." : "Release claim"}
        cancelLabel="Cancel"
        tone="danger"
        loading={cancelling}
      />

      {showSubmitForm && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="submissionUrl" className="block text-sm font-medium mb-1.5">
              URL
            </label>
            <input
              id="submissionUrl"
              type="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://instagram.com/reel/..."
              className="w-full min-h-11 px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <p className="text-xs text-muted mt-1">
              Optional if you upload files below.
            </p>
          </div>

          <div>
            <label htmlFor="submissionFiles" className="block text-sm font-medium mb-1.5">
              Files
            </label>
            <input
              id="submissionFiles"
              type="file"
              multiple
              accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp,image/heic,image/heif,application/pdf"
              onChange={(e) => addFiles(e.target.files)}
              className="block w-full text-xs text-muted file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-surface-raised file:text-foreground hover:file:bg-surface-hover file:cursor-pointer"
            />
            <p className="text-xs text-muted mt-1">
              Up to {MAX_ATTACHMENTS} files, 50 MB each.
              Video, image, or PDF.
            </p>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs bg-surface-raised border border-border rounded px-2 py-1.5"
                  >
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-muted shrink-0">{formatBytes(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted hover:text-error shrink-0"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="submissionNotes" className="block text-sm font-medium mb-1.5">
              Notes
            </label>
            <textarea
              id="submissionNotes"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Optional context..."
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-accent focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          <SubmissionChecklist />

          {error && (
            <p className="text-error text-xs">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSubmitForm(false)}
              className="flex-1 min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-full transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-11 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-full transition-colors"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SubmissionChecklist() {
  const [checks, setChecks] = useState({
    hook: false,
    subtitles: false,
    length: false,
    branding: false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  const items = [
    { key: "hook" as const, label: "Strong hook in first 2-3 sec" },
    { key: "subtitles" as const, label: "Captions added (centered)" },
    { key: "length" as const, label: "Appropriate length (8-30 sec)" },
    { key: "branding" as const, label: "Brand clearly visible" },
  ];

  return (
    <div className="bg-surface-raised border border-border rounded-md p-3">
      <p className="text-xs font-medium text-muted uppercase tracking-[0.12em] mb-2">
        Checklist
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <label key={item.key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checks[item.key]}
              onChange={(e) => setChecks({ ...checks, [item.key]: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-border bg-surface text-accent focus:ring-accent focus:ring-offset-0"
            />
            <span className="text-xs text-text-secondary leading-tight">
              {item.label}
            </span>
          </label>
        ))}
      </div>
      {allChecked && (
        <p className="text-xs text-success mt-2 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Klar til at indsende!
        </p>
      )}
    </div>
  );
}

function MySubmissionModal({
  open,
  onClose,
  claim,
}: {
  open: boolean;
  onClose: () => void;
  claim: Claim;
}) {
  const [attachments, setAttachments] = useState<SubmissionAttachment[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch on every open. Signed URLs have a short server-side TTL,
  // so caching would just serve stale links.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setAttachments(null);
    (async () => {
      const result = await getClaimAttachmentSignedUrls(claim.id);
      if (result.ok) {
        setAttachments(result.attachments);
      } else {
        setError(result.error);
      }
      setLoading(false);
    })();
  }, [open, claim.id]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your submission"
      size="lg"
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 border border-border-strong hover:bg-surface-hover text-sm font-medium rounded-full transition-colors"
        >
          Close
        </button>
      }
    >
      <dl className="space-y-5 text-left">
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
                className="inline-flex items-center gap-1.5 text-accent-ink hover:underline break-all font-mono text-sm"
              >
                {claim.submission_url}
                <svg
                  className="w-3.5 h-3.5 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
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
            {loading && <p className="text-sm text-muted">Loading…</p>}
            {error && <p className="text-sm text-error">{error}</p>}
            {attachments && attachments.length === 0 && (
              <p className="text-sm text-muted">No files uploaded.</p>
            )}
            {attachments && attachments.length > 0 && (
              <ul className="space-y-3">
                {attachments.map((att) => (
                  <SubmissionAttachmentPreview key={att.id} attachment={att} />
                ))}
              </ul>
            )}
          </dd>
        </div>

        {claim.submission_notes && (
          <div>
            <dt className="text-xs text-muted uppercase tracking-wider mb-1">
              Your notes
            </dt>
            <dd className="bg-surface border border-border rounded-lg p-3 text-sm whitespace-pre-wrap">
              {claim.submission_notes}
            </dd>
          </div>
        )}

        {!claim.submission_url &&
          !claim.submission_notes &&
          attachments &&
          attachments.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              Nothing was attached to this submission.
            </p>
          )}
      </dl>
    </Modal>
  );
}

function SubmissionAttachmentPreview({
  attachment,
}: {
  attachment: SubmissionAttachment;
}) {
  const isImage = attachment.mime_type.startsWith("image/");
  const isVideo = attachment.mime_type.startsWith("video/");

  return (
    <li className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border">
        <span className="text-sm font-medium truncate">
          {attachment.filename}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted">
            {formatBytes(attachment.file_size)}
          </span>
          <a
            href={attachment.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-ink hover:underline"
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
