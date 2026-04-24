"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Nav } from "@/components/nav";
import { ContentTips } from "@/components/content-tips";
import { ConfirmDialog } from "@/components/modal";
import { createClient } from "@/lib/supabase/client";
import { useTranslate } from "@/lib/i18n/provider";
import type { Brief, Claim } from "@/types/database";
import {
  formatPrice,
  formatDeadline,
  humanizeKey,
} from "@/lib/utils";

interface Props {
  brief: Brief;
  claimCount: number;
  userClaim: Claim | null;
  reclaimBlockedUntil: string | null;
  reclaimCooldownDays: number;
}

const categoryDot: Record<string, string> = {
  entertaining: "bg-brand",
  ad: "bg-warning",
  guide: "bg-info",
  event: "bg-success",
  community: "bg-brand/60",
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
}: Props) {
  const router = useRouter();
  const t = useTranslate();
  const [claiming, setClaiming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const terminalClaimStatusLabel: Partial<Record<Claim["status"], string>> = {
    submitted: t("briefDetail.underReview"),
    approved: t("briefDetail.approved"),
    paid: t("briefDetail.paid"),
  };

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
  const dueLabel = brief.deadline ? ` · ${t("briefDetail.due", { date: formatShortDate(brief.deadline) })}` : "";
  const claimStatusLabel = userClaim
    ? isActiveClaim
      ? `${t("briefDetail.claim")}${userClaim.expires_at ? ` ${t("briefDetail.until", { date: formatShortDate(userClaim.expires_at) })}` : ""}${dueLabel}`
      : `${terminalClaimStatusLabel[userClaim.status] || t("briefDetail.claim")}${dueLabel}`
    : "";

  async function handleClaim() {
    if (isReclaimBlocked && reclaimBlockedUntil) {
      setError(
        t("briefDetail.reclaimBlocked", {
          date: formatDeadline(reclaimBlockedUntil),
          days: reclaimCooldownDays,
        })
      );
      return;
    }

    setClaiming(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError(t("errors.unauthorized"));
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
      });

    if (insertError) {
      console.error("Claim error:", insertError);
      setError(t("briefDetail.claimFailed"));
      setClaiming(false);
      return;
    }

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
            {t("briefDetail.back")}
          </Link>

          {/* Header — full width, compact */}
          <header className="mb-8">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-2 text-sm">
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${categoryDot[brief.category] || "bg-muted"}`}
              />
              <span className="text-muted">{t(`categories.${brief.category}`)}</span>
              <span className="text-border">/</span>
              <span className="text-muted">{t(`durations.${brief.duration_class}`)}</span>
              {brief.gym && (
                <>
                  <span className="text-border">/</span>
                  <span className="text-muted">{brief.gym}</span>
                </>
              )}
              {hasClaim && userClaim && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                    <span
                      className={`w-1.5 h-1.5 rounded-full bg-accent ${isActiveClaim ? "animate-status-pulse" : ""}`}
                      aria-hidden="true"
                    />
                    {claimStatusLabel}
                  </span>
                </>
              )}
              {brief.is_ad_intended && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-warning font-medium">{t("briefDetail.forAds")}</span>
                </>
              )}
            </div>

            {/* Title + Price row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
                {brief.title}
              </h1>
              <div className="shrink-0 sm:text-right">
                <p className="value-text text-2xl sm:text-3xl text-accent font-bold leading-none">
                  {formatPrice(brief.price_dkk)}
                </p>
                <p className="mt-2 text-xs font-medium text-info">
                  {t("briefDetail.payoutNote")}
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
                <SectionLabel>{t("briefDetail.description")}</SectionLabel>
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

              {/* Deliverable Specs */}
              {specs && Object.keys(specs).length > 0 && (
                <section>
                  <SectionLabel>{t("briefDetail.specs")}</SectionLabel>
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
                  <SectionLabel>{t("briefDetail.usageRights")}</SectionLabel>
                  <p className="text-text-secondary text-base leading-relaxed">{brief.usage_rights}</p>
                </section>
              )}

              {/* Reference URLs */}
              {brief.reference_urls && brief.reference_urls.length > 0 && (
                <section>
                  <SectionLabel>{t("briefDetail.references")}</SectionLabel>
                  <div className="space-y-2">
                    {brief.reference_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-brand hover:text-brand-hover text-sm break-all transition-colors group/ref"
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
              <div className="lg:sticky lg:top-20 space-y-4">
                {/* Action card */}
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  {/* Availability bar */}
                  <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border">
                    <span className="text-xs text-muted uppercase tracking-wider font-medium">{t("briefDetail.slots")}</span>
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
                          {t("briefDetail.claimInfo")}
                        </p>

                        {error && (
                          <p className="text-error text-xs mb-3">{error}</p>
                        )}

                        {!showConfirm ? (
                          <button
                            onClick={() => setShowConfirm(true)}
                            className="w-full min-h-11 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold text-sm rounded-md transition-colors"
                          >
                            {t("briefDetail.claimBrief")}
                          </button>
                        ) : (
                          <div className="space-y-2.5 bg-warning/5 border border-warning/20 rounded-md p-3">
                            <p className="text-sm text-text-secondary">
                              <span className="font-medium text-warning">{t("briefDetail.claimHeadsUpTitle")}</span>{" "}
                              {t("briefDetail.claimHeadsUpBody")}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-md transition-colors"
                              >
                                {t("common.cancel")}
                              </button>
                              <button
                                onClick={handleClaim}
                                disabled={claiming}
                                className="flex-1 min-h-11 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-md transition-colors"
                              >
                                {claiming ? t("briefDetail.claiming") : t("common.confirm")}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-warning text-sm text-center py-2">
                        {isReclaimBlocked && reclaimBlockedUntil
                          ? t("briefDetail.reclaimBlocked", {
                              date: formatDeadline(reclaimBlockedUntil),
                              days: reclaimCooldownDays,
                            })
                          : brief.status !== "open"
                            ? t("briefDetail.briefNoLongerOpen")
                            : t("briefDetail.allSlotsClaimed")}
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
  const t = useTranslate();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");

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
      setError(t("briefDetail.cancelFailed"));
      setCancelling(false);
      return;
    }

    onCancelled();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionUrl.trim()) {
      setError(t("briefDetail.urlRequiredError"));
      return;
    }

    setSubmitting(true);
    setError("");

    const supabase = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("claims")
      .update({
        status: "submitted",
        submission_url: submissionUrl.trim(),
        submission_notes: submissionNotes.trim() || null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", claim.id);

    if (updateError) {
      console.error("Submit error:", updateError);
      setError(t("briefDetail.submissionError"));
      setSubmitting(false);
      return;
    }

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
        label: t("briefDetail.underReview"),
        desc: t("briefDetail.reviewDesc"),
      },
      approved: {
        icon: (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ),
        color: "text-success bg-success/10",
        label: t("briefDetail.approved"),
        desc: t("briefDetail.approvedDesc"),
      },
      paid: {
        icon: (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        ),
        color: "text-success bg-success/10",
        label: t("briefDetail.completed"),
        desc: t("briefDetail.paidDesc"),
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
        <Link
          href="/my-briefs"
          className="block w-full min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-md transition-colors text-center"
        >
          {t("briefDetail.myBriefs")}
        </Link>
      </div>
    );
  }

  // Active — can submit or cancel
  return (
    <div>
      {!showSubmitForm && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-status-pulse" />
              {t("briefDetail.claim")}
            </span>
            <span className="value-text text-muted text-sm">
              {t("briefDetail.expires", { date: formatDeadline(claim.expires_at) })}
            </span>
          </div>

          {error && (
            <p className="text-error text-xs mb-3">{error}</p>
          )}

          <div className="space-y-1.5">
            <button
              onClick={() => setShowSubmitForm(true)}
              className="w-full min-h-11 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-md transition-colors"
            >
              {t("briefDetail.submitWork")}
            </button>
            <Link
              href="/my-briefs"
              className="block w-full min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-md transition-colors text-center"
            >
              {t("briefDetail.myBriefs")}
            </Link>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full min-h-11 py-2 text-muted hover:text-error text-sm transition-colors"
            >
              {t("briefDetail.releaseClaim")}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={showCancelConfirm}
        onClose={() => !cancelling && setShowCancelConfirm(false)}
        onConfirm={handleCancel}
        title={t("briefDetail.releaseTitle")}
        description={t("briefDetail.releaseDescription", { days: reclaimCooldownDays })}
        confirmLabel={cancelling ? t("briefDetail.releasing") : t("briefDetail.releaseClaim")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        loading={cancelling}
      />

      {showSubmitForm && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="submissionUrl" className="block text-sm font-medium mb-1.5">
              {t("briefDetail.urlLabel")} <span className="text-error">*</span>
            </label>
            <input
              id="submissionUrl"
              type="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder={t("briefDetail.urlPlaceholder")}
              required
              className="w-full min-h-11 px-3 py-2 bg-background border border-border rounded-md text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="submissionNotes" className="block text-sm font-medium mb-1.5">
              {t("briefDetail.notesLabel")}
            </label>
            <textarea
              id="submissionNotes"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder={t("briefDetail.notesPlaceholder")}
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
              className="flex-1 min-h-11 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-md transition-colors"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-h-11 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-md transition-colors"
            >
              {submitting ? t("common.submitting") : t("common.submit")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SubmissionChecklist() {
  const t = useTranslate();
  const [checks, setChecks] = useState({
    hook: false,
    subtitles: false,
    length: false,
    branding: false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  const items = [
    { key: "hook" as const, label: t("contentTips.checkHook") },
    { key: "subtitles" as const, label: t("contentTips.checkSubtitles") },
    { key: "length" as const, label: t("contentTips.checkLength") },
    { key: "branding" as const, label: t("contentTips.checkBranding") },
  ];

  return (
    <div className="bg-surface-raised border border-border rounded-md p-3">
      <p className="text-xs font-medium text-muted uppercase tracking-[0.12em] mb-2">
        {t("briefDetail.checklist")}
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
          {t("briefDetail.checklistReady")}
        </p>
      )}
    </div>
  );
}
