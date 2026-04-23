import Link from "next/link";
import type { Brief, BriefWithClaims } from "@/types/database";
import { formatPrice, formatDeadline, categoryLabel, formatLabel } from "@/lib/utils";
import { StatusPill } from "./status-pill";

interface BriefCardProps {
  brief: Brief | BriefWithClaims;
}

function hasClaimInfo(brief: Brief | BriefWithClaims): brief is BriefWithClaims {
  return "claim_count" in brief;
}

export function BriefCard({ brief }: BriefCardProps) {
  const claimCount = hasClaimInfo(brief) ? brief.claim_count : 0;
  const claimLimit = brief.claim_limit || 1;
  const slotsAvailable = claimLimit - claimCount;
  const userHasClaimed = hasClaimInfo(brief) ? brief.user_has_claimed : false;
  const isFull = slotsAvailable <= 0;

  const containerClasses = [
    "relative block rounded-xl p-5 transition-all",
    userHasClaimed
      ? "bg-info-muted/30 border border-info/40 hover:border-info"
      : isFull
        ? "bg-surface/60 border border-border hover:border-border-strong opacity-75"
        : "bg-surface border border-border hover:border-accent/60 hover:bg-surface-hover",
    "group",
  ].join(" ");

  return (
    <Link href={`/briefs/${brief.id}`} className={containerClasses}>
      {userHasClaimed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-4 bottom-4 w-0.5 bg-info rounded-r"
        />
      )}

      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {userHasClaimed && (
              <StatusPill tone="info" pulse>
                Claimed by you
              </StatusPill>
            )}
            {brief.is_ad_intended && (
              <StatusPill tone="warning" dot={false}>
                For Ads
              </StatusPill>
            )}
          </div>
          <h3 className="font-semibold text-lg group-hover:text-accent transition-colors line-clamp-2">
            {brief.title}
          </h3>
        </div>
        <span className="font-mono text-accent text-lg whitespace-nowrap">
          {formatPrice(brief.price_dkk)}
        </span>
      </div>

      <p className="text-muted text-sm line-clamp-2 mb-4">{brief.description}</p>

      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <span className="px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full">
          {categoryLabel(brief.category)}
        </span>
        <span className="px-2.5 py-1 bg-surface-raised text-muted text-xs font-mono rounded-full border border-border">
          {formatLabel(brief.format)}
        </span>
        {brief.gym && (
          <span className="px-2.5 py-1 bg-surface-raised text-muted text-xs rounded-full border border-border">
            {brief.gym}
          </span>
        )}
        {brief.deadline && (
          <span className="px-2.5 py-1 bg-surface-raised text-muted text-xs font-mono rounded-full border border-border">
            {formatDeadline(brief.deadline)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-3 border-t border-border">
        {userHasClaimed ? (
          <span className="text-info font-medium">Open to continue →</span>
        ) : isFull ? (
          <span className="text-muted">No slots available</span>
        ) : (
          <span className="text-muted">
            <span className="font-mono text-foreground">{slotsAvailable}</span>
            {" "}of{" "}
            <span className="font-mono">{claimLimit}</span>
            {" "}slot{claimLimit !== 1 ? "s" : ""} open
          </span>
        )}
        {!userHasClaimed && !isFull && slotsAvailable === 1 && (
          <span className="text-warning font-medium">Last slot</span>
        )}
      </div>
    </Link>
  );
}
