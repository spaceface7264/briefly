import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatFeeBp, resolveOrgPricing } from "@/lib/pricing";
import { enterSupportMode } from "../support-actions";
import { GrantOverrideForm } from "./grant-form";
import { OverrideRow } from "./override-row";

export const dynamic = "force-dynamic";

interface OverrideRecord {
  id: string;
  kind: string;
  value: Record<string, unknown>;
  reason: string;
  granted_at: string;
  expires_at: string | null;
  active: boolean;
  granted_by: string;
  granter: { name: string | null; email: string | null } | null;
}

interface AuditRecord {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
}

export default async function SuperOrgDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, description, discoverable, industry")
    .eq("id", id)
    .single();

  if (!org) notFound();

  const pricing = await resolveOrgPricing(supabase, org.id);

  const { data: overrideRows } = await supabase
    .from("pricing_overrides")
    .select(
      "id, kind, value, reason, granted_at, expires_at, active, granted_by, granter:profiles!pricing_overrides_granted_by_fkey(name, email)"
    )
    .eq("scope_org_id", org.id)
    .order("granted_at", { ascending: false });

  const overrides = (overrideRows ?? []) as unknown as OverrideRecord[];

  const { data: auditRows } = await supabase
    .from("pricing_audit_log")
    .select(
      "id, action, before, after, reason, created_at, actor:profiles!pricing_audit_log_actor_id_fkey(name, email)"
    )
    .eq("scope_org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const audit = (auditRows ?? []) as unknown as AuditRecord[];

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/super/orgs"
          className="text-muted hover:text-foreground text-sm"
        >
          ← All organisations
        </Link>
        <h1 className="text-3xl font-bold mt-2 mb-1">{org.name}</h1>
        <p className="font-mono text-xs text-muted">{org.slug}</p>
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Effective pricing</h2>
        <div className="bg-surface border border-border rounded-xl p-5 grid sm:grid-cols-3 gap-4">
          <Field label="Plan">{pricing.plan?.name ?? "—"}</Field>
          <Field label="Take rate">{formatFeeBp(pricing.fee_bp)}</Field>
          <Field label="Source" className="font-mono text-xs">
            {pricing.source}
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Support mode</h2>
        <p className="text-muted text-sm mb-4">
          Open this org&apos;s admin shell as if you were one of its admins.
          Every write is logged to{" "}
          <code className="font-mono text-xs">platform_audit_log</code>.
        </p>
        <form action={enterSupportMode} className="space-y-3">
          <input type="hidden" name="org_id" value={org.id} />
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Reason (optional)
            </span>
            <input
              type="text"
              name="reason"
              placeholder="e.g. customer reported stuck claim"
              maxLength={500}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors text-sm"
          >
            Open in support mode →
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Active overrides</h2>
        {overrides.filter((o) => o.active).length === 0 ? (
          <p className="text-muted text-sm">None.</p>
        ) : (
          <div className="space-y-2">
            {overrides
              .filter((o) => o.active)
              .map((o) => (
                <OverrideRow key={o.id} override={o} />
              ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Grant override</h2>
        <GrantOverrideForm orgId={org.id} />
      </section>

      {overrides.some((o) => !o.active) && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-muted">Revoked</h2>
          <div className="space-y-2 opacity-60">
            {overrides
              .filter((o) => !o.active)
              .map((o) => (
                <OverrideRow key={o.id} override={o} />
              ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4">Recent audit events</h2>
        {audit.length === 0 ? (
          <p className="text-muted text-sm">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {audit.map((a) => (
              <li
                key={a.id}
                className="bg-surface border border-border rounded-lg px-4 py-3 flex items-start gap-3"
              >
                <span className="font-mono text-xs text-accent shrink-0">
                  {a.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">
                    {a.reason ?? "(no reason)"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {a.actor?.name || a.actor?.email || "system"} ·{" "}
                    {new Date(a.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1">
        {label}
      </p>
      <p className={`font-medium ${className}`}>{children}</p>
    </div>
  );
}
