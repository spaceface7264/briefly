"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { MailCheck, MailOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

function sortByReceivedAt(rows: NotificationRow[]): NotificationRow[] {
  return [...rows].sort((a, b) => {
    const createdAtDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (createdAtDiff !== 0) return createdAtDiff;
    return b.id.localeCompare(a.id);
  });
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onNotificationsChange,
  onUnreadCountChange,
}: NotificationCenterProps) {
  const [pending, startTransition] = useTransition();
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
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
    if (pendingToggleId === row.id) return;
    setError(null);
    setPendingToggleId(row.id);
    const nextRead = !row.read_at;
    const nextRows = notifications.map((n) =>
      n.id === row.id
        ? { ...n, read_at: nextRead ? new Date().toISOString() : null }
        : n
    );
    const sortedRows = sortByReceivedAt(nextRows);
    onNotificationsChange(sortedRows);
    updateUnreadFromRows(sortedRows);

    startTransition(async () => {
      try {
        const result = await markNotificationRead(row.id, nextRead);
        if (!result.ok) {
          setError(result.error);
          const sortedCurrentRows = sortByReceivedAt(notifications);
          onNotificationsChange(sortedCurrentRows);
          updateUnreadFromRows(sortedCurrentRows);
        }
      } finally {
        setPendingToggleId((current) => (current === row.id ? null : current));
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
    const sortedRows = sortByReceivedAt(nextRows);
    onNotificationsChange(sortedRows);
    onUnreadCountChange(0);

    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        const sortedCurrentRows = sortByReceivedAt(notifications);
        onNotificationsChange(sortedCurrentRows);
        updateUnreadFromRows(sortedCurrentRows);
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
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-background text-[10px] leading-4 font-semibold text-center ring-2 ring-background">
            {label}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(92vw,360px)] bg-surface border-border">
        <DropdownMenuGroup>
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
            <button
              type="button"
              disabled={!hasUnread || pending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                markAllRead();
              }}
              className="text-xs text-accent disabled:text-muted"
            >
              Mark all read
            </button>
          </div>
        </DropdownMenuGroup>
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
                className="cursor-default !rounded-none border-b border-border/60 pr-3 last:border-b-0 focus:bg-surface-hover data-[highlighted]:outline-none data-[highlighted]:ring-0 data-[highlighted]:shadow-none data-[highlighted]:[box-shadow:inset_0_0_0_1px_rgb(163_230_53_/_0.45)]"
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
                      disabled={pendingToggleId === notification.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleRead(notification);
                      }}
                      aria-label={notification.read_at ? "Mark as unread" : "Mark as read"}
                      title={notification.read_at ? "Mark as unread" : "Mark as read"}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-accent transition-colors hover:bg-surface-hover disabled:text-muted"
                    >
                      {notification.read_at ? (
                        <MailOpen className="h-3.5 w-3.5" />
                      ) : (
                        <MailCheck className="h-3.5 w-3.5" />
                      )}
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
