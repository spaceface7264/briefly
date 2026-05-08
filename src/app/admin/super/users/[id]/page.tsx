import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAccountOrRedirect } from "@/lib/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  disableUser,
  enableUser,
  forcePasswordReset,
} from "../actions";

export const dynamic = "force-dynamic";

interface MembershipRow {
  id: string;
  role: "admin" | "member" | "creator";
  status: string;
  created_at: string;
  org: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
}

interface PlatformAuditRecord {
  id: string;
  action: string;
  reason: string | null;
  created_at: string;
  actor: { name: string | null; email: string | null } | null;
}

export default async function SuperUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reset_link?: string }>;
}) {
  const { id } = await params;
  const { reset_link: resetLinkRaw } = await searchParams;
  const { supabase } = await requirePlatformAccountOrRedirect();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, email, name, account_type, is_platform_admin, avatar_url, created_at, country, instagram_handle, stripe_account_id, stripe_payouts_enabled, stripe_details_submitted, disabled_at, disabled_reason, support_org_id, active_org_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!profile) notFound();

  // Last-sign-in lives on auth.users, which isn't visible to the
  // RLS-bound client. Fetch it through the service-role client.
  // This is a read-only cross-trust-boundary lookup (no writes).
  const adminClient = createAdminClient();
  const { data: authData } = await adminClient.auth.admin.getUserById(id);
  const lastSignInAt = authData?.user?.last_sign_in_at ?? null;
  const emailConfirmedAt = authData?.user?.email_confirmed_at ?? null;

  const [membershipsResult, auditResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, role, status, created_at, org:organizations(id, name, slug, status)"
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("platform_audit_log")
      .select(
        "id, action, reason, created_at, actor:profiles!platform_audit_log_actor_id_fkey(name, email)"
      )
      .eq("target_table", "profiles")
      .eq("target_row_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const memberships = (membershipsResult.data ?? []) as unknown as MembershipRow[];
  const auditRows = (auditResult.data ?? []) as unknown as PlatformAuditRecord[];

  const isCreator = profile.account_type === "creator";
  const isDisabled = Boolean(profile.disabled_at);

  // Reset link arrives via redirect query string after a successful
  // forcePasswordReset call. Validate it's a Supabase URL so we
  // don't render arbitrary pasted strings.
  const resetLink =
    typeof resetLinkRaw === "string" && resetLinkRaw.startsWith("http")
      ? resetLinkRaw
      : null;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/admin/super/users"
          className="text-muted hover:text-foreground text-sm"
        >
          ← All users
        </Link>
        <div className="mt-3 flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.name ?? profile.email ?? ""}
              className="size-14 rounded-xl object-cover border border-border bg-background shrink-0"
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-14 rounded-xl flex items-center justify-center bg-surface-raised text-muted font-bold text-2xl shrink-0 border border-border"
            >
              {(profile.name ?? profile.email ?? "?")
                .charAt(0)
                .toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold truncate">
                {profile.name?.trim() || "(no name)"}
              </h1>
              <StatusPill disabled={isDisabled} />
              <AccountChip type={profile.account_type} />
              {profile.is_platform_admin && <PlatformAdminChip />}
            </div>
            <p className="font-mono text-xs text-muted mt-0.5">
              {profile.email ?? "(no email)"}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm max-w-2xl">
          <Inline label="User ID" value={<code className="font-mono text-xs">{profile.id}</code>} />
          <Inline label="Country" value={profile.country ?? "—"} />
          <Inline
            label="Instagram"
            value={profile.instagram_handle ?? "—"}
          />
          <Inline
            label="Created"
            value={new Date(profile.created_at).toLocaleString("en-GB")}
          />
          <Inline
            label="Last sign-in"
            value={
              lastSignInAt
                ? new Date(lastSignInAt).toLocaleString("en-GB")
                : "Never"
            }
          />
          <Inline
            label="Email confirmed"
            value={
              emailConfirmedAt
                ? new Date(emailConfirmedAt).toLocaleString("en-GB")
                : "No"
            }
          />
        </dl>
      </div>

      <LifecycleSection
        userId={profile.id}
        disabledAt={profile.disabled_at}
        disabledReason={profile.disabled_reason}
        resetLink={resetLink}
      />

      {isCreator && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Connect status</h2>
          <div className="bg-surface border border-border rounded-xl p-5 grid sm:grid-cols-3 gap-4">
            <Field label="Stripe account">
              {profile.stripe_account_id ? (
                <code className="font-mono text-xs">
                  {profile.stripe_account_id}
                </code>
              ) : (
                <span className="text-muted">Not connected</span>
              )}
            </Field>
            <Field label="Payouts enabled">
              {profile.stripe_payouts_enabled ? (
                <span className="text-success">Yes</span>
              ) : (
                <span className="text-amber-300">No</span>
              )}
            </Field>
            <Field label="Details submitted">
              {profile.stripe_details_submitted ? (
                <span className="text-success">Yes</span>
              ) : (
                <span className="text-muted">No</span>
              )}
            </Field>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4">Memberships</h2>
        {memberships.length === 0 ? (
          <p className="text-muted text-sm">
            {profile.account_type === "platform"
              ? "Platform accounts hold no memberships by design."
              : "No memberships."}
          </p>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-raised">
                <tr className="text-left">
                  <Th>Organisation</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <Td>
                      {m.org ? (
                        <Link
                          href={`/admin/super/orgs/${m.org.id}`}
                          className="text-accent hover:underline"
                        >
                          {m.org.name}
                        </Link>
                      ) : (
                        <span className="text-muted">(deleted org)</span>
                      )}
                      {m.org && (
                        <p className="font-mono text-xs text-muted">
                          {m.org.slug}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <RoleChip role={m.role} />
                    </Td>
                    <Td>
                      <MembershipStatusChip status={m.status} />
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
        <h2 className="text-xl font-semibold mb-4">Platform audit (this user)</h2>
        {auditRows.length === 0 ? (
          <p className="text-muted text-sm">
            No support actions on this user yet.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {auditRows.map((a) => (
              <li
                key={a.id}
                className="bg-surface border border-border rounded-lg px-4 py-3 flex items-start gap-3"
              >
                <span className="font-mono text-xs text-accent shrink-0">
                  {a.action}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm">
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

function LifecycleSection({
  userId,
  disabledAt,
  disabledReason,
  resetLink,
}: {
  userId: string;
  disabledAt: string | null;
  disabledReason: string | null;
  resetLink: string | null;
}) {
  const isDisabled = Boolean(disabledAt);
  const tone = isDisabled
    ? "bg-amber-400/5 border-amber-400/30"
    : "bg-surface border-border";

  return (
    <section className={`border rounded-xl p-5 ${tone}`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Lifecycle</h2>
        {isDisabled && disabledAt ? (
          <p className="text-sm text-amber-300">
            Disabled {new Date(disabledAt).toLocaleString("en-GB")}
            {disabledReason ? `: ${disabledReason}` : ""}.
          </p>
        ) : (
          <p className="text-muted text-sm">
            User is active. Disable to flag the account for support
            review (v1: this is a flag, not a hard ban; the user can
            still sign in).
          </p>
        )}
      </div>

      {!isDisabled && (
        <form action={disableUser} className="flex flex-col gap-2 mb-4">
          <input type="hidden" name="user_id" value={userId} />
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-muted mb-1.5">
              Disable reason (required)
            </span>
            <input
              type="text"
              name="reason"
              required
              placeholder="e.g. chargeback under investigation, ToS report"
              maxLength={500}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
            />
          </label>
          <button
            type="submit"
            className="self-start px-4 py-2 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 font-semibold rounded-lg transition-colors text-sm"
          >
            Disable user
          </button>
        </form>
      )}

      {isDisabled && (
        <form
          action={enableUser}
          className="flex flex-col sm:flex-row gap-2 mb-4"
        >
          <input type="hidden" name="user_id" value={userId} />
          <input
            type="text"
            name="reason"
            placeholder="Restore reason (optional)"
            maxLength={500}
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-success/15 hover:bg-success/25 text-success font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Re-enable user
          </button>
        </form>
      )}

      <div className="border-t border-border pt-4">
        <p className="text-xs uppercase tracking-wider text-muted mb-2">
          Force password reset
        </p>
        <p className="text-sm text-muted mb-3">
          Generates a one-time recovery link via Supabase auth admin.
          Forward the link to the user; we do not email it for v1.
        </p>
        <form action={forcePasswordReset}>
          <input type="hidden" name="user_id" value={userId} />
          <button
            type="submit"
            className="px-4 py-2 bg-surface-raised hover:bg-surface text-foreground border border-border font-semibold rounded-lg transition-colors text-sm"
          >
            Generate reset link
          </button>
        </form>

        {resetLink && (
          <div className="mt-3 bg-background border border-accent/40 rounded-lg p-3">
            <p className="text-xs uppercase tracking-wider text-accent font-medium mb-1.5">
              New reset link
            </p>
            <p className="text-xs text-muted mb-2">
              Copy this and forward it to the user. Single-use, expires
              per Supabase defaults.
            </p>
            <code className="block font-mono text-[11px] text-foreground break-all bg-surface rounded p-2 border border-border">
              {resetLink}
            </code>
          </div>
        )}
      </div>
    </section>
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

function StatusPill({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-amber-400/15 text-amber-300">
        Disabled
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-success/15 text-success">
      Active
    </span>
  );
}

function AccountChip({ type }: { type: string }) {
  const tone =
    type === "platform"
      ? "bg-accent/15 text-accent"
      : type === "org"
        ? "bg-foreground/10 text-foreground"
        : "bg-surface-raised text-muted";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {type}
    </span>
  );
}

function PlatformAdminChip() {
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-accent/15 text-accent">
      Admin flag
    </span>
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

function MembershipStatusChip({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-success/15 text-success"
      : status === "pending"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-foreground/10 text-muted";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {status}
    </span>
  );
}
