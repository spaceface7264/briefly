import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BriefCategory, BriefDurationClass, BriefStatus } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(priceDkk: number): string {
  return `${priceDkk.toLocaleString("da-DK")} DKK`;
}

export function formatDeadline(deadline: string | null): string {
  if (!deadline) return "No deadline";
  const date = new Date(deadline);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function categoryLabel(category: BriefCategory): string {
  const labels: Record<BriefCategory, string> = {
    entertaining: "Entertaining",
    ad: "Ad",
    guide: "Guide",
    event: "Event",
    community: "Community",
  };
  return labels[category];
}

export function durationClassLabel(durationClass: BriefDurationClass): string {
  const labels: Record<BriefDurationClass, string> = {
    short: "Short",
    medium: "Medium",
    long: "Long",
    static: "Static",
  };
  return labels[durationClass];
}

export function statusLabel(status: BriefStatus): string {
  const labels: Record<BriefStatus, string> = {
    open: "Open",
    claimed: "Claimed",
    submitted: "Submitted",
    approved: "Approved",
    paid: "Paid",
    archived: "Archived",
    draft: "Draft",
  };
  return labels[status];
}

export function statusColor(status: BriefStatus): string {
  const colors: Record<BriefStatus, string> = {
    open: "bg-success/20 text-success",
    claimed: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    archived: "bg-muted/20 text-muted",
    draft: "bg-muted/20 text-muted",
  };
  return colors[status];
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
