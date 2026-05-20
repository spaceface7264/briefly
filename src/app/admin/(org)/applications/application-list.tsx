"use client";

import { useSyncExternalStore, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  XIcon,
  ChevronRightIcon,
  MailIcon,
  MapPinIcon,
  LanguagesIcon,
  SparklesIcon,
  CalendarIcon,
  MessageSquareQuoteIcon,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { SocialLinks } from "@/components/social-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { planLimitErrorMessage } from "@/lib/pricing";
import {
  countryFlag,
  countryLabel,
  languageLabel,
  skillLabel,
} from "@/lib/creator-profile";
import { relativeTimeFrom } from "@/lib/notification-center";
import { hasSocials } from "@/lib/socials";
import { reviewApplication } from "./actions";

export interface Application {
  id: string;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  applicant: {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    bio: string | null;
    country: string | null;
    languages: string[] | null;
    skills: string[] | null;
    social_handles: unknown;
  } | null;
}

export function ApplicationList({
  pending,
  reviewed,
  canDecide,
}: {
  pending: Application[];
  reviewed: Application[];
  canDecide: boolean;
}) {
  const [selected, setSelected] = useState<Application | null>(null);
  const open = selected !== null;

  function handleOpen(app: Application) {
    setSelected(app);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(null);
  }

  if (pending.length === 0 && reviewed.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
        <p className="text-base text-text-secondary">No applications yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Creators apply from your public organization page. Turn on discovery in
          Settings so they can find you.
        </p>
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="mt-4"
          render={<Link href="/admin/settings" />}
        >
          Open settings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {pending.length > 0 && (
        <section>
          <SectionHeader
            label="Pending"
            count={pending.length}
            tone="brand"
          />
          <ul className="space-y-3">
            {pending.map((app) => (
              <li key={app.id}>
                <PendingCard application={app} onOpen={() => handleOpen(app)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewed.length > 0 && (
        <section>
          <SectionHeader
            label="Reviewed"
            count={reviewed.length}
            tone="muted"
          />
          <ul className="overflow-hidden rounded-xl border border-border bg-surface">
            {reviewed.map((app, idx) => (
              <li
                key={app.id}
                className={idx > 0 ? "border-t border-border" : ""}
              >
                <ReviewedRow
                  application={app}
                  onOpen={() => handleOpen(app)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
          {selected && (
            <ApplicationSheetBody
              application={selected}
              canDecide={canDecide}
              onResolved={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "brand" | "muted";
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2
        className={`text-xs font-semibold uppercase tracking-[0.08em] ${
          tone === "brand" ? "text-foreground" : "text-muted"
        }`}
      >
        {label}
      </h2>
      <span
        className={`value-text rounded-full px-1.5 text-xs ${
          tone === "brand"
            ? "bg-brand-soft text-brand-ink"
            : "bg-surface-raised text-muted"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

function PendingCard({
  application,
  onOpen,
}: {
  application: Application;
  onOpen: () => void;
}) {
  const applicant = application.applicant;
  const flag = countryFlag(applicant?.country);
  const country = countryLabel(applicant?.country);
  const previewSkills = (applicant?.skills ?? []).slice(0, 5);
  const remainingSkills = (applicant?.skills?.length ?? 0) - previewSkills.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full rounded-xl border border-border bg-surface p-5 text-left transition-all hover:border-border-strong hover:bg-surface-hover focus-visible:border-brand-ink/40"
    >
      <div className="flex items-start gap-4">
        <Avatar
          url={applicant?.avatar_url}
          name={applicant?.name}
          email={applicant?.email}
          size="md"
          alt=""
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate font-medium text-foreground">
              {applicant?.name || applicant?.email || "Unknown applicant"}
            </p>
            {flag && (
              <span
                className="text-base leading-none"
                title={country ?? undefined}
                aria-label={country ?? undefined}
              >
                {flag}
              </span>
            )}
          </div>
          {applicant?.email && applicant?.name && (
            <p className="truncate text-sm text-muted">{applicant.email}</p>
          )}
          <p className="value-text mt-1 text-xs text-muted">
            Applied <RelativeTime iso={application.created_at} />
          </p>
        </div>
        <div className="shrink-0 self-center text-muted transition-colors group-hover:text-foreground">
          <span className="inline-flex items-center gap-1 text-sm font-medium">
            Review
            <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>

      {previewSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pl-14">
          {previewSkills.map((slug) => (
            <span
              key={slug}
              className="rounded-full bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand-ink"
            >
              {skillLabel(slug)}
            </span>
          ))}
          {remainingSkills > 0 && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium text-muted">
              +{remainingSkills} more
            </span>
          )}
        </div>
      )}

      {application.message && (
        <p className="mt-3 line-clamp-2 pl-14 text-sm italic text-text-secondary">
          &ldquo;{application.message}&rdquo;
        </p>
      )}
    </button>
  );
}

function ReviewedRow({
  application,
  onOpen,
}: {
  application: Application;
  onOpen: () => void;
}) {
  const applicant = application.applicant;
  const flag = countryFlag(applicant?.country);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
    >
      <Avatar
        url={applicant?.avatar_url}
        name={applicant?.name}
        email={applicant?.email}
        size="sm"
        alt=""
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {applicant?.name || applicant?.email || "Unknown applicant"}
          </span>
          {flag && (
            <span className="text-sm leading-none" aria-hidden="true">
              {flag}
            </span>
          )}
        </div>
        {applicant?.email && applicant?.name && (
          <span className="truncate text-xs text-muted">{applicant.email}</span>
        )}
      </div>
      <StatusPill status={application.status} />
      <span className="value-text hidden whitespace-nowrap text-xs text-muted sm:inline">
        <RelativeTime
          iso={application.reviewed_at ?? application.created_at}
        />
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}

function ApplicationSheetBody({
  application,
  canDecide,
  onResolved,
}: {
  application: Application;
  canDecide: boolean;
  onResolved: () => void;
}) {
  const router = useRouter();
  const [pendingTransition, startTransition] = useTransition();
  const [loading, setLoading] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorIsLimit, setErrorIsLimit] = useState(false);

  const applicant = application.applicant;
  const country = countryLabel(applicant?.country);
  const skills = applicant?.skills ?? [];
  const languages = (applicant?.languages ?? []).filter(Boolean);
  const isPending = application.status === "pending";

  async function handleReview(decision: "approved" | "rejected") {
    setLoading(decision);
    setError(null);
    setErrorIsLimit(false);
    const res = await reviewApplication(application.id, decision);
    if (res.ok) {
      startTransition(() => {
        router.refresh();
        onResolved();
      });
    } else {
      const limit = planLimitErrorMessage({ message: res.error });
      if (limit) {
        setError(limit);
        setErrorIsLimit(true);
      } else {
        setError(res.error);
      }
    }
    setLoading(null);
  }

  const busy = loading !== null || pendingTransition;

  return (
    <div className="flex h-full flex-col">
      <SheetTitle className="sr-only">
        Application from {applicant?.name || applicant?.email || "Unknown applicant"}
      </SheetTitle>
      <SheetDescription className="sr-only">
        Review the applicant&rsquo;s profile and decide whether to approve or
        reject their request to join.
      </SheetDescription>

      <div className="border-b border-border bg-gradient-to-b from-brand-soft to-transparent px-6 pt-8 pb-6">
        <div className="flex items-start gap-4">
          <Avatar
            url={applicant?.avatar_url}
            name={applicant?.name}
            email={applicant?.email}
            size="lg"
            alt=""
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {applicant?.name || "Unknown applicant"}
              </h2>
              <StatusPill status={application.status} />
            </div>
            {country && (
              <p className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
                <MapPinIcon className="h-3.5 w-3.5 text-muted" />
                {country}
              </p>
            )}
            {applicant?.email && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <MailIcon className="h-3.5 w-3.5" />
                <a
                  href={`mailto:${applicant.email}`}
                  className="truncate hover:text-foreground hover:underline"
                >
                  {applicant.email}
                </a>
              </p>
            )}
            {applicant && hasSocials(applicant.social_handles) && (
              <div className="mt-2">
                <SocialLinks socialHandles={applicant.social_handles} />
              </div>
            )}
          </div>
        </div>

        <p className="value-text mt-4 flex items-center gap-1 text-xs text-muted">
          <CalendarIcon className="h-3.5 w-3.5" />
          Applied {relativeTimeFrom(application.created_at)}
          {application.reviewed_at && !isPending && (
            <>
              <span aria-hidden="true">·</span>
              Reviewed {relativeTimeFrom(application.reviewed_at)}
            </>
          )}
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {applicant?.bio && (
          <SheetSection label="About">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
              {applicant.bio}
            </p>
          </SheetSection>
        )}

        {application.message && (
          <SheetSection label="Application message" icon={MessageSquareQuoteIcon}>
            <blockquote className="rounded-md border-l-2 border-brand-ink/30 bg-surface-raised/50 px-3 py-2 text-sm italic text-text-secondary whitespace-pre-wrap break-words">
              {application.message}
            </blockquote>
          </SheetSection>
        )}

        {skills.length > 0 && (
          <SheetSection label="Skills" icon={SparklesIcon}>
            <div className="flex flex-wrap gap-1.5">
              {skills.map((slug) => (
                <span
                  key={slug}
                  className="rounded-full bg-brand-muted px-2.5 py-1 text-xs font-medium text-brand-ink"
                >
                  {skillLabel(slug)}
                </span>
              ))}
            </div>
          </SheetSection>
        )}

        {languages.length > 0 && (
          <SheetSection label="Languages" icon={LanguagesIcon}>
            <div className="flex flex-wrap gap-1.5">
              {languages.map((code) => (
                <span
                  key={code}
                  className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary"
                >
                  {languageLabel(code)}
                </span>
              ))}
            </div>
          </SheetSection>
        )}

        {!applicant?.bio &&
          !application.message &&
          skills.length === 0 &&
          languages.length === 0 && (
            <p className="text-sm text-muted">
              This applicant hasn&rsquo;t filled out their profile yet.
            </p>
          )}
      </div>

      {(isPending || error) && (
        <div className="border-t border-border bg-surface px-6 py-4">
          {error && (
            <div className="mb-3 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-sm text-error-ink">
              {error}
              {errorIsLimit && (
                <>
                  {" "}
                  <Link
                    href="/admin/billing"
                    className="underline hover:no-underline"
                  >
                    Upgrade your plan →
                  </Link>
                </>
              )}
            </div>
          )}

          {isPending && canDecide && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => handleReview("rejected")}
              >
                <XIcon data-icon="inline-start" />
                {loading === "rejected" ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => handleReview("approved")}
              >
                <CheckIcon data-icon="inline-start" />
                {loading === "approved" ? "Approving..." : "Approve"}
              </Button>
            </div>
          )}

          {isPending && !canDecide && (
            <p className="text-center text-xs text-muted">
              Only org admins can approve or reject applications.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SheetSection({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </h3>
      {children}
    </section>
  );
}

const subscribeMount = () => () => {};
const getMountedClient = () => true;
const getMountedServer = () => false;

function RelativeTime({ iso }: { iso: string }) {
  // useSyncExternalStore returns the server snapshot (false) during
  // SSR + first paint and the client snapshot (true) after hydration,
  // so we can render a deterministic absolute date on the server and
  // swap to "Xh ago" on the client without a hydration mismatch
  // (relativeTimeFrom reads Date.now()).
  const mounted = useSyncExternalStore(
    subscribeMount,
    getMountedClient,
    getMountedServer
  );
  return (
    <>
      {mounted
        ? relativeTimeFrom(iso)
        : new Date(iso).toLocaleDateString("en-GB")}
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-ink">
        Pending
      </span>
    );
  }
  const isApproved = status === "approved";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        isApproved
          ? "bg-success/20 text-success-ink"
          : "bg-muted/20 text-muted"
      }`}
    >
      {isApproved ? (
        <CheckIcon className="h-3 w-3" />
      ) : (
        <XIcon className="h-3 w-3" />
      )}
      {isApproved ? "Approved" : "Rejected"}
    </span>
  );
}
