import Link from "next/link";
import { requirePlatformAccountOrRedirect } from "@/lib/platform";

export const dynamic = "force-dynamic";

interface UserListRow {
  id: string;
  email: string | null;
  name: string | null;
  account_type: string;
  is_platform_admin: boolean;
  disabled_at: string | null;
  membership_count: number;
}

interface MembershipCountRow {
  user_id: string;
}

/**
 * Platform-admin user list. Shows every profile with the columns a
 * support engineer needs to triage (account type, platform-admin
 * flag, membership count, active/disabled state). Search is server-
 * side via `?q=`; we ilike against email OR name so partial matches
 * on either field work.
 *
 * Reads go through the user's RLS-bound client. The "Admins can
 * read org member profiles" SELECT policy on profiles was widened
 * in 0046 to grant platform admins blanket SELECT, so we get the
 * full list back without escalating to the service-role client.
 */
export default async function SuperUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase } = await requirePlatformAccountOrRedirect();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  let query = supabase
    .from("profiles")
    .select(
      "id, email, name, account_type, is_platform_admin, disabled_at"
    )
    .order("created_at", { ascending: false })
    .limit(250);

  if (q) {
    // Escape % and _ so a literal search for "user_a@x.com" doesn't
    // wildcard the underscore. Then wrap with %...% on each side for
    // the substring match the operator expects.
    const escaped = q.replace(/[%_]/g, (m) => `\\${m}`);
    const pattern = `%${escaped}%`;
    query = query.or(`email.ilike.${pattern},name.ilike.${pattern}`);
  }

  const { data: profiles, error: profilesError } = await query;
  if (profilesError) {
    throw new Error(profilesError.message);
  }
  const profileRows = profiles ?? [];

  // Count memberships per user in a single round-trip. We pull all
  // active membership user_ids for the matched profile set and tally
  // client-side. With the platform admin SELECT bypass on memberships
  // (also from 0046) this returns rows for every org. Capped at the
  // 250-row profile slice so it stays bounded.
  const userIds = profileRows.map((p) => p.id);
  let membershipCounts = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: memberships, error: mErr } = await supabase
      .from("memberships")
      .select("user_id")
      .in("user_id", userIds)
      .eq("status", "active");
    if (mErr) {
      throw new Error(mErr.message);
    }
    const rows = (memberships ?? []) as MembershipCountRow[];
    membershipCounts = rows.reduce((acc, m) => {
      acc.set(m.user_id, (acc.get(m.user_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  }

  const rows: UserListRow[] = profileRows.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    account_type: p.account_type,
    is_platform_admin: p.is_platform_admin,
    disabled_at: p.disabled_at,
    membership_count: membershipCounts.get(p.id) ?? 0,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Users</h1>
        <p className="text-muted">
          {q
            ? `${rows.length} match${rows.length === 1 ? "" : "es"} for "${q}".`
            : `${rows.length} user${rows.length === 1 ? "" : "s"}, newest first. Showing first 250.`}
        </p>
      </div>

      <form
        action="/admin/super/users"
        method="get"
        className="mb-4 sticky top-12 z-[5] bg-background/80 backdrop-blur-sm py-2 -mx-1 px-1"
      >
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by email or name"
            className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors text-sm whitespace-nowrap"
          >
            Search
          </button>
          {q && (
            <Link
              href="/admin/super/users"
              className="px-4 py-2 bg-surface hover:bg-surface-raised text-foreground border border-border rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised text-left">
            <tr>
              <Th>User</Th>
              <Th>Account</Th>
              <Th>Memberships</Th>
              <Th>State</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <Td>
                  <p className="font-medium">{row.name ?? "(no name)"}</p>
                  <p className="font-mono text-xs text-muted">
                    {row.email ?? "(no email)"}
                  </p>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <AccountChip type={row.account_type} />
                    {row.is_platform_admin && <PlatformAdminChip />}
                  </div>
                </Td>
                <Td className="text-muted">
                  {row.membership_count > 0 ? row.membership_count : "—"}
                </Td>
                <Td>
                  <StatusPill disabledAt={row.disabled_at} />
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/super/users/${row.id}`}
                    className="text-accent hover:underline text-sm"
                  >
                    Manage →
                  </Link>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {q ? "No users match that search." : "No users."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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

function StatusPill({ disabledAt }: { disabledAt: string | null }) {
  if (disabledAt) {
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
