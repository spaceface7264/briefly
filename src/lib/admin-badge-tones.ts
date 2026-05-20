import type {
  BriefCategory,
  BriefDurationClass,
  BriefFundedStatus,
  BriefStatus,
  ClaimStatus,
} from "@/types/database";

export type BriefPlatform = "instagram" | "tiktok" | "youtube";

export const badgeToneByStatus: Record<BriefStatus | ClaimStatus, string> = {
  open: "bg-success/20 text-success-ink",
  claimed: "bg-accent-muted text-accent-ink",
  submitted: "bg-info-muted text-info-ink",
  revision_requested: "bg-warning/20 text-warning-ink",
  approved: "bg-success/20 text-success-ink",
  paid: "bg-success-muted text-success-ink",
  archived: "bg-muted/20 text-muted",
  draft: "bg-muted/20 text-muted",
  active: "bg-accent-muted text-accent-ink",
  cancelled: "bg-error/20 text-error-ink",
};

// Categorical colors — these are deliberately distinct (not brand-aligned).
// Bg uses the vivid color at 15% alpha (works on both themes).
// Text uses a Tailwind ~600/700 shade that passes contrast on cream.
export const badgeToneByDurationClass: Record<BriefDurationClass, string> = {
  short: "bg-[#22D3EE]/15 text-[#0E7490]",
  medium: "bg-[#8B5CF6]/15 text-[#6D28D9]",
  long: "bg-[#F97316]/15 text-[#C2410C]",
  static: "bg-[#10B981]/15 text-[#047857]",
};

export const badgeToneByPlatform: Record<BriefPlatform, string> = {
  instagram: "bg-[#E4405F]/15 text-[#BE185D]",
  tiktok: "bg-[#25F4EE]/15 text-[#0E7490]",
  youtube: "bg-[#FF0033]/15 text-[#BE123C]",
};

export const badgeToneByCategory: Record<BriefCategory, string> = {
  ad: "bg-warning/15 text-warning-ink",
  event: "bg-info/15 text-info-ink",
  guide: "bg-success/15 text-success-ink",
  entertaining: "bg-[#EC4899]/15 text-[#BE185D]",
  community: "bg-[#A855F7]/15 text-[#7E22CE]",
};

export const claimStatusLabel: Record<ClaimStatus, string> = {
  active: "Active",
  submitted: "Pending Review",
  revision_requested: "Changes Requested",
  approved: "Approved",
  paid: "Paid",
  cancelled: "Cancelled",
};

// Phase 1.1f. `unfunded` is intentionally not in the tone map — the
// list/detail views suppress the badge entirely for unfunded briefs
// (legacy data + free briefs that never escrowed). `funded` /
// `partially_released` / `released` / `refunded` are the only states
// worth surfacing.
export const badgeToneByFundedStatus: Partial<
  Record<BriefFundedStatus, string>
> = {
  funded: "bg-accent-muted text-accent-ink",
  partially_released: "bg-info-muted text-info-ink",
  released: "bg-muted/20 text-muted",
  refunded: "bg-error/15 text-error-ink",
};

export const fundedStatusLabel: Partial<Record<BriefFundedStatus, string>> = {
  funded: "Funded",
  partially_released: "Partially released",
  released: "Released",
  refunded: "Refunded",
};
