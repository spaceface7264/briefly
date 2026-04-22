"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/client";
import type { Brief, Claim } from "@/types/database";
import {
  formatPrice,
  formatDeadline,
  categoryLabel,
  formatLabel,
} from "@/lib/utils";

interface Props {
  brief: Brief;
  claimCount: number;
  userClaim: Claim | null;
}

export function BriefDetailClient({ brief, claimCount, userClaim }: Props) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const claimLimit = brief.claim_limit || 1;
  const slotsAvailable = claimLimit - claimCount;
  const canClaim = brief.status === "open" && slotsAvailable > 0 && !userClaim;

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
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

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
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back link */}
          <Link
            href="/briefs"
            className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to briefs
          </Link>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-3">{brief.title}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 bg-accent-muted text-accent text-sm font-medium rounded-full">
                  {categoryLabel(brief.category)}
                </span>
                <span className="px-3 py-1.5 bg-border text-muted text-sm font-mono rounded-full">
                  {formatLabel(brief.format)}
                </span>
                {brief.gym && (
                  <span className="px-3 py-1.5 bg-border text-muted text-sm rounded-full">
                    {brief.gym}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl text-accent font-bold">
                {formatPrice(brief.price_dkk)}
              </p>
              {brief.deadline && (
                <p className="text-muted text-sm mt-1 font-mono">
                  Due: {formatDeadline(brief.deadline)}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              {/* Description */}
              <section>
                <h2 className="text-lg font-semibold mb-3">Description</h2>
                <p className="text-muted leading-relaxed">{brief.description}</p>
              </section>

              {/* Deliverable Specs */}
              {Object.keys(specs).length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">
                    Deliverable Specs
                  </h2>
                  <div className="bg-surface border border-border rounded-lg p-4">
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {Object.entries(specs).map(([key, value]) => (
                        <div key={key}>
                          <dt className="text-muted text-sm capitalize">
                            {key.replace(/_/g, " ")}
                          </dt>
                          <dd className="font-mono text-sm">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </section>
              )}

              {/* Usage Rights */}
              {brief.usage_rights && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">Usage Rights</h2>
                  <p className="text-muted">{brief.usage_rights}</p>
                </section>
              )}

              {/* Reference URLs */}
              {brief.reference_urls && brief.reference_urls.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold mb-3">References</h2>
                  <ul className="space-y-2">
                    {brief.reference_urls.map((url, i) => (
                      <li key={i}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline text-sm font-mono break-all"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-8 bg-surface border border-border rounded-xl p-6">
                {/* Slots info */}
                <div className="mb-4 pb-4 border-b border-border">
                  <p className="text-sm text-muted mb-1">Availability</p>
                  <p className="font-mono text-lg">
                    <span className={slotsAvailable > 0 ? "text-foreground" : "text-warning"}>
                      {slotsAvailable}
                    </span>
                    {" "}of {claimLimit} slot{claimLimit !== 1 ? "s" : ""} available
                  </p>
                </div>

                {userClaim ? (
                  <ClaimedState
                    claim={userClaim}
                    onCancelled={() => router.refresh()}
                  />
                ) : canClaim ? (
                  <>
                    <h3 className="font-semibold mb-4">Claim this brief</h3>
                    <p className="text-muted text-sm mb-6">
                      Once claimed, you have 7 days to submit your deliverables. The
                      slot will be reserved exclusively for you during this time.
                    </p>

                    {error && (
                      <p className="text-error text-sm mb-4">{error}</p>
                    )}

                    {!showConfirm ? (
                      <button
                        onClick={() => setShowConfirm(true)}
                        className="w-full py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
                      >
                        Claim Brief
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-warning">
                          Are you sure? This will reserve a slot for 7 days.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowConfirm(false)}
                            className="flex-1 py-2.5 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleClaim}
                            disabled={claiming}
                            className="flex-1 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
                          >
                            {claiming ? "Claiming..." : "Confirm"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-warning">
                      {brief.status !== "open"
                        ? "This brief is no longer open"
                        : "All slots have been claimed"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
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

  // Already submitted
  if (claim.status === "submitted") {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-warning/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-warning font-medium mb-2">Under Review</p>
        <p className="text-muted text-sm mb-4">
          Your submission is being reviewed by the team
        </p>
        <Link
          href="/my-briefs"
          className="block w-full py-2.5 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors text-center"
        >
          View in My Briefs
        </Link>
      </div>
    );
  }

  // Approved
  if (claim.status === "approved") {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-success font-medium mb-2">Approved</p>
        <p className="text-muted text-sm mb-4">
          Your submission has been approved. Payment coming soon.
        </p>
        <Link
          href="/my-briefs"
          className="block w-full py-2.5 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors text-center"
        >
          View in My Briefs
        </Link>
      </div>
    );
  }

  // Paid
  if (claim.status === "paid") {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-success font-medium mb-2">Completed</p>
        <p className="text-muted text-sm">Payment has been sent</p>
      </div>
    );
  }

  // Active - can submit or cancel
  return (
    <div>
      {!showSubmitForm && !showCancelConfirm && (
        <>
          <p className="text-accent font-medium mb-2 text-center">You claimed this brief</p>
          <p className="text-muted text-sm mb-4 text-center">
            Expires: {formatDeadline(claim.expires_at)}
          </p>

          {error && (
            <p className="text-error text-sm mb-4 text-center">{error}</p>
          )}

          <div className="space-y-3">
            <button
              onClick={() => setShowSubmitForm(true)}
              className="w-full py-2.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
            >
              Submit Work
            </button>
            <Link
              href="/my-briefs"
              className="block w-full py-2.5 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors text-center"
            >
              View in My Briefs
            </Link>
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-2.5 text-muted hover:text-error text-sm transition-colors"
            >
              Cancel Claim
            </button>
          </div>
        </>
      )}

      {showSubmitForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="submissionUrl" className="block text-sm font-medium mb-2">
              Submission URL <span className="text-error">*</span>
            </label>
            <input
              id="submissionUrl"
              type="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://instagram.com/reel/..."
              required
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="submissionNotes" className="block text-sm font-medium mb-2">
              Notes (optional)
            </label>
            <textarea
              id="submissionNotes"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
              placeholder="Any additional context..."
              rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:border-accent focus:ring-1 focus:ring-accent resize-none"
            />
          </div>

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSubmitForm(false)}
              className="flex-1 py-2.5 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      )}

      {showCancelConfirm && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-warning">
            Are you sure you want to release this brief?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCancelConfirm(false)}
              className="flex-1 py-2.5 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
            >
              Keep
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 py-2.5 bg-error hover:bg-error/80 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {cancelling ? "Cancelling..." : "Release"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
