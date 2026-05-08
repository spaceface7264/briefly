import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDkk, formatFeeBp } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function SuperOverviewPage() {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  const sinceIso = thirtyDaysAgo.toISOString();

  const [
    { count: orgCount },
    { count: activeOverrideCount },
    { data: payouts30d },
    { data: plans },
  ] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase
      .from("pricing_overrides")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("payments")
      .select("platform_fee_dkk, gross_dkk, status, created_at")
      .eq("status", "succeeded")
      .gte("created_at", sinceIso),
    supabase
      .from("pricing_plans")
      .select(
        "slug, name, default_fee_bp, monthly_price_dkk, annual_price_dkk, visible, legacy"
      ),
  ]);

  const feeRevenue30d = (payouts30d ?? []).reduce(
    (sum, p) => sum + (p.platform_fee_dkk ?? 0),
    0
  );
  const grossPayouts30d = (payouts30d ?? []).reduce(
    (sum, p) => sum + (p.gross_dkk ?? 0),
    0
  );

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Overview</h1>
      <p className="text-muted mb-8">
        Platform-wide pricing state. Numbers are last 30 days.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Stat label="Organisations" value={orgCount ?? 0} />
        <Stat label="Active overrides" value={activeOverrideCount ?? 0} />
        <Stat label="Take-rate revenue" value={formatDkk(feeRevenue30d)} />
        <Stat label="Gross payouts" value={formatDkk(grossPayouts30d)} />
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Plan catalogue</h2>
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised">
              <tr className="text-left">
                <Th>Slug</Th>
                <Th>Name</Th>
                <Th>Take rate</Th>
                <Th>Monthly</Th>
                <Th>Annual</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(plans ?? []).map((p) => (
                <tr key={p.slug} className="border-t border-border">
                  <Td className="font-mono">{p.slug}</Td>
                  <Td>{p.name}</Td>
                  <Td>{formatFeeBp(p.default_fee_bp)}</Td>
                  <Td>{formatDkk(p.monthly_price_dkk)}</Td>
                  <Td>{formatDkk(p.annual_price_dkk)}</Td>
                  <Td className="text-muted">
                    {p.legacy ? "Legacy" : p.visible ? "Live" : "Hidden"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-3">
          Plans are edited via SQL until Phase 3 ships the management UI:
          {" "}
          <code className="font-mono">UPDATE pricing_plans SET … WHERE slug = &apos;…&apos;</code>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Quick links</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/admin/super/orgs" className="text-accent hover:underline">
              All organisations →
            </Link>
            {" "}grant fee waivers, comp plans, raise limits.
          </li>
          <li>
            <Link href="/admin/super/audit" className="text-accent hover:underline">
              Audit log →
            </Link>
            {" "}every grant and revoke.
          </li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
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
