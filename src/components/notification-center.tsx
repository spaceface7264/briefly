"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  notificationHref,
  relativeTimeFrom,
  type NotificationRow,
} from "@/lib/notification-center";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";

interface NotificationCenterProps {
  notifications: NotificationRow[];
  unreadCount: number;
  onNotificationsChange: (next: NotificationRow[]) => void;
  onUnreadCountChange: (count: number) => void;
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onNotificationsChange,
  onUnreadCountChange,
}: NotificationCenterProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasUnread = unreadCount > 0;
  const label = useMemo(() => {
    if (unreadCount > 99) return "99+";
    return unreadCount.toString();
  }, [unreadCount]);

  function updateUnreadFromRows(rows: NotificationRow[]) {
    onUnreadCountChange(rows.filter((n) => !n.read_at).length);
  }

  function toggleRead(row: NotificationRow) {
    setError(null);
    const nextRead = !row.read_at;
    const nextRows = notifications.map((n) =>
      n.id === row.id
        ? { ...n, read_at: nextRead ? new Date().toISOString() : null }
        : n
    );
    onNotificationsChange(nextRows);
    updateUnreadFromRows(nextRows);

    startTransition(async () => {
      const result = await markNotificationRead(row.id, nextRead);
      if (!result.ok) {
        setError(result.error);
        onNotificationsChange(notifications);
        updateUnreadFromRows(notifications);
      }
    });
  }

  function markAllRead() {
    if (!hasUnread) return;
    setError(null);
    const nextRows = notifications.map((n) => ({
      ...n,
      read_at: n.read_at ?? new Date().toISOString(),
    }));
    onNotificationsChange(nextRows);
    onUnreadCountChange(0);

    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        onNotificationsChange(notifications);
        updateUnreadFromRows(notifications);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative px-2 py-1.5 rounded-md text-sm text-muted hover:text-foreground transition-colors">
        <span className="sr-only">Open notifications</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-background text-[10px] leading-4 font-semibold text-center">
            {label}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] bg-surface border-border">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          <button
            type="button"
            disabled={!hasUnread || pending}
            onClick={markAllRead}
            className="text-xs text-accent disabled:text-muted"
          >
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="cursor-default focus:bg-surface-hover"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="w-full space-y-1 py-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={notificationHref(notification)}
                      className={`text-sm font-medium hover:underline ${
                        notification.read_at ? "text-muted" : "text-foreground"
                      }`}
                    >
                      {notification.title}
                    </Link>
                    {!notification.read_at && (
                      <span className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted line-clamp-2">{notification.body}</p>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-muted">
                      {relativeTimeFrom(notification.created_at)}
                    </p>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggleRead(notification)}
                      className="text-xs text-accent disabled:text-muted"
                    >
                      {notification.read_at ? "Mark unread" : "Mark read"}
                    </button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        {error && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2 text-xs text-error">{error}</div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
