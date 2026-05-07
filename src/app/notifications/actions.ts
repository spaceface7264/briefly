"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATIONS_INBOX_PAGE_SIZE,
  type NotificationRow,
  type NotificationsFilter,
} from "@/lib/notification-center";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function listNotifications(limit = NOTIFICATION_PAGE_SIZE) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));

  return data ?? [];
}

export interface NotificationsPageResult {
  items: NotificationRow[];
  hasMore: boolean;
  nextOffset: number;
}

/**
 * Paginated fetch for the /notifications inbox. Loads a single page of
 * rows for the signed-in user, optionally filtered to unread only.
 *
 * Page size is clamped to NOTIFICATIONS_INBOX_PAGE_SIZE to keep the
 * server-side cost predictable and so the "Load more" button below
 * the list always pulls the same batch size as the initial render.
 */
export async function listNotificationsPage(input: {
  offset?: number;
  filter?: NotificationsFilter;
}): Promise<NotificationsPageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: [], hasMore: false, nextOffset: 0 };
  }

  const offset = Math.max(0, input.offset ?? 0);
  const limit = NOTIFICATIONS_INBOX_PAGE_SIZE;

  // Fetch one extra row to know whether a "Load more" button should
  // render without a separate count query. We slice it off before
  // returning so the client never sees the peek-ahead row.
  let query = supabase
    .from("notifications")
    .select("*, org:organizations(name, logo_url)")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit);

  if (input.filter === "unread") {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;
  if (error) {
    return { items: [], hasMore: false, nextOffset: offset };
  }

  const rows = (data ?? []) as unknown as NotificationRow[];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    hasMore,
    nextOffset: offset + items.length,
  };
}

export async function getNotificationCounts(): Promise<{
  total: number;
  unread: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { total: 0, unread: 0 };

  const [{ count: total }, { count: unread }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  return { total: total ?? 0, unread: unread ?? 0 };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  return count ?? 0;
}

export async function markNotificationRead(
  notificationId: string,
  read: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/briefs");
  revalidatePath("/my-briefs");
  revalidatePath("/admin");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/briefs");
  revalidatePath("/my-briefs");
  revalidatePath("/admin");
  return { ok: true };
}
