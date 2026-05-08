import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AuditSource = "platform" | "pricing";

const TABS: { id: AuditSource; label: string; description: string }[] = [
  {
    id: "platform",
    label: "Platform",
    description:
      "Support-mode sessions and any write a platform admin makes inside an org.",
  },
  {
    id: "pricing",
    label: "Pricing",
    description: "Plan changes, override grants, override revokes.",
  },
];

interface PlatformRow {
  id: string;
  action: string;
  target_org_id: string | null;
  target_table: string | null;
  target_row_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
}

interface PricingRow {
  id: string;
  action: string;
  scope_org_id: string | null;
  scope_user_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
}

export default async function SuperAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const params = await searchParams;
  const activeSource: AuditSource =
    params.source === "pricing" ? "pricing" : "platform";
  const meta = TABS.find((t) => t.id === activeSource) ?? TABS[0];

  const supabase = await createClient();

  // Both tables share the {action, before, after, reason, actor} shape;
  // the difference is the column carrying the target org id
  // (target_org_id vs scope_org_id) and the existence of
  // target_table / target_row_id on the platform side.
  let rows: PlatformRow[] = [];
  let pricingRows: PricingRow[] = [];

  if (activeSource === "platform") {
    const { data } = await supabase
      .from("platform_audit_log")
      .select(
        "id, action, target_org_id, target_table, target_row_id, before, after, reason, created_at, actor:profiles!platform_audit_log_actor_id_fkey(name, email)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    rows = (data ?? []) as unknown as PlatformRow[];
  } else {
    const { data } = await supabase
      .from("pricing_audit_log")
      .select(
        "id, action, scope_org_id, scope_user_id, before, after, reason, created_at, actor:profiles!pricing_audit_log_actor_id_fkey(name, email)"
      )
      .order("created_at", { ascending: false })
      .limit(200);
    pricingRows = (data ?? []) as unknown as PricingRow[];
  }

  // Look up org names in one shot. The two row shapes carry the org
  // id under different column names so we collect from whichever set
  // is populated.
  const orgIds = Array.from(
    new Set(
      [
        ...rows.map((r) => r.target_org_id),
        ...pricingRows.map((r) => r.scope_org_id),
      ].filter((v): v is string => Boolean(v))
    )
  );
  let orgMap = new Map<string, { name: string; slug: string }>();
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .in("id", orgIds);
    orgMap = new Map(
      (orgs ?? []).map((o) => [o.id, { name: o.name, slug: o.slug }])
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Audit log</h1>
        <p className="text-muted">{meta.description}</p>
      </div>

      <div className="mb-6 border-b border-border">
        <nav className="flex gap-1 -mb-px" aria-label="Audit sources">
          {TABS.map((tab) => {
            const isActive = tab.id === activeSource;
            const href =
              tab.id === "platform"
                ? "/admin/super/audit"
                : `/admin/super/audit?source=${tab.id}`;
            return (
              <Link
                key={tab.id}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {activeSource === "platform" ? (
        <PlatformList rows={rows} orgMap={orgMap} />
      ) : (
        <PricingList rows={pricingRows} orgMap={orgMap} />
      )}
    </div>
  );
}

function PlatformList({
  rows,
  orgMap,
}: {
  rows: PlatformRow[];
  orgMap: Map<string, { name: string; slug: string }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted">
        No events yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const org = row.target_org_id ? orgMap.get(row.target_org_id) : null;
        return (
          <li
            key={row.id}
            className="bg-surface border border-border rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm flex items-center gap-2 flex-wrap">
                  <ActionPill action={row.action} />
                  {org && (
                    <Link
                      href={`/admin/super/orgs/${row.target_org_id}`}
                      className="text-accent hover:underline"
                    >
                      {org.name}
                    </Link>
                  )}
                  {row.target_table && (
                    <span className="text-muted text-xs font-mono">
                      {row.target_table}
                      {row.target_row_id ? `:${row.target_row_id.slice(0, 8)}` : ""}
                    </span>
                  )}
                </p>
                {row.reason && (
                  <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">
                    {row.reason}
                  </p>
                )}
                {(row.before || row.after) && <DiffDetails row={row} />}
              </div>
              <ActorMeta
                actor={row.actor}
                createdAt={row.created_at}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PricingList({
  rows,
  orgMap,
}: {
  rows: PricingRow[];
  orgMap: Map<string, { name: string; slug: string }>;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted">
        No events yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const org = row.scope_org_id ? orgMap.get(row.scope_org_id) : null;
        return (
          <li
            key={row.id}
            className="bg-surface border border-border rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm flex items-center gap-2 flex-wrap">
                  <ActionPill action={row.action} />
                  {org && (
                    <Link
                      href={`/admin/super/orgs/${row.scope_org_id}`}
                      className="text-accent hover:underline"
                    >
                      {org.name}
                    </Link>
                  )}
                </p>
                {row.reason && (
                  <p className="text-sm text-muted mt-1.5 whitespace-pre-wrap">
                    {row.reason}
                  </p>
                )}
                {(row.before || row.after) && <DiffDetails row={row} />}
              </div>
              <ActorMeta
                actor={row.actor}
                createdAt={row.created_at}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ActionPill({ action }: { action: string }) {
  // Color the pill by domain prefix so support-mode rows stand out
  // from brief writes, money tools, etc.
  const domain = action.split(".")[0] ?? "";
  const tone =
    domain === "support"
      ? "bg-amber-400/15 text-amber-300"
      : domain === "brief" || domain === "claim"
        ? "bg-accent/15 text-accent"
        : "bg-surface-raised text-foreground";
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${tone}`}>
      {action}
    </span>
  );
}

function ActorMeta({
  actor,
  createdAt,
}: {
  actor: { name: string | null; email: string | null } | null;
  createdAt: string;
}) {
  return (
    <div className="text-xs text-muted text-right shrink-0">
      <p>{actor?.name || actor?.email || "system"}</p>
      <p className="font-mono mt-0.5">
        {new Date(createdAt).toLocaleString("en-GB")}
      </p>
    </div>
  );
}

function DiffDetails({
  row,
}: {
  row: { before: Record<string, unknown> | null; after: Record<string, unknown> | null };
}) {
  return (
    <details className="mt-2 text-xs text-muted">
      <summary className="cursor-pointer hover:text-foreground select-none">
        diff
      </summary>
      <pre className="mt-2 p-2 bg-background rounded overflow-x-auto font-mono text-[11px]">
        {JSON.stringify({ before: row.before, after: row.after }, null, 2)}
      </pre>
    </details>
  );
}
