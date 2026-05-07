"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { BellIcon, MailCheckIcon, MailOpenIcon } from "lucide-react";
import { Nav } from "@/components/nav";
import {
  notificationHref,
  relativeTimeFrom,
  type NotificationRow,
  type NotificationsFilter,
} from "@/lib/notification-center";
import {
  listNotificationsPage,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";

interface NotificationsInboxProps {
  initialItems: NotificationRow[];
  initialHasMore: boolean;
  initialNextOffset: number;
  filter: NotificationsFilter;
  counts: { total: number; unread: number };
}

export function NotificationsInbox({
  initialItems,
  initialHasMore,
  initialNextOffset,
  filter,
  counts: initialCounts,
}: NotificationsInboxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<NotificationRow[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [counts, setCounts] = useState(initialCounts);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadMorePending, startLoadMoreTransition] = useTransition();
  const [markAllPending, startMarkAllTransition] = useTransition();

  function buildHref(nextFilter: NotificationsFilter) {
    const params = new URLSearchParams(searchParams);
    if (nextFilter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }
    const query = params.toString();
    return query ? `/notifications?${query}` : "/notifications";
  }

  async function toggleRead(row: NotificationRow) {
    if (pendingId === row.id) return;
    setError(null);
    setPendingId(row.id);
    const nextRead = !row.read_at;
    const previousItems = items;
    const previousCounts = counts;

    // Optimistic update. The unread dot flips immediately, and the
    // badge in the topbar follows because revalidatePath() on the
    // server action busts /briefs and friends, which the bell re-reads
    // from realtime anyway.
    setItems((current) =>
      current.map((n) =>
        n.id === row.id
          ? { ...n, read_at: nextRead ? new Date().toISOString() : null }
          : n
      )
    );
    setCounts((current) => ({
      total: current.total,
      unread: Math.max(0, current.unread + (nextRead ? -1 : 1)),
    }));

    try {
      const result = await markNotificationRead(row.id, nextRead);
      if (!result.ok) {
        setError(result.error);
        setItems(previousItems);
        setCounts(previousCounts);
      }
    } finally {
      setPendingId((current) => (current === row.id ? null : current));
    }
  }

  function markAllRead() {
    if (counts.unread === 0 || markAllPending) return;
    setError(null);
    const previousItems = items;
    const previousCounts = counts;
    const now = new Date().toISOString();

    setItems((current) =>
      current.map((n) => ({ ...n, read_at: n.read_at ?? now }))
    );
    setCounts((current) => ({ total: current.total, unread: 0 }));

    startMarkAllTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        setItems(previousItems);
        setCounts(previousCounts);
      }
    });
  }

  function loadMore() {
    if (!hasMore || loadMorePending) return;
    setError(null);
    startLoadMoreTransition(async () => {
      const result = await listNotificationsPage({
        offset: nextOffset,
        filter,
      });
      setItems((current) => [...current, ...result.items]);
      setHasMore(result.hasMore);
      setNextOffset(result.nextOffset);
    });
  }

  // The list-empty message changes per filter so users on the unread
  // tab don't think their entire history vanished when they're just
  // caught up. We also surface the all-empty state when no row has
  // ever landed.
  const isEmpty = items.length === 0;
  const emptyTitle =
    filter === "unread" ? "You're all caught up" : "No notifications yet";
  const emptyBody =
    filter === "unread"
      ? "When something new happens we'll drop it here. Switch to All to see your history."
      : "Activity on your briefs and claims will show up here.";

  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                Notifications
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Brief activity, claim updates, and team announcements.
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={counts.unread === 0 || markAllPending}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MailCheckIcon className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </header>

          <div
            role="tablist"
            aria-label="Filter notifications"
            className="mb-4 inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
          >
            <FilterTab
              href={buildHref("all")}
              active={filter === "all"}
              label="All"
              count={counts.total}
            />
            <FilterTab
              href={buildHref("unread")}
              active={filter === "unread"}
              label="Unread"
              count={counts.unread}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-error/30 bg-error-muted px-3 py-2 text-xs text-error">
              {error}
            </div>
          )}

          {isEmpty ? (
            <EmptyState title={emptyTitle} body={emptyBody} />
          ) : (
            <>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    pending={pendingId === notification.id}
                    onToggleRead={() => toggleRead(notification)}
                    onClick={() => {
                      // When a user clicks the row to navigate, we
                      // also flip it to read so the bell badge clears
                      // without requiring a separate trip to the
                      // explicit toggle button.
                      if (!notification.read_at) {
                        void toggleRead(notification);
                      }
                      router.push(notificationHref(notification));
                    }}
                  />
                ))}
              </ul>

              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadMorePending}
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadMorePending ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      scroll={false}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-surface-raised text-foreground shadow-sm"
          : "text-text-secondary hover:text-foreground"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
          active
            ? "bg-accent text-background"
            : "bg-surface-raised text-muted"
        }`}
      >
        {count > 99 ? "99+" : count}
      </span>
    </Link>
  );
}

function NotificationItem({
  notification,
  pending,
  onToggleRead,
  onClick,
}: {
  notification: NotificationRow;
  pending: boolean;
  onToggleRead: () => void;
  onClick: () => void;
}) {
  const isUnread = !notification.read_at;

  return (
    <li className="group/notification relative">
      {/* Stretched anchor: the whole row is the click target. We use
       *  a plain button to fire onClick (which both toggles read and
       *  navigates) so we get the same behaviour from keyboard
       *  Enter/Space and from mouse clicks, without nesting
       *  buttons inside an anchor.
       */}
      <button
        type="button"
        onClick={onClick}
        className="block w-full px-5 py-4 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
              isUnread ? "bg-accent" : "bg-transparent"
            }`}
          />
          <div className="min-w-0 flex-1 pr-9">
            <p
              className={`text-sm font-medium leading-snug ${
                isUnread ? "text-foreground" : "text-text-secondary"
              }`}
            >
              {notification.title}
            </p>
            <p
              className={`mt-1 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                isUnread ? "text-text-secondary" : "text-muted"
              }`}
            >
              {notification.body}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
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
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleRead();
        }}
        aria-label={isUnread ? "Mark as read" : "Mark as unread"}
        title={isUnread ? "Mark as read" : "Mark as unread"}
        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isUnread ? (
          <MailCheckIcon className="h-4 w-4" />
        ) : (
          <MailOpenIcon className="h-4 w-4" />
        )}
      </button>
    </li>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised ring-1 ring-border">
        <BellIcon className="h-5 w-5 text-muted" />
      </div>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{body}</p>
    </div>
  );
}
