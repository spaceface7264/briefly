"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Nav } from "@/components/nav";
import { ContentTips } from "@/components/content-tips";
import { createClient } from "@/lib/supabase/client";
import type { Brief, Claim } from "@/types/database";
import {
  formatPrice,
  formatDeadline,
  categoryLabel,
  formatLabel,
  humanizeKey,
} from "@/lib/utils";

interface Props {
  brief: Brief;
  claimCount: number;
  userClaim: Claim | null;
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

export function BriefDetailClient({ brief, claimCount, userClaim }: Props) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const claimLimit = brief.claim_limit || 1;
  const slotsAvailable = claimLimit - claimCount;
  const canClaim = brief.status === "open" && slotsAvailable > 0 && !userClaim;
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
    setClaiming(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in to claim a brief");
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
      setError("Failed to claim brief. It may be full or you already claimed it.");
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
            className="inline-flex items-center gap-1.5 text-muted hover:text-foreground text-xs font-mono mb-5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            briefs
          </Link>

          {/* Header — full width, compact */}
          <header className="mb-8">
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-2 text-xs">
              <span
                aria-hidden="true"
                className={`w-1.5 h-1.5 rounded-full ${categoryDot[brief.category] || "bg-muted"}`}
              />
              <span className="text-muted">{categoryLabel(brief.category)}</span>
              <span className="text-border">/</span>
              <span className="text-muted">{formatLabel(brief.format)}</span>
              {brief.gym && (
                <>
                  <span className="text-border">/</span>
                  <span className="text-muted">{brief.gym}</span>
                </>
              )}
              {hasClaim && userClaim && (
                <>
                  <span className="text-border">·</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
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
                  <span className="text-warning font-medium">For Ads</span>
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
                <p className="mt-2 text-[11px] font-medium text-info">
                  Payout after submission approval
                </p>
              </div>
            </div>
          </header>

          {/* Two-column content */}
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            {/* Main content */}
            <div className="space-y-6 min-w-0">
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

              {/* Deliverable Specs */}
              {specs && Object.keys(specs).length > 0 && (
                <section>
                  <SectionLabel>Specs</SectionLabel>
                  <div className="grid gap-px bg-border rounded-lg overflow-hidden border border-border">
                    {Object.entries(specs).map(([key, value]) => (
                      <div key={key} className="flex items-baseline gap-4 bg-surface px-4 py-2.5">
                        <dt className="text-muted text-xs w-32 shrink-0">
                          {humanizeKey(key)}
                        </dt>
                        <dd className="font-mono text-sm text-foreground">{value}</dd>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Usage Rights */}
              {brief.usage_rights && (
                <section>
                  <SectionLabel>Usage Rights</SectionLabel>
                  <p className="text-text-secondary text-sm leading-relaxed">{brief.usage_rights}</p>
                </section>
              )}

              {/* Reference URLs */}
              {brief.reference_urls && brief.reference_urls.length > 0 && (
                <section>
                  <SectionLabel>References</SectionLabel>
                  <div className="space-y-1.5">
                    {brief.reference_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-brand hover:text-brand-hover text-xs font-mono break-all transition-colors group/ref"
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
            <aside className="space-y-3">
              <div className="sticky top-20 space-y-3">
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
                        onCancelled={() => router.refresh()}
                      />
                    ) : canClaim ? (
                      <>
                        <p className="text-text-secondary text-xs mb-4 leading-relaxed">
                          Claim to reserve a slot for 7 days.
                        </p>

                        {error && (
                          <p className="text-error text-xs mb-3">{error}</p>
                        )}

                        {!showConfirm ? (
                          <button
                            onClick={() => setShowConfirm(true)}
                            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold text-sm rounded-md transition-colors"
                          >
                            Claim Brief
                          </button>
                        ) : (
                          <div className="space-y-2.5 bg-warning/5 border border-warning/20 rounded-md p-3">
                            <p className="text-xs text-text-secondary">
                              <span className="font-medium text-warning">Heads up:</span>{" "}
                              reserves for 7 days. Release anytime.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-2 border border-border hover:bg-surface-hover text-xs font-medium rounded-md transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleClaim}
                                disabled={claiming}
                                className="flex-1 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-xs font-semibold rounded-md transition-colors"
                              >
                                {claiming ? "Claiming..." : "Confirm"}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-warning text-xs text-center py-2">
                        {brief.status !== "open"
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
    <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
      {children}
    </h2>
  );
}

function ClaimedState({ claim, onCancelled }: { claim: Claim; onCancelled: () => void }) {
  const router = useRouter();
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
      setError("Failed to cancel claim");
      setCancelling(false);
      return;
    }

    onCancelled();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionUrl.trim()) {
      setError("Please enter a submission URL");
      return;
    }

    setSubmitting(true);
    setError("");

    const supabase = createClient();

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
      setError("Failed to submit");
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
        <p className="text-muted text-xs mb-3">{stateConfig.desc}</p>
        <Link
          href="/my-briefs"
          className="block w-full py-2 border border-border hover:bg-surface-hover text-xs font-medium rounded-md transition-colors text-center"
        >
          My Briefs
        </Link>
      </div>
    );
  }

  // Active — can submit or cancel
  return (
    <div>
      {!showSubmitForm && !showCancelConfirm && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-status-pulse" />
              Claimed
            </span>
            <span className="value-text text-muted text-xs">
              exp {formatDeadline(claim.expires_at)}
            </span>
          </div>

          {error && (
            <p className="text-error text-xs mb-3">{error}</p>
          )}

          <div className="space-y-1.5">
            <button
              onClick={() => setShowSubmitForm(true)}
              className="w-full py-2 bg-accent hover:bg-accent-hover text-background text-xs font-semibold rounded-md transition-colors"
            >
              Submit work
            </button>
            <Link
              href="/my-briefs"
              className="block w-full py-2 border border-border hover:bg-surface-hover text-xs font-medium rounded-md transition-colors text-center"
            >
              My Briefs
            </Link>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-1.5 text-muted hover:text-error text-xs transition-colors"
            >
              Release claim
            </button>
          </div>
        </>
      )}

      {showSubmitForm && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="submissionUrl" className="block text-xs font-medium mb-1.5">
              URL <span className="text-error">*</span>
            </label>
            <input
              id="submissionUrl"
              type="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://instagram.com/reel/..."
              required
              className="w-full px-2.5 py-2 bg-background border border-border rounded-md text-xs focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="submissionNotes" className="block text-xs font-medium mb-1.5">
              Notes
            </label>
            <textarea
              id="submissionNotes"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Optional context..."
              rows={2}
              className="w-full px-2.5 py-2 bg-background border border-border rounded-md text-xs focus:border-accent focus:ring-1 focus:ring-accent resize-none"
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
              className="flex-1 py-2 border border-border hover:bg-surface-hover text-xs font-medium rounded-md transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-xs font-semibold rounded-md transition-colors"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      )}

      {showCancelConfirm && (
        <div className="space-y-2.5 bg-error/5 border border-error/20 rounded-md p-3">
          <p className="text-xs">
            <span className="font-medium text-error">Release?</span>{" "}
            Slot opens for others.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 py-2 border border-border hover:bg-surface-hover text-xs font-medium rounded-md transition-colors"
            >
              Keep
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 py-2 bg-error hover:bg-error/80 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors"
            >
              {cancelling ? "Releasing..." : "Release"}
            </button>
          </div>
        </div>
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
    { key: "hook" as const, label: "Stærk hook i første 2-3 sek" },
    { key: "subtitles" as const, label: "Undertekster tilføjet (centreret)" },
    { key: "length" as const, label: "Passende længde (8-30 sek)" },
    { key: "branding" as const, label: "Boulders branding synlig" },
  ];

  return (
    <div className="bg-surface-raised border border-border rounded-md p-3">
      <p className="text-[0.65rem] font-medium text-muted uppercase tracking-wider mb-2">
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
            <span className="text-[0.7rem] text-text-secondary leading-tight">
              {item.label}
            </span>
          </label>
        ))}
      </div>
      {allChecked && (
        <p className="text-[0.65rem] text-success mt-2 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Klar til at indsende!
        </p>
      )}
    </div>
  );
}
