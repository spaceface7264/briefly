import Link from "next/link";
import type { Brief, BriefWithClaims } from "@/types/database";
import { formatPrice, formatDeadline, categoryLabel, formatLabel } from "@/lib/utils";

interface BriefCardProps {
  brief: Brief | BriefWithClaims;
}

function hasClaimInfo(brief: Brief | BriefWithClaims): brief is BriefWithClaims {
  return "claim_count" in brief;
}

const categoryAccent: Record<string, string> = {
  entertaining: "bg-surface border-border hover:border-border-strong",
  ad: "bg-warning/5 border-warning/15 hover:border-warning/30",
  guide: "bg-info/5 border-info/15 hover:border-info/30",
  event: "bg-success/5 border-success/15 hover:border-success/30",
  community: "bg-surface border-border hover:border-border-strong",
};

const categoryDot: Record<string, string> = {
  entertaining: "bg-muted",
  ad: "bg-warning",
  guide: "bg-info",
  event: "bg-success",
  community: "bg-muted",
};

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[>\-*+]\s?/gm, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function BriefCard({ brief }: BriefCardProps) {
  const claimCount = hasClaimInfo(brief) ? brief.claim_count : 0;
  const claimLimit = brief.claim_limit || 1;
  const slotsAvailable = claimLimit - claimCount;
  const userHasClaimed = hasClaimInfo(brief) ? brief.user_has_claimed : false;
  const isFull = slotsAvailable <= 0;

  const plainDesc = stripMarkdown(brief.description);

  return (
    <Link
      href={`/briefs/${brief.id}`}
      className={[
        "group relative flex h-full flex-col rounded-lg border transition-all duration-150",
        userHasClaimed
          ? "bg-brand-soft border-brand/20 hover:border-brand/30 ring-1 ring-brand/10"
          : isFull
            ? "bg-surface/40 border-border/50 opacity-50 hover:opacity-70"
            : `${categoryAccent[brief.category] || "bg-surface border-border hover:border-border-strong"}`,
      ].join(" ")}
    >
      {/* Top section: price + meta strip */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0 text-[0.7rem] text-muted">
          <span
            aria-hidden="true"
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${categoryDot[brief.category] || "bg-muted"}`}
          />
          <span className="whitespace-nowrap">{categoryLabel(brief.category)}</span>
          <span className="text-border select-none">/</span>
          <span className="whitespace-nowrap">{formatLabel(brief.format)}</span>
          {brief.is_ad_intended && (
            <>
              <span className="text-border select-none">/</span>
              <span className="text-warning font-medium">Ad use</span>
            </>
          )}
        </div>
        <span className="value-text inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-1.5 py-px text-accent text-xs font-semibold whitespace-nowrap">
          {formatPrice(brief.price_dkk)}
        </span>
      </div>

      {/* Title */}
      <div className="px-4 pb-1.5">
        <h3 className="font-semibold text-[0.95rem] leading-snug truncate group-hover:text-foreground transition-colors">
          {brief.title}
        </h3>
      </div>

      {/* Description area grows so footer stays pinned to card bottom */}
      <div className="flex-1 px-4 pb-3">
        {plainDesc && (
          <p className="brief-card-description-truncate text-[0.75rem] text-muted leading-snug">
            {plainDesc}
          </p>
        )}
      </div>

      {/* Footer: slots + badges */}
      <div className="mt-auto flex items-center justify-between px-4 py-2.5 border-t border-border/60 text-xs">
        <div className="flex items-center gap-2">
          {brief.deadline ? (
            <span className="value-text text-muted text-[0.7rem]">
              Due {formatDeadline(brief.deadline)}
            </span>
          ) : (
            <span className="text-muted text-[0.7rem]">No due date</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {userHasClaimed ? (
            <span className="text-brand font-semibold flex items-center gap-1">
              Claimed
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          ) : isFull ? (
            <span className="text-disabled">Full</span>
          ) : (
            brief.gym ? <span className="text-muted truncate max-w-[10rem]">{brief.gym}</span> : null
          )}
        </div>
      </div>
    </Link>
  );
}
