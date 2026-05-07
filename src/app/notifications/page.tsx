import { createClient } from "@/lib/supabase/server";
import { requireCreatorAccount } from "@/lib/account";
import {
  isNotificationsFilter,
  type NotificationsFilter,
} from "@/lib/notification-center";
import {
  getNotificationCounts,
  listNotificationsPage,
} from "@/app/notifications/actions";
import { NotificationsInbox } from "./notifications-inbox-client";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const { filter: filterParam } = await searchParams;
  const filter: NotificationsFilter = isNotificationsFilter(filterParam)
    ? filterParam
    : "all";

  // Account guard runs before any data fetching so org users land on
  // /admin instead of seeing a half-rendered creator inbox flash on
  // top of /briefs after the redirect.
  const supabase = await createClient();
  await requireCreatorAccount(supabase);

  const [{ items, hasMore, nextOffset }, counts] = await Promise.all([
    listNotificationsPage({ offset: 0, filter }),
    getNotificationCounts(),
  ]);

  // The `key` is what makes the inbox actually re-render when the
  // user toggles between All and Unread. Without it the client
  // component keeps its useState-seeded list from the first server
  // render, so the URL flips but the visible items don't change.
  // Re-mounting on filter change resets the list, the load-more
  // cursor, and the optimistic-toggle pending id all in one shot.
  return (
    <NotificationsInbox
      key={filter}
      initialItems={items}
      initialHasMore={hasMore}
      initialNextOffset={nextOffset}
      filter={filter}
      counts={counts}
    />
  );
}
