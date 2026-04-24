import type { Tables } from "@/types/database";

export type NotificationRow = Tables<"notifications">;

export const NOTIFICATION_PAGE_SIZE = 20;

export function notificationHref(notification: NotificationRow): string {
  const entityType = notification.entity_type;
  const entityId = notification.entity_id;

  if (entityType === "brief") {
    return `/briefs/${entityId}`;
  }

  if (entityType === "claim") {
    if (
      notification.event_type === "claim_submitted" ||
      notification.event_type === "claim_created"
    ) {
      return "/admin/claims";
    }

    return "/my-briefs";
  }

  return "/briefs";
}

export function relativeTimeFrom(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(1, Math.floor((now - then) / 1000));

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
