"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyToOrg } from "./actions";

interface Org {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  industry: string | null;
  accent_color: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  org: Org;
  openBriefs: number;
  isMember: boolean;
  applicationStatus: string | null;
  isAuthenticated: boolean;
  /** False for org accounts — they can browse but not apply. */
  canApply: boolean;
  onApplied: () => void;
}

type View = "detail" | "apply";

export function OrgDetailModal({
  open,
  onClose,
  org,
  openBriefs,
  isMember,
  applicationStatus,
  isAuthenticated,
  canApply,
  onApplied,
}: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>("detail");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setView("detail");
      setError(null);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) ref.current?.close();
  }

  function handleApplyClick() {
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    setView("apply");
    setError(null);
  }

  function handleSend() {
    setError(null);
    start(async () => {
      const result = await applyToOrg(org.id, message);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onApplied();
      ref.current?.close();
    });
  }

  const accent = org.accent_color || "#09D7D7";

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      aria-labelledby="org-modal-title"
      className="fixed inset-0 m-auto w-full p-4 bg-transparent backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div
        className="relative mx-auto w-full max-w-xl max-h-[calc(100dvh-2rem)] bg-surface-raised border border-border rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {view === "detail" ? (
          <DetailView
            org={org}
            openBriefs={openBriefs}
            accent={accent}
            isMember={isMember}
            applicationStatus={applicationStatus}
            isAuthenticated={isAuthenticated}
            canApply={canApply}
            onApply={handleApplyClick}
            onViewBriefs={() =>
              router.push(canApply ? "/briefs" : "/admin")
            }
          />
        ) : (
          <ApplyView
            org={org}
            accent={accent}
            message={message}
            onMessageChange={setMessage}
            error={error}
            pending={pending}
            onBack={() => setView("detail")}
            onSend={handleSend}
          />
        )}
      </div>

      <h2 id="org-modal-title" className="sr-only">
        {org.name}
      </h2>
    </dialog>
  );
}

function DetailView({
  org,
  openBriefs,
  accent,
  isMember,
  applicationStatus,
  isAuthenticated,
  canApply,
  onApply,
  onViewBriefs,
}: {
  org: Org;
  openBriefs: number;
  accent: string;
  isMember: boolean;
  applicationStatus: string | null;
  isAuthenticated: boolean;
  canApply: boolean;
  onApply: () => void;
  onViewBriefs: () => void;
}) {
  return (
    <>
      <div
        className="px-6 pt-12 pb-6 border-b border-border shrink-0"
        style={{ background: `linear-gradient(180deg, ${accent}10, transparent)` }}
      >
        <div className="flex items-center gap-4">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo_url}
              alt={org.name}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-border bg-background"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-background font-bold text-2xl shrink-0"
              style={{ backgroundColor: accent }}
            >
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-2xl font-bold truncate">{org.name}</h3>
            <p className="text-sm text-muted mt-0.5">
              {org.industry ? (
                <>
                  <span>{org.industry}</span>
                  <span className="mx-2 opacity-50">·</span>
                </>
              ) : null}
              <span className="font-mono">
                {openBriefs} open brief{openBriefs !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 overflow-y-auto">
        {org.description ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {org.description}
          </p>
        ) : (
          <p className="text-sm text-muted italic">No description yet.</p>
        )}
      </div>

      <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface/40 shrink-0">
        {isMember ? (
          <button
            onClick={onViewBriefs}
            className="px-5 py-2.5 border border-border hover:border-border-strong text-sm font-medium rounded-full transition-colors"
          >
            {canApply ? "View briefs →" : "Open dashboard →"}
          </button>
        ) : !canApply ? (
          // Org accounts can browse but not apply to other brands.
          null
        ) : applicationStatus === "pending" ? (
          <p className="text-sm text-warning-ink">
            Application pending — you&apos;ll get an email when it&apos;s reviewed.
          </p>
        ) : applicationStatus === "rejected" ? (
          <p className="text-sm text-muted">Application not accepted.</p>
        ) : (
          <button
            onClick={onApply}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-full transition-colors"
          >
            {isAuthenticated ? "Apply to join" : "Log in to apply"}
          </button>
        )}
      </footer>
    </>
  );
}

function ApplyView({
  org,
  accent,
  message,
  onMessageChange,
  error,
  pending,
  onBack,
  onSend,
}: {
  org: Org;
  accent: string;
  message: string;
  onMessageChange: (v: string) => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSend: () => void;
}) {
  return (
    <>
      <header className="flex items-center gap-3 px-6 pt-12 pb-5 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="p-1.5 -ml-1.5 text-muted hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: accent }}>
            Application
          </p>
          <h3 className="text-lg font-semibold truncate">Apply to {org.name}</h3>
        </div>
      </header>

      <div className="px-6 py-5 overflow-y-auto">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
            Tell them about you (optional)
          </span>
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={6}
            placeholder="What kind of content do you make? Why do you want to work with this org?"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent"
            autoFocus
          />
        </label>
        {error && <p className="mt-3 text-sm text-error-ink">{error}</p>}
      </div>

      <footer className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface/40 shrink-0">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSend}
          disabled={pending}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-full transition-colors disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send application"}
        </button>
      </footer>
    </>
  );
}
