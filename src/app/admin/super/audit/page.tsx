import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  action: string;
  scope_org_id: string | null;
  scope_user_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
  org: { name: string | null; slug: string | null } | null;
}

export default async function SuperAuditPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("pricing_audit_log")
    .select(
      "id, action, scope_org_id, scope_user_id, before, after, reason, created_at, actor:profiles!pricing_audit_log_actor_id_fkey(name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as AuditRow[];

  const orgIds = Array.from(
    new Set(rows.map((r) => r.scope_org_id).filter((v): v is string => Boolean(v)))
  );
  let orgMap = new Map<string, { name: string; slug: string }>();
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, slug")
      .in("id", orgIds);
    orgMap = new Map((orgs ?? []).map((o) => [o.id, { name: o.name, slug: o.slug }]));
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Audit log</h1>
        <p className="text-muted">
          Every plan change, override grant, and revoke. Append-only.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-muted">
          No events yet.
        </div>
      ) : (
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
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-surface-raised rounded">
                        {row.action}
                      </span>
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
                      <p className="text-sm text-muted mt-1.5">{row.reason}</p>
                    )}
                    <details className="mt-2 text-xs text-muted">
                      <summary className="cursor-pointer hover:text-foreground select-none">
                        diff
                      </summary>
                      <pre className="mt-2 p-2 bg-background rounded overflow-x-auto font-mono text-[11px]">
                        {JSON.stringify(
                          { before: row.before, after: row.after },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  </div>
                  <div className="text-xs text-muted text-right shrink-0">
                    <p>{row.actor?.name || row.actor?.email || "system"}</p>
                    <p className="font-mono mt-0.5">
                      {new Date(row.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
