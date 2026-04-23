"use client";

import { NotificationsPanel } from "@/components/notifications-panel";
import type { NotificationPreferences } from "@/lib/notifications";

interface Props {
  preferences: NotificationPreferences;
}

export function NotificationsClient({ preferences }: Props) {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <p className="text-muted">Choose which emails you receive</p>
      </div>

      <NotificationsPanel role="creator" preferences={preferences} />
    </>
  );
}
