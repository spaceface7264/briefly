import Link from "next/link";
import type { Brief, BriefWithClaims } from "@/types/database";
import { formatPrice, formatDeadline, categoryLabel, formatLabel } from "@/lib/utils";

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

  return (
    <Link
      href={`/briefs/${brief.id}`}
      className="block bg-surface border border-border rounded-xl p-5 hover:border-accent/50 hover:bg-surface-hover transition-all group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="font-semibold text-lg group-hover:text-accent transition-colors line-clamp-2">
          {brief.title}
        </h3>
        <span className="font-mono text-accent text-lg whitespace-nowrap">
          {formatPrice(brief.price_dkk)}
        </span>
      </div>

      <p className="text-muted text-sm line-clamp-2 mb-4">{brief.description}</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full">
          {categoryLabel(brief.category)}
        </span>
        <span className="px-2.5 py-1 bg-border text-muted text-xs font-mono rounded-full">
          {formatLabel(brief.format)}
        </span>
        {brief.gym && (
          <span className="px-2.5 py-1 bg-border text-muted text-xs rounded-full">
            {brief.gym}
          </span>
        )}
        {brief.deadline && (
          <span className="px-2.5 py-1 bg-border text-muted text-xs font-mono rounded-full">
            {formatDeadline(brief.deadline)}
          </span>
        )}
      </div>

      {/* Slots indicator */}
      <div className="flex items-center justify-between text-xs">
        {userHasClaimed ? (
          <span className="text-accent font-medium">You claimed this</span>
        ) : slotsAvailable > 0 ? (
          <span className="text-muted">
            <span className="font-mono text-foreground">{slotsAvailable}</span>
            {" "}of{" "}
            <span className="font-mono">{claimLimit}</span>
            {" "}slot{claimLimit !== 1 ? "s" : ""} available
          </span>
        ) : (
          <span className="text-warning">All slots claimed</span>
        )}
      </div>
    </Link>
  );
}
