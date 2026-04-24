"use client";

import { NotificationsPanel } from "@/components/notifications-panel";
import type { NotificationPreferences } from "@/lib/notifications";
import type { UserRole } from "@/types/database";

interface Props {
  preferences: NotificationPreferences;
  role: UserRole;
}

export function NotificationsClient({ preferences, role }: Props) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <p className="text-muted">
          In-app notifications are always available. Choose which email alerts you receive.
        </p>
      </div>

      <NotificationsPanel role={role} preferences={preferences} />
    </>
  );
}
