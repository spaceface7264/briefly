import type { UserRole } from "@/types/database";

export type NotificationType =
  | "submissions"
  | "new_briefs"
  | "claim_updates"
  | "claim_queue"
  | "payments"
  | "application_inbox"
  | "application_decisions";

export type NotificationColumn =
  | "notify_submissions"
  | "notify_new_briefs"
  | "notify_claim_updates"
  | "notify_claim_queue"
  | "notify_payments"
  | "notify_applications";

export interface NotificationTypeDef {
  key: NotificationType;
  column: NotificationColumn;
  label: string;
  description: string;
  roles: UserRole[];
  category: "in_app" | "email";
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
  {
    key: "submissions",
    column: "notify_submissions",
    label: "Submission alerts",
    description: "Email when a creator submits work that needs review.",
    roles: ["admin"],
    category: "email",
  },
  {
    key: "new_briefs",
    column: "notify_new_briefs",
    label: "New briefs",
    description: "Email when a new brief is published.",
    roles: ["creator"],
    category: "email",
  },
  {
    key: "claim_updates",
    column: "notify_claim_updates",
    label: "Claim updates",
    description: "Email when your claim is approved, rejected, released, or expired.",
    roles: ["creator"],
    category: "email",
  },
  {
    key: "claim_queue",
    column: "notify_claim_queue",
    label: "Claim queue activity",
    description: "Email when claims need attention in the admin queue.",
    roles: ["admin"],
    category: "email",
  },
  {
    key: "payments",
    column: "notify_payments",
    label: "Payout confirmations",
    description: "Email when payouts are sent for your approved work.",
    roles: ["creator"],
    category: "email",
  },
  {
    key: "application_inbox",
    column: "notify_applications",
    label: "Application alerts",
    description: "Email when a creator applies to join your org.",
    roles: ["admin"],
    category: "email",
  },
  {
    key: "application_decisions",
    column: "notify_applications",
    label: "Application updates",
    description: "Email when an org reviews your application.",
    roles: ["creator"],
    category: "email",
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
    claim_updates: true,
    claim_queue: true,
    payments: true,
    application_inbox: true,
    application_decisions: true,
  };
}

export function preferencesFromProfile(profile: {
  notify_submissions?: boolean | null;
  notify_new_briefs?: boolean | null;
  notify_claim_updates?: boolean | null;
  notify_claim_queue?: boolean | null;
  notify_payments?: boolean | null;
  notify_applications?: boolean | null;
}): NotificationPreferences {
  const applications = profile.notify_applications ?? true;
  return {
    submissions: profile.notify_submissions ?? true,
    new_briefs: profile.notify_new_briefs ?? true,
    claim_updates: profile.notify_claim_updates ?? true,
    claim_queue: profile.notify_claim_queue ?? true,
    payments: profile.notify_payments ?? true,
    application_inbox: applications,
    application_decisions: applications,
  };
}
