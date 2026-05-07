import type { Tables } from "@/types/database";

// The base row plus the optional joined org info we surface in the
// notification card. The join is cheap and lets a creator who's in
// multiple orgs (or an org admin who's just signed back in) tell which
// brand each notification refers to without clicking through.
export type NotificationRow = Tables<"notifications"> & {
  org?: { name: string; logo_url: string | null } | null;
};

export const NOTIFICATION_PAGE_SIZE = 20;

// The notifications inbox loads a wider page than the bell-dropdown
// because the user is on a dedicated screen and can absorb more rows
// at once. 25 strikes a balance: enough to fill a viewport without
// blowing past Postgres' default seq-scan window for accounts with
// thousands of historical notifications.
export const NOTIFICATIONS_INBOX_PAGE_SIZE = 25;

export type NotificationsFilter = "all" | "unread";

export function isNotificationsFilter(value: unknown): value is NotificationsFilter {
  return value === "all" || value === "unread";
}

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
