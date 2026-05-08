"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  logSupportAction,
  requirePlatformAccountOrRedirect,
} from "@/lib/platform";
import type { Json } from "@/types/database";

type Severity = "info" | "warning" | "critical";
type Audience = "all" | "one";

interface NoticeRowSnapshot {
  id: string;
  title: string;
  body: string;
  severity: string;
  audience: string;
  target_org_id: string | null;
  dismissible: boolean;
  starts_at: string;
  ends_at: string | null;
}

const NOTICE_SNAPSHOT_COLUMNS =
  "id, title, body, severity, audience, target_org_id, dismissible, starts_at, ends_at";

/**
 * Best-effort parse of a `<input type="datetime-local">` value into an
 * ISO timestamp. Returns null on empty / unparseable input so the
 * caller can fall back to the column default (NOW for starts_at, NULL
 * for ends_at).
 */
function parseLocalDatetime(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Convert a notice row snapshot into a Json-compatible payload for
 * the audit log. The row is already a flat object of primitives so
 * the cast is shape-compatible; we route through `unknown` to keep
 * the type system happy without reaching for `as any`.
 */
function toJsonSnapshot(row: NoticeRowSnapshot): Json {
  return row as unknown as Json;
}

/**
 * Create a new platform notice. Platform-admin only. The audience /
 * target_org_id consistency is enforced by a CHECK constraint at the
 * DB level (audience='all' requires target_org_id NULL,
 * audience='one' requires it set), so the app code only needs to
 * normalize the form input shape before INSERT.
 *
 * Writes go through the service-role client because the RLS INSERT
 * check (is_platform_admin) already passes for the caller, but the
 * convention from support-actions.ts is to use the admin client for
 * platform-only writes; staying consistent.
 */
export async function createNotice(formData: FormData): Promise<void> {
  const { supabase, userId } = await requirePlatformAccountOrRedirect();

  const titleRaw = formData.get("title");
  const bodyRaw = formData.get("body");
  const severityRaw = formData.get("severity");
  const audienceRaw = formData.get("audience");
  const targetOrgIdRaw = formData.get("target_org_id");
  const dismissibleRaw = formData.get("dismissible");

  if (typeof titleRaw !== "string" || titleRaw.trim().length === 0) {
    throw new Error("Title is required");
  }
  if (typeof bodyRaw !== "string" || bodyRaw.trim().length === 0) {
    throw new Error("Body is required");
  }

  const severity: Severity =
    severityRaw === "warning" || severityRaw === "critical"
      ? severityRaw
      : "info";

  const audience: Audience = audienceRaw === "one" ? "one" : "all";

  const admin = createAdminClient();

  let targetOrgId: string | null = null;
  if (audience === "one") {
    if (typeof targetOrgIdRaw !== "string" || targetOrgIdRaw.length === 0) {
      throw new Error("Target org is required when audience is 'one'");
    }
    // Re-fetch the org to make sure it exists (per CLAUDE.md: don't
    // trust client-supplied IDs in server actions). Service-role
    // client because platform admins reading any org via their own
    // client is fine, but we already have the admin client open.
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("id")
      .eq("id", targetOrgIdRaw)
      .maybeSingle();
    if (orgError) throw new Error(orgError.message);
    if (!org) throw new Error("Target org not found");
    targetOrgId = org.id;
  }

  // Checkbox semantics: "on" when checked, missing when not.
  const dismissible = dismissibleRaw === "on" || dismissibleRaw === "true";

  const startsAt = parseLocalDatetime(formData.get("starts_at"));
  const endsAt = parseLocalDatetime(formData.get("ends_at"));

  const insertRow = {
    title: titleRaw.trim().slice(0, 200),
    body: bodyRaw.trim().slice(0, 4000),
    severity,
    audience,
    target_org_id: targetOrgId,
    dismissible,
    ...(startsAt ? { starts_at: startsAt } : {}),
    ends_at: endsAt,
    created_by: userId,
  };

  const { data: created, error: insertError } = await admin
    .from("platform_notices")
    .insert(insertRow)
    .select(NOTICE_SNAPSHOT_COLUMNS)
    .single();
  if (insertError) {
    throw new Error(insertError.message);
  }

  await logSupportAction(supabase, {
    actorId: userId,
    action: "notice.create",
    targetOrgId: created?.target_org_id ?? null,
    targetTable: "platform_notices",
    targetRowId: created?.id,
    after: created ? toJsonSnapshot(created as NoticeRowSnapshot) : null,
  });

  revalidatePath("/admin/super/notices");
  revalidatePath("/admin", "layout");
  redirect("/admin/super/notices");
}

/**
 * Force a notice to expire immediately by setting ends_at = NOW().
 * Platform-admin only. We don't delete the row, the audit history
 * still references it and the dismissals join-table FK would cascade.
 */
export async function expireNotice(formData: FormData): Promise<void> {
  const { supabase, userId } = await requirePlatformAccountOrRedirect();

  const noticeId = formData.get("notice_id");
  if (typeof noticeId !== "string" || noticeId.length === 0) {
    throw new Error("notice_id is required");
  }

  const admin = createAdminClient();

  // Snapshot before the write, both for the audit diff and to prove
  // the row exists.
  const { data: before, error: readError } = await admin
    .from("platform_notices")
    .select(NOTICE_SNAPSHOT_COLUMNS)
    .eq("id", noticeId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!before) throw new Error("Notice not found");

  const beforeRow = before as NoticeRowSnapshot;
  const now = new Date().toISOString();

  const { data: after, error: updateError } = await admin
    .from("platform_notices")
    .update({ ends_at: now })
    .eq("id", noticeId)
    .select(NOTICE_SNAPSHOT_COLUMNS)
    .single();
  if (updateError) {
    throw new Error(updateError.message);
  }

  await logSupportAction(supabase, {
    actorId: userId,
    action: "notice.expire",
    targetOrgId: beforeRow.target_org_id,
    targetTable: "platform_notices",
    targetRowId: noticeId,
    before: toJsonSnapshot(beforeRow),
    after: after ? toJsonSnapshot(after as NoticeRowSnapshot) : null,
  });

  revalidatePath("/admin/super/notices");
  revalidatePath("/admin", "layout");
  redirect("/admin/super/notices");
}

/**
 * Mark a notice as dismissed for the current user. Available to any
 * authenticated user (creator, org member, or platform admin). The
 * dismissals INSERT policy gates on `user_id = auth.uid()` so this
 * goes through the user's RLS-bound client and we don't need the
 * service-role client here.
 *
 * No redirect; just revalidate the layout so the banner disappears
 * on the next render.
 */
export async function dismissNotice(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Not authenticated");
  }

  const noticeId = formData.get("notice_id");
  if (typeof noticeId !== "string" || noticeId.length === 0) {
    throw new Error("notice_id is required");
  }

  // Verify the notice is actually dismissible. Forced banners must
  // not be silenceable by anyone, even via crafted form posts. RLS
  // already gates SELECT on this row to people who can see the
  // notice, the read also serves as an existence check.
  const { data: notice, error: readError } = await supabase
    .from("platform_notices")
    .select("id, dismissible")
    .eq("id", noticeId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!notice) throw new Error("Notice not found");
  if (!notice.dismissible) {
    throw new Error("This notice is not dismissible");
  }

  const { error: insertError } = await supabase
    .from("platform_notice_dismissals")
    .insert({ notice_id: noticeId, user_id: user.id });
  // Duplicate dismissal (PK collision) is a no-op success; the user
  // already dismissed this notice on a previous render.
  if (insertError && insertError.code !== "23505") {
    throw new Error(insertError.message);
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}
