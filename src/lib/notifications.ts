import type { UserRole } from "@/types/database";

export type NotificationType = "submissions" | "new_briefs";

export type NotificationColumn = "notify_submissions" | "notify_new_briefs";

export interface NotificationTypeDef {
  key: NotificationType;
  column: NotificationColumn;
  label: string;
  description: string;
  roles: UserRole[];
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  {
    key: "submissions",
    column: "notify_submissions",
    label: "Submission alerts",
    description: "Email when a creator submits work that needs review.",
    roles: ["admin"],
  },
  {
    key: "new_briefs",
    column: "notify_new_briefs",
    label: "New briefs",
    description: "Email when a new brief is published.",
    roles: ["creator"],
  },
];

export function notificationTypesFor(role: UserRole): NotificationTypeDef[] {
  return NOTIFICATION_TYPES.filter((t) => t.roles.includes(role));
}

export function findNotificationType(
  key: string
): NotificationTypeDef | undefined {
  return NOTIFICATION_TYPES.find((t) => t.key === key);
}

export type NotificationPreferences = Record<NotificationType, boolean>;

export function defaultPreferences(): NotificationPreferences {
  return {
    submissions: true,
    new_briefs: true,
  };
}

export function preferencesFromProfile(profile: {
  notify_submissions?: boolean | null;
  notify_new_briefs?: boolean | null;
}): NotificationPreferences {
  return {
    submissions: profile.notify_submissions ?? true,
    new_briefs: profile.notify_new_briefs ?? true,
  };
}
