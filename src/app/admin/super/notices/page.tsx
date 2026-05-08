import { createClient } from "@/lib/supabase/server";
import { requirePlatformAccountOrRedirect } from "@/lib/platform";
import { createNotice, expireNotice } from "./actions";

export const dynamic = "force-dynamic";

interface NoticeRow {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  audience: "all" | "one";
  target_org_id: string | null;
  dismissible: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  creator: { name: string | null; email: string | null } | null;
}

interface OrgOption {
  id: string;
  name: string;
  slug: string;
}

/**
 * Compute the lifecycle bucket for a notice row, given the current
 * wall clock. "Active" rows are the ones that would render in the
 * banner today; "Scheduled" are future; "Ended" are past.
 */
type Lifecycle = "active" | "scheduled" | "ended";

function lifecycleOf(row: NoticeRow, now: Date): Lifecycle {
  const startsAt = new Date(row.starts_at).getTime();
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
  const t = now.getTime();
  if (endsAt !== null && endsAt <= t) return "ended";
  if (startsAt > t) return "scheduled";
  return "active";
}

export default async function PlatformNoticesPage() {
  await requirePlatformAccountOrRedirect();

  const supabase = await createClient();

  // Pull every notice the platform admin can see (RLS already grants
  // is_platform_admin() blanket SELECT) plus the org list for the
  // target picker. The org list is small enough to load eagerly; we
  // sort by name for the dropdown.
  const [noticesResult, orgsResult] = await Promise.all([
    supabase
      .from("platform_notices")
      .select(
        "id, title, body, severity, audience, target_org_id, dismissible, starts_at, ends_at, created_at, creator:profiles!platform_notices_created_by_fkey(name, email)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("organizations")
      .select("id, name, slug")
      .order("name", { ascending: true }),
  ]);

  const notices = (noticesResult.data ?? []) as unknown as NoticeRow[];
  const orgs = (orgsResult.data ?? []) as OrgOption[];
  const orgMap = new Map(orgs.map((o) => [o.id, o]));

  const now = new Date();
  const counts = {
    active: 0,
    scheduled: 0,
    ended: 0,
  };
  for (const n of notices) counts[lifecycleOf(n, now)] += 1;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold mb-1">Platform notices</h1>
        <p className="text-muted">
          Banners shown to one org or every org. Use for maintenance
          windows, ToS updates, billing changes, security advisories.
          Dismissible notices vanish per-user; forced notices stay up
          until you expire them.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Create notice</h2>
        <CreateNoticeForm orgs={orgs} />
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
          <h2 className="text-xl font-semibold">All notices</h2>
          <p className="text-xs text-muted">
            {counts.active} active, {counts.scheduled} scheduled,{" "}
            {counts.ended} ended
          </p>
        </div>
        <NoticeTable notices={notices} orgMap={orgMap} now={now} />
      </section>
    </div>
  );
}

