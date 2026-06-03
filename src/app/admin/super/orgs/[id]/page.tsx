import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDkk, formatFeeBp, resolveOrgPricing } from "@/lib/pricing";
import { enterSupportMode } from "../support-actions";
import { GrantOverrideForm } from "./grant-form";
import { OverrideRow } from "./override-row";
import {
  archiveOrg,
  restoreOrg,
  suspendOrg,
} from "./lifecycle-actions";

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

interface PricingAuditRecord {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
}

interface PlatformAuditRecord {
  id: string;
  action: string;
  target_table: string | null;
  target_row_id: string | null;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
}

interface MemberRecord {
  user_id: string;
  role: "admin" | "member" | "creator";
  status: string;
  created_at: string;
  profile: { name: string | null; email: string | null } | null;
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
    .select(
      "id, name, slug, description, discoverable, industry, logo_url, accent_color, contact_email, default_payment_method_id, created_at, status, suspended_at, suspended_reason, archived_at"
    )
    .eq("id", id)
    .single();

  if (!org) notFound();

  const [
    pricing,
    overridesResult,
    pricingAuditResult,
    platformAuditResult,
    membersResult,
    briefsCountResult,
    openBriefsCountResult,
    claimsCountResult,
    pendingClaimsCountResult,
    escrowResult,
  ] = await Promise.all([
    resolveOrgPricing(supabase, org.id),
    supabase
      .from("pricing_overrides")
      .select(
        "id, kind, value, reason, granted_at, expires_at, active, granted_by, granter:profiles!pricing_overrides_granted_by_fkey(name, email)"
      )
      .eq("scope_org_id", org.id)
      .order("granted_at", { ascending: false }),
    supabase
      .from("pricing_audit_log")
      .select(
        "id, action, before, after, reason, created_at, actor:profiles!pricing_audit_log_actor_id_fkey(name, email)"
      )
      .eq("scope_org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("platform_audit_log")
      .select(
        "id, action, target_table, target_row_id, reason, created_at, actor:profiles!platform_audit_log_actor_id_fkey(name, email)"
      )
      .eq("target_org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("memberships")
      .select(
        "user_id, role, status, created_at, profile:profiles(name, email)"
      )
      .eq("org_id", org.id)
      .eq("status", "active")
      .order("role", { ascending: true }),
    supabase
      .from("briefs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase
      .from("briefs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "open"),
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "submitted"),
    supabase
      .from("briefs")
      .select("escrow_held_dkk")
      .eq("org_id", org.id)
      .in("funded_status", ["funded", "partially_released"]),
  ]);

  const overrides = (overridesResult.data ?? []) as unknown as OverrideRecord[];
  const pricingAudit = (pricingAuditResult.data ?? []) as unknown as PricingAuditRecord[];
  const platformAudit = (platformAuditResult.data ?? []) as unknown as PlatformAuditRecord[];
  const members = (membersResult.data ?? []) as unknown as MemberRecord[];
  const briefsTotal = briefsCountResult.count ?? 0;
  const briefsOpen = openBriefsCountResult.count ?? 0;
  const claimsTotal = claimsCountResult.count ?? 0;
  const claimsPending = pendingClaimsCountResult.count ?? 0;
  const escrowHeld = (escrowResult.data ?? []).reduce(
    (sum, b) => sum + (b.escrow_held_dkk ?? 0),
    0
  );

  const admins = members.filter((m) => m.role === "admin");
  const memberRoster = members.filter((m) => m.role === "member");
  const creators = members.filter((m) => m.role === "creator");
  const activeOverrides = overrides.filter((o) => o.active);
  const revokedOverrides = overrides.filter((o) => !o.active);

  const orgAccent = org.accent_color ?? "#09D7D7";
  const orgInitial = org.name.charAt(0).toUpperCase();

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/super/orgs"
          className="text-muted hover:text-foreground text-sm"
        >
          ← All organisations
        </Link>
        <div className="mt-3 flex items-center gap-4">
          {org.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo_url}
              alt={org.name}
              className="size-14 rounded-xl object-cover border border-border bg-background shrink-0"
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-14 rounded-xl flex items-center justify-center text-background font-bold text-2xl shrink-0"
              style={{ backgroundColor: orgAccent }}
            >
              {orgInitial}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold truncate">{org.name}</h1>
              <StatusPill status={org.status} />
            </div>
            <p className="font-mono text-xs text-muted mt-0.5">{org.slug}</p>
          </div>
        </div>
        {org.description && (
          <p className="text-sm text-muted mt-3 max-w-2xl">{org.description}</p>
        )}
        <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm max-w-2xl">
          <Inline label="Industry" value={org.industry ?? "-"} />
          <Inline label="Contact" value={org.contact_email ?? "-"} />
          <Inline
            label="Discoverable"
            value={org.discoverable ? "Yes" : "No"}
          />
          <Inline
            label="Created"
            value={new Date(org.created_at).toLocaleDateString("en-GB")}
          />
        </dl>
      </div>

      <LifecycleSection
        orgId={org.id}
        status={org.status}
        suspendedAt={org.suspended_at}
        suspendedReason={org.suspended_reason}
        archivedAt={org.archived_at}
      />

      {/* Hero action: support mode is the gateway to operating on this
          org. Putting it above the stats so the support reason field
          is the first input the admin lands on. */}
      <section className="bg-accent/5 border border-accent/20 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-1">Support mode</h2>
        <p className="text-muted text-sm mb-4">
          Open this org&apos;s admin shell as one of its admins. Every write
          inside is logged to{" "}
          <code className="font-mono text-xs">platform_audit_log</code>.
        </p>
        <form action={enterSupportMode} className="flex flex-col sm:flex-row gap-2">
          <input type="hidden" name="org_id" value={org.id} />
          <input
            type="text"
            name="reason"
            placeholder="Reason (optional). e.g. customer reported stuck claim"
            maxLength={500}
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent transition-colors text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Open in support mode →
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">At a glance</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat
            label="Total briefs"
            value={briefsTotal}
            sub={`${briefsOpen} open`}
          />
          <Stat
            label="Total claims"
            value={claimsTotal}
            sub={
              claimsPending > 0
                ? `${claimsPending} awaiting review`
                : "No pending review"
            }
          />
          <Stat
            label="People"
            value={members.length}
            sub={
              `${admins.length} admin${admins.length === 1 ? "" : "s"}` +
              (memberRoster.length
                ? `, ${memberRoster.length} member${memberRoster.length === 1 ? "" : "s"}`
                : "") +
              (creators.length
                ? `, ${creators.length} creator${creators.length === 1 ? "" : "s"}`
                : "")
            }
          />
          <Stat
            label="Escrow held"
            value={formatDkk(escrowHeld)}
            sub={
              org.default_payment_method_id
                ? "Payment method on file"
                : "No payment method"
            }
            subTone={org.default_payment_method_id ? "muted" : "warn"}
          />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">People</h2>
        {members.length === 0 ? (
          <p className="text-muted text-sm">No active memberships.</p>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised">
                <tr className="text-left">
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={`${m.user_id}-${m.role}`}
                    className="border-t border-border"
                  >
                    <Td>{m.profile?.name ?? "-"}</Td>
                    <Td className="text-muted font-mono text-xs">
                      {m.profile?.email ?? "-"}
                    </Td>
                    <Td>
                      <RoleChip role={m.role} />
                    </Td>
                    <Td className="text-muted text-xs">
                      {new Date(m.created_at).toLocaleDateString("en-GB")}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Effective pricing</h2>
        <div className="bg-surface border border-border rounded-xl p-5 grid sm:grid-cols-3 gap-4">
          <Field label="Plan">{pricing.plan?.name ?? "-"}</Field>
          <Field label="Take rate">{formatFeeBp(pricing.fee_bp)}</Field>
          <Field label="Source" className="font-mono text-xs">
            {pricing.source}
          </Field>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Active overrides</h2>
        {activeOverrides.length === 0 ? (
          <p className="text-muted text-sm">None.</p>
        ) : (
          <div className="space-y-2">
            {activeOverrides.map((o) => (
              <OverrideRow key={o.id} override={o} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Grant override</h2>
        <GrantOverrideForm orgId={org.id} />
      </section>

      {revokedOverrides.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-muted">Revoked</h2>
          <div className="space-y-2 opacity-60">
            {revokedOverrides.map((o) => (
              <OverrideRow key={o.id} override={o} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4">Platform audit (this org)</h2>
        {platformAudit.length === 0 ? (
          <p className="text-muted text-sm">
            No support-mode activity yet. Entries appear here once a
            platform admin enters support mode or makes a write inside
            this org.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {platformAudit.map((a) => (
              <AuditRow
                key={a.id}
                action={a.action}
                target={
                  a.target_table
                    ? `${a.target_table}${a.target_row_id ? `:${a.target_row_id.slice(0, 8)}` : ""}`
                    : null
                }
                reason={a.reason}
                actor={a.actor}
                createdAt={a.created_at}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Pricing audit (this org)</h2>
        {pricingAudit.length === 0 ? (
          <p className="text-muted text-sm">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {pricingAudit.map((a) => (
              <AuditRow
                key={a.id}
                action={a.action}
                target={null}
                reason={a.reason}
                actor={a.actor}
                createdAt={a.created_at}
              />
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

function Inline({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted shrink-0">{label}:</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  subTone = "muted",
}: {
  label: string;
  value: string | number;
  sub?: string;
  subTone?: "muted" | "warn";
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted mb-1">
        {label}
      </p>
      <p className="text-2xl font-bold leading-none">{value}</p>
      {sub && (
        <p
          className={`text-xs mt-1.5 ${subTone === "warn" ? "text-amber-300" : "text-muted"}`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function RoleChip({ role }: { role: "admin" | "member" | "creator" }) {
  const tone =
    role === "admin"
      ? "bg-accent/15 text-accent"
      : role === "member"
        ? "bg-foreground/10 text-foreground"
        : "bg-surface-raised text-muted";
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${tone}`}
    >
      {role}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
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

function StatusPill({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-success/15 text-success">
        Active
      </span>
    );
  }
  if (status === "suspended") {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-amber-400/15 text-amber-300">
        Suspended
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-foreground/10 text-muted">
      Archived
    </span>
  );
}

function LifecycleSection({
  orgId,
  status,
  suspendedAt,
  suspendedReason,
  archivedAt,
}: {
  orgId: string;
  status: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  archivedAt: string | null;
}) {
  const tone =
    status === "suspended"
      ? "bg-amber-400/5 border-amber-400/30"
      : status === "archived"
        ? "bg-foreground/5 border-border-strong"
        : "bg-surface border-border";

  return (
    <section className={`border rounded-xl p-5 ${tone}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Lifecycle</h2>
          {status === "active" && (
            <p className="text-muted text-sm">
              Org is live. Suspend to block writes from its admins
              while support investigates; archive to take it offline
              indefinitely.
            </p>
          )}
          {status === "suspended" && suspendedAt && (
            <p className="text-sm text-amber-300">
              Suspended {new Date(suspendedAt).toLocaleString("en-GB")}
              {suspendedReason ? `: ${suspendedReason}` : ""}.
            </p>
          )}
          {status === "archived" && archivedAt && (
            <p className="text-sm text-muted">
              Archived {new Date(archivedAt).toLocaleString("en-GB")}. Org
              data is preserved; nobody can write until restored.
            </p>
          )}
        </div>
      </div>

      {status === "active" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <form action={suspendOrg} className="flex flex-col gap-2">
            <input type="hidden" name="org_id" value={orgId} />
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                Suspend reason (required)
              </span>
              <input
                type="text"
                name="reason"
                required
                placeholder="e.g. card chargeback under investigation"
                maxLength={500}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent transition-colors text-sm"
              />
            </label>
            <button
              type="submit"
              className="self-start px-4 py-2 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg transition-colors text-sm"
            >
              Suspend org
            </button>
          </form>
          <form action={archiveOrg} className="flex flex-col gap-2">
            <input type="hidden" name="org_id" value={orgId} />
            <label className="block">
              <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
                Archive reason (optional)
              </span>
              <input
                type="text"
                name="reason"
                placeholder="e.g. churned, owner requested deletion"
                maxLength={500}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent transition-colors text-sm"
              />
            </label>
            <button
              type="submit"
              className="self-start px-4 py-2 bg-foreground/10 hover:bg-foreground/15 text-foreground font-semibold rounded-lg transition-colors text-sm"
            >
              Archive org
            </button>
          </form>
        </div>
      )}

      {status !== "active" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <form action={restoreOrg} className="flex-1 flex flex-col sm:flex-row gap-2">
            <input type="hidden" name="org_id" value={orgId} />
            <input
              type="text"
              name="reason"
              placeholder="Restore reason (optional)"
              maxLength={500}
              className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent transition-colors text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-success/15 hover:bg-success/25 text-success font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              Restore to active
            </button>
          </form>
          {status === "suspended" && (
            <form action={archiveOrg}>
              <input type="hidden" name="org_id" value={orgId} />
              <button
                type="submit"
                className="px-4 py-2 bg-foreground/10 hover:bg-foreground/15 text-foreground font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
              >
                Archive instead
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function AuditRow({
  action,
  target,
  reason,
  actor,
  createdAt,
}: {
  action: string;
  target: string | null;
  reason: string | null;
  actor: { name: string | null; email: string | null } | null;
  createdAt: string;
}) {
  return (
    <li className="bg-surface border border-border rounded-lg px-4 py-3 flex items-start gap-3">
      <span className="font-mono text-xs text-accent shrink-0">{action}</span>
      <div className="flex-1 min-w-0">
        {target && (
          <p className="font-mono text-[11px] text-muted mb-0.5">{target}</p>
        )}
        <p className="text-foreground text-sm">{reason ?? "(no reason)"}</p>
        <p className="text-xs text-muted mt-0.5">
          {actor?.name || actor?.email || "system"} ·{" "}
          {new Date(createdAt).toLocaleString("en-GB")}
        </p>
      </div>
    </li>
  );
}
