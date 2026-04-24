import type { BriefCategory, BriefDurationClass, BriefStatus, ClaimStatus } from "@/types/database";

export type BriefPlatform = "instagram" | "tiktok" | "youtube";

export const badgeToneByStatus: Record<BriefStatus | ClaimStatus, string> = {
  open: "bg-success/20 text-success",
  claimed: "bg-accent-muted text-accent",
  submitted: "bg-info-muted text-info",
  approved: "bg-success/20 text-success",
  paid: "bg-success-muted text-success",
  archived: "bg-muted/20 text-muted",
  active: "bg-accent-muted text-accent",
  cancelled: "bg-error/20 text-error",
};

export const badgeToneByDurationClass: Record<BriefDurationClass, string> = {
  short: "bg-[#22D3EE]/15 text-[#22D3EE]",
  medium: "bg-[#8B5CF6]/15 text-[#8B5CF6]",
  long: "bg-[#F97316]/15 text-[#F97316]",
  static: "bg-[#10B981]/15 text-[#10B981]",
};

export const badgeToneByPlatform: Record<BriefPlatform, string> = {
  instagram: "bg-[#E4405F]/15 text-[#E4405F]",
  tiktok: "bg-[#25F4EE]/15 text-[#25F4EE]",
  youtube: "bg-[#FF0033]/15 text-[#FF0033]",
};

export const badgeToneByCategory: Record<BriefCategory, string> = {
  ad: "bg-warning/15 text-warning",
  event: "bg-info/15 text-info",
  guide: "bg-success/15 text-success",
  entertaining: "bg-[#EC4899]/15 text-[#EC4899]",
  community: "bg-[#A855F7]/15 text-[#A855F7]",
};

export const claimStatusLabel: Record<ClaimStatus, string> = {
  active: "Active",
  submitted: "Pending Review",
  approved: "Approved",
  paid: "Paid",
  cancelled: "Cancelled",
};
