import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatFeeBp, resolveOrgPricing } from "@/lib/pricing";

export const dynamic = "force-dynamic";

interface OrgListRow {
  id: string;
  name: string;
  slug: string;
  discoverable: boolean;
  fee_bp: number;
  plan_name: string;
  override_count: number;
  source: string;
}

export default async function SuperOrgsPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, slug, discoverable")
    .order("name", { ascending: true });

  const rows: OrgListRow[] = await Promise.all(
    (orgs ?? []).map(async (org) => {
      const pricing = await resolveOrgPricing(supabase, org.id);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        discoverable: org.discoverable ?? false,
        fee_bp: pricing.fee_bp,
        plan_name: pricing.plan?.name ?? "—",
        override_count: pricing.applied_overrides.length,
        source: pricing.source,
      };
    })
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Organisations</h1>
          <p className="text-muted">
            {rows.length} org{rows.length === 1 ? "" : "s"}. Click into one to
            grant overrides.
          </p>
        </div>
        <Link
          href="/admin/super/orgs/new"
          className="px-4 py-2 bg-accent text-background font-semibold rounded-lg hover:bg-accent-hover transition-colors text-sm whitespace-nowrap"
        >
          + Create org
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-surface-raised text-left">
            <tr>
              <Th>Name</Th>
              <Th>Plan</Th>
              <Th>Effective fee</Th>
              <Th>Overrides</Th>
              <Th>Discoverable</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <Td>
                  <p className="font-medium">{row.name}</p>
                  <p className="font-mono text-xs text-muted">{row.slug}</p>
                </Td>
                <Td>{row.plan_name}</Td>
                <Td>
                  <span
                    className={
                      row.source === "free_default"
                        ? "text-muted"
                        : "text-accent font-medium"
                    }
                  >
                    {formatFeeBp(row.fee_bp)}
                  </span>
                </Td>
                <Td className="text-muted">
                  {row.override_count > 0 ? row.override_count : "—"}
                </Td>
                <Td className="text-muted">{row.discoverable ? "Yes" : "No"}</Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/super/orgs/${row.id}`}
                    className="text-accent hover:underline text-sm"
                  >
                    Manage →
                  </Link>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No organisations.
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
