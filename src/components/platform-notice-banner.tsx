import { dismissNotice } from "@/app/admin/super/notices/actions";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org";

/**
 * Top-of-shell banner stack for platform notices targeting the
 * current user's context. Server component: queries Supabase for
 * active notices, filters out anything the current user has already
 * dismissed, and renders one banner per remaining row.
 *
 * Audience resolution:
 *
 *   * Platform-wide notices (audience='all') always render.
 *   * Per-org notices (audience='one') render when their target_org_id
 *     matches the user's active org. For platform admins in support
 *     mode that's their support_org_id; for everyone else it's their
 *     active_org_id from the profile.
 *
 * RLS already enforces these rules on the SELECT side (a non-admin
 * can never read another org's notice row), but we still filter in
 * app code for one reason: a platform admin without support mode
 * sees EVERY org's notices via is_platform_admin(), and we don't
 * want to spam them with twenty banners on /admin/super. So when
 * there's no resolvable org context we only show the all-orgs notices.
 *
 * Returns null when there's nothing to show, so the caller can drop
 * <PlatformNoticeBanner /> directly above the page content without a
 * spacer.
 */
export async function PlatformNoticeBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Resolve the user's "current org" for audience matching. We trust
  // getActiveOrg's existing logic, which already does the right thing
  // for platform admins (it returns support_org_id) and for org /
  // creator accounts (it returns active_org_id with a membership
  // fallback).
  const orgId = await getActiveOrg(supabase);

  // Window: notices whose [starts_at, ends_at] interval contains NOW.
  // We compute the bounds in app code and pass them as ISO strings,
  // because PostgREST doesn't support a single "interval contains
  // now()" filter inline.
  const nowIso = new Date().toISOString();

  // Pull every potentially-active notice the user can see. RLS
  // already handles audience visibility, so we just filter on time
  // window here. Nullable ends_at means "open-ended" so we OR for it.
  const { data: rawNotices } = await supabase
    .from("platform_notices")
    .select(
      "id, title, body, severity, audience, target_org_id, dismissible, starts_at, ends_at"
    )
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order("severity", { ascending: false }) // critical < info alpha order is the OPPOSITE of what we want, sort by created_at instead below
    .order("created_at", { ascending: false })
    .limit(20);

  if (!rawNotices || rawNotices.length === 0) return null;

  // App-side audience filter:
  //   * audience='all' always shows
  //   * audience='one' shows only when target_org_id matches the
  //     user's resolved org (support_org_id for platform support,
  //     active_org_id otherwise)
  // The DB already enforces target_org_id non-null for audience='one'
  // via the CHECK constraint, so we treat a null target on a 'one'
  // row as a defensive skip.
  const audienceMatched = rawNotices.filter((n) => {
    if (n.audience === "all") return true;
    if (n.audience === "one") {
      if (!n.target_org_id) return false;
      return orgId === n.target_org_id;
    }
    return false;
  });

  if (audienceMatched.length === 0) return null;

  // Look up dismissals in one batch. The (notice_id, user_id) PK
  // means this is a fast index probe. We only fetch dismissals that
  // are dismissible to begin with; non-dismissible rows can't be in
  // the table by design (the dismissNotice action refuses), but we
  // still apply the dismissibility check in JS as belt-and-braces.
  const noticeIds = audienceMatched.map((n) => n.id);
  const { data: dismissals } = await supabase
    .from("platform_notice_dismissals")
    .select("notice_id")
    .eq("user_id", user.id)
    .in("notice_id", noticeIds);

  const dismissedSet = new Set(
    (dismissals ?? []).map((d) => d.notice_id as string)
  );

  const visible = audienceMatched.filter(
    (n) => !(n.dismissible && dismissedSet.has(n.id))
  );

  if (visible.length === 0) return null;

  // Sort: critical first, warning, info. Within a severity, the
  // newest is on top so the most recently published notice catches
  // the eye.
  const severityRank: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  visible.sort((a, b) => {
    const ra = severityRank[a.severity] ?? 99;
    const rb = severityRank[b.severity] ?? 99;
    if (ra !== rb) return ra - rb;
    return 0;
  });

  return (
    <div className="flex flex-col">
      {visible.map((n) => (
        <NoticeBanner
          key={n.id}
          id={n.id}
          title={n.title}
          body={n.body}
          severity={(n.severity as "info" | "warning" | "critical") ?? "info"}
          dismissible={n.dismissible}
        />
      ))}
    </div>
  );
}

interface NoticeBannerProps {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  dismissible: boolean;
}

function NoticeBanner({
  id,
  title,
  body,
  severity,
  dismissible,
}: NoticeBannerProps) {
  // Severity tones are deliberately different from the app's accent
  // (lime) so the banners don't fight with primary CTA buttons. Info
  // is muted to make warning + critical feel hotter by contrast.
  const tone =
    severity === "critical"
      ? "bg-red-500/10 border-b border-red-500/30 text-red-100"
      : severity === "warning"
        ? "bg-amber-400/10 border-b border-amber-400/30 text-amber-100"
        : "bg-foreground/5 border-b border-border text-foreground";

  const labelTone =
    severity === "critical"
      ? "text-red-300"
      : severity === "warning"
        ? "text-amber-300"
        : "text-muted";

  const label =
    severity === "critical"
      ? "Critical"
      : severity === "warning"
        ? "Warning"
        : "Notice";

  return (
    <div
      role="status"
      aria-live={severity === "critical" ? "assertive" : "polite"}
      className={`px-4 md:px-6 py-3 ${tone}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span
              className={`font-mono uppercase tracking-[0.18em] text-[11px] mr-2 ${labelTone}`}
            >
              {label}
            </span>
            <span className="font-semibold">{title}</span>
          </p>
          <p className="text-sm mt-1 opacity-90 max-w-3xl">{body}</p>
        </div>
        {dismissible && (
          <form action={dismissNotice} className="shrink-0">
            <input type="hidden" name="notice_id" value={id} />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-md bg-foreground/10 hover:bg-foreground/15 text-foreground text-xs font-medium transition-colors"
            >
              Dismiss
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