function CreateNoticeForm({ orgs }: { orgs: OrgOption[] }) {
  return (
    <form
      action={createNotice}
      className="bg-surface border border-border rounded-xl p-5 grid gap-4"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Title" htmlFor="notice-title" required>
          <input
            id="notice-title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Read-only window: Sunday 02:00 to 02:30 UTC"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          />
        </Field>
        <Field label="Severity" htmlFor="notice-severity" required>
          <select
            id="notice-severity"
            name="severity"
            defaultValue="info"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          >
            <option value="info">Info (muted)</option>
            <option value="warning">Warning (amber)</option>
            <option value="critical">Critical (red)</option>
          </select>
        </Field>
      </div>

      <Field label="Body" htmlFor="notice-body" required>
        <textarea
          id="notice-body"
          name="body"
          required
          maxLength={4000}
          rows={3}
          placeholder="One paragraph. Plain text. No markdown rendering yet."
          className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm font-sans"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Audience" htmlFor="notice-audience" required>
          <select
            id="notice-audience"
            name="audience"
            defaultValue="all"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          >
            <option value="all">All organisations</option>
            <option value="one">One organisation</option>
          </select>
          <p className="text-xs text-muted mt-1.5">
            For one-org notices, pick the target below. For
            platform-wide notices, leave the picker on the placeholder;
            the server ignores it.
          </p>
        </Field>
        <Field label="Target org (only when audience is 'one')" htmlFor="notice-target-org">
          <select
            id="notice-target-org"
            name="target_org_id"
            defaultValue=""
            className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          >
            <option value="">Pick an org...</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.slug})
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Starts at (optional, defaults to now)" htmlFor="notice-starts-at">
          <input
            id="notice-starts-at"
            name="starts_at"
            type="datetime-local"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          />
        </Field>
        <Field label="Ends at (optional, blank = open-ended)" htmlFor="notice-ends-at">
          <input
            id="notice-ends-at"
            name="ends_at"
            type="datetime-local"
            className="w-full px-3 py-2 bg-background border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          name="dismissible"
          type="checkbox"
          defaultChecked
          className="size-4 rounded border-border bg-background accent-accent"
        />
        <span>
          Dismissible
          <span className="text-muted">
            {" "}
            (uncheck for forced banners, e.g. &quot;site is read-only&quot;).
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors text-sm"
        >
          Publish notice
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}

function NoticeTable({
  notices,
  orgMap,
  now,
}: {
  notices: NoticeRow[];
  orgMap: Map<string, OrgOption>;
  now: Date;
}) {
  if (notices.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted">
        No notices yet.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-raised text-left">
          <tr>
            <Th>Title</Th>
            <Th>Severity</Th>
            <Th>Audience</Th>
            <Th>Window</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {notices.map((n) => {
            const lifecycle = lifecycleOf(n, now);
            const org = n.target_org_id
              ? orgMap.get(n.target_org_id) ?? null
              : null;
            return (
              <tr key={n.id} className="border-t border-border align-top">
                <Td>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-2 max-w-xl">
                    {n.body}
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    by {n.creator?.name || n.creator?.email || "system"} ·{" "}
                    {n.dismissible ? "dismissible" : "forced"}
                  </p>
                </Td>
                <Td>
                  <SeverityPill severity={n.severity} />
                </Td>
                <Td>
                  {n.audience === "all" ? (
                    <span className="text-foreground">All orgs</span>
                  ) : org ? (
                    <span>
                      <span className="text-foreground">{org.name}</span>
                      <span className="text-muted font-mono text-xs ml-1">
                        ({org.slug})
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted">Unknown org</span>
                  )}
                </Td>
                <Td className="text-xs text-muted whitespace-nowrap">
                  <p>{new Date(n.starts_at).toLocaleString("en-GB")}</p>
                  <p>
                    →{" "}
                    {n.ends_at
                      ? new Date(n.ends_at).toLocaleString("en-GB")
                      : "open-ended"}
                  </p>
                </Td>
                <Td>
                  <LifecyclePill lifecycle={lifecycle} />
                </Td>
                <Td className="text-right">
                  {lifecycle !== "ended" ? (
                    <form action={expireNotice}>
                      <input type="hidden" name="notice_id" value={n.id} />
                      <button
                        type="submit"
                        className="text-amber-300 hover:underline text-sm"
                      >
                        Expire now
                      </button>
                    </form>
                  ) : (
                    <span className="text-muted text-xs">.</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SeverityPill({ severity }: { severity: string }) {
  const tone =
    severity === "critical"
      ? "bg-red-500/15 text-red-300"
      : severity === "warning"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-foreground/10 text-foreground";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {severity}
    </span>
  );
}

function LifecyclePill({ lifecycle }: { lifecycle: Lifecycle }) {
  if (lifecycle === "active") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-success/15 text-success">
        Active
      </span>
    );
  }
  if (lifecycle === "scheduled") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-accent/15 text-accent">
        Scheduled
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-foreground/10 text-muted">
      Ended
    </span>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-xs uppercase tracking-wider text-muted font-medium">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
