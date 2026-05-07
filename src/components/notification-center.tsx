"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BellIcon, MailCheckIcon, MailOpenIcon } from "lucide-react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  const badgeLabel = unreadCount > 99 ? "99+" : unreadCount.toString();

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
      <DropdownMenuTrigger
        aria-label={
          hasUnread
            ? `Open notifications, ${unreadCount} unread`
            : "Open notifications"
        }
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <BellIcon className="h-[18px] w-[18px]" />
        {hasUnread && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-[18px] text-background ring-2 ring-background"
          >
            {badgeLabel}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-[380px] !p-0 bg-surface-raised border border-border-strong shadow-lg"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Notifications
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {hasUnread ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          <button
            type="button"
            disabled={!hasUnread || pending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              markAllRead();
            }}
            className="shrink-0 text-xs font-medium text-accent transition-colors hover:text-accent-hover disabled:cursor-not-allowed disabled:text-disabled"
          >
            Mark all read
          </button>
        </div>

        <DropdownMenuSeparator className="!m-0" />

        {notifications.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="max-h-[26rem] overflow-y-auto">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                togglePending={pendingToggleId === notification.id}
                onToggleRead={() => toggleRead(notification)}
              />
            ))}
          </div>
        )}

        <DropdownMenuSeparator className="!m-0" />

        {/* Raw MenuPrimitive.Item (not the styled DropdownMenuItem
         *  wrapper) so we don't inherit the focus:bg-accent +
         *  focus:**:text-accent-foreground defaults that paint a
         *  lime tile across the row when keyboard-navigated to.
         */}
        <MenuPrimitive.Item
          render={<Link href="/notifications" />}
          className="flex w-full items-center justify-center px-4 py-2.5 text-xs font-medium text-text-secondary outline-none transition-colors hover:bg-surface-hover hover:text-foreground focus:bg-surface-hover focus:text-foreground data-[highlighted]:bg-surface-hover data-[highlighted]:text-foreground"
        >
          View all notifications
        </MenuPrimitive.Item>

        {error && (
          <div className="border-t border-border px-3 py-2 text-xs text-error">
            {error}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification,
  togglePending,
  onToggleRead,
}: {
  notification: NotificationRow;
  togglePending: boolean;
  onToggleRead: () => void;
}) {
  const isUnread = !notification.read_at;

  return (
    // The row uses Base UI's raw MenuPrimitive.Item (not the styled
    // DropdownMenuItem wrapper) for keyboard nav + accessibility, but
    // without inheriting the wrapper's focus:bg-accent +
    // focus:**:text-accent-foreground defaults. That descendant text
    // override was repainting body and meta text in accent-foreground
    // on hover — a dark colour that became unreadable against the
    // surface-hover background. Using the raw primitive lets us own
    // every visual rule on the row and keep the body / meta legible.
    //
    // The mark-read button sits as an absolutely-positioned sibling
    // (not nested inside the Link the Item renders as) to avoid
    // <button> inside <a>, which is invalid HTML and which some
    // browsers handle inconsistently for click events.
    <div className="group/notification relative border-b border-border/50 last:border-b-0">
      <MenuPrimitive.Item
        render={
          <Link
            href={notificationHref(notification)}
            aria-label={notification.title}
          />
        }
        className="block w-full px-4 py-3 outline-none transition-colors hover:bg-surface-hover focus:bg-surface-hover data-[highlighted]:bg-surface-hover [&_*]:transition-colors group-hover/notification:[&_p]:text-foreground group-hover/notification:[&_span]:text-foreground data-[highlighted]:[&_p]:text-foreground data-[highlighted]:[&_span]:text-foreground focus:[&_p]:text-foreground focus:[&_span]:text-foreground"
      >
        <div className="flex w-full items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              isUnread ? "bg-accent" : "bg-transparent"
            }`}
          />
          <div className="min-w-0 flex-1 pr-7">
            <p
              className={`text-sm font-medium leading-snug ${
                isUnread ? "text-foreground" : "text-text-secondary"
              }`}
            >
              {notification.title}
            </p>
            <p
              className={`mt-0.5 line-clamp-2 text-xs leading-relaxed [overflow-wrap:anywhere] ${
                isUnread ? "text-text-secondary" : "text-muted"
              }`}
            >
              {notification.body}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <span>{relativeTimeFrom(notification.created_at)}</span>
              {notification.org?.name && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{notification.org.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </MenuPrimitive.Item>
      <button
        type="button"
        disabled={togglePending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleRead();
        }}
        aria-label={isUnread ? "Mark as read" : "Mark as unread"}
        title={isUnread ? "Mark as read" : "Mark as unread"}
        className="absolute right-2.5 top-2.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 transition-all hover:bg-surface hover:text-foreground focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent group-hover/notification:opacity-100 group-focus-within/notification:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isUnread ? (
          <MailCheckIcon className="h-3.5 w-3.5" />
        ) : (
          <MailOpenIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface ring-1 ring-border">
        <BellIcon className="h-4 w-4 text-muted" />
      </div>
      <p className="text-sm font-medium text-foreground">No notifications</p>
      <p className="mt-1 max-w-[14rem] text-xs text-text-secondary">
        New activity on your briefs and claims will show up here.
      </p>
    </div>
  );
}
