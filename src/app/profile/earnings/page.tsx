import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireCreatorAccount } from "@/lib/account";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  status: string;
  amount_dkk: number | null;
  total_dkk: number | null;
  gross_dkk: number | null;
  platform_fee_dkk: number | null;
  invoice_number: string | null;
  invoice_issued_at: string | null;
  created_at: string;
  org_id: string;
  org: { id: string; name: string } | null;
  claim: {
    id: string;
    status: string;
    brief: { id: string; title: string; price_dkk: number } | null;
  } | null;
}

interface PendingClaimRow {
  id: string;
  status: string;
  org_id: string;
  org: { id: string; name: string } | null;
  brief: { id: string; title: string; price_dkk: number } | null;
}

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await requireCreatorAccount(supabase);

  // All payments for this creator (succeeded, pending, failed). The
  // KPI cards filter to succeeded; the table shows all so failed
  // attempts are visible.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments } = await (supabase.from("payments") as any)
    .select(
      "id, status, amount_dkk, total_dkk, gross_dkk, platform_fee_dkk, invoice_number, invoice_issued_at, created_at, org_id, org:organizations(id, name), claim:claims(id, status, brief:briefs(id, title, price_dkk))"
    )
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  // Pending earnings = approved claims that haven't paid out yet.
  // Estimate using gross brief.price_dkk (the actual creator receipt
  // depends on platform fee + VAT resolved at pay time).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingClaims } = await (supabase.from("claims") as any)
    .select(
      "id, status, org_id, org:organizations(id, name), brief:briefs(id, title, price_dkk)"
    )
    .eq("user_id", user.id)
    .eq("status", "approved");

  const succeeded = ((payments ?? []) as PaymentRow[]).filter(
    (p) => p.status === "succeeded"
  );

  const lifetimeEarnedDkk = sumAmounts(succeeded);
  const yearEarnedDkk = sumAmounts(succeeded.filter(isThisYear));
  const monthEarnedDkk = sumAmounts(succeeded.filter(isThisMonth));
  const pendingGrossDkk = ((pendingClaims ?? []) as PendingClaimRow[])
    .map((c) => c.brief?.price_dkk ?? 0)
    .reduce((sum, n) => sum + n, 0);

  // Breakdown by org (succeeded payments only — pending estimates
  // are surfaced separately so the org rollup reflects real receipts).
  const byOrg = aggregateByOrg(succeeded);

  // Last 12 months breakdown for the chart-as-list.
  const byMonth = aggregateByMonth(succeeded, 12);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display tracking-tight text-3xl font-bold mb-2">Earnings</h1>
          <p className="text-muted">
            Your platform receipts across every org you create for. Use
            the CSV export for tax filings.
          </p>
        </div>
        <a
          href="/api/earnings/export.csv"
          className="px-4 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-full transition-colors"
        >
          Download CSV
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        <KpiCard label="Lifetime" amountDkk={lifetimeEarnedDkk} tone="brand" />
        <KpiCard label={`This year (${new Date().getUTCFullYear()})`} amountDkk={yearEarnedDkk} />
        <KpiCard label="This month" amountDkk={monthEarnedDkk} />
        <KpiCard
          label="Pending"
          amountDkk={pendingGrossDkk}
          tone="info"
          hint="Approved claims, not yet paid out. Gross before fee + VAT."
        />
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">By organisation</h2>
        {byOrg.length === 0 ? (
          <EmptyState body="No paid earnings yet — your first invoice will land here." />
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-sm text-muted">
                  <th className="px-4 py-3 font-medium">Organisation</th>
                  <th className="px-4 py-3 font-medium text-right">Payments</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {byOrg.map((row) => (
                  <tr
                    key={row.orgId}
                    className="border-b border-border last:border-0 hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.orgName}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-muted font-mono text-sm">
                      {row.count}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatPrice(row.totalDkk)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Last 12 months</h2>
        {byMonth.every((m) => m.totalDkk === 0) ? (
          <EmptyState body="No monthly history yet." />
        ) : (
          <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
            {byMonth.map((row) => (
              <MonthBar
                key={row.key}
                label={row.label}
                totalDkk={row.totalDkk}
                count={row.count}
                maxDkk={Math.max(...byMonth.map((m) => m.totalDkk), 1)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function KpiCard({
  label,
  amountDkk,
  tone,
  hint,
}: {
  label: string;
  amountDkk: number;
  tone?: "brand" | "info";
  hint?: string;
}) {
  const accent =
    tone === "brand"
      ? "text-accent-ink"
      : tone === "info"
        ? "text-info-ink"
        : "text-foreground";
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <p className="text-xs uppercase tracking-wider text-muted mb-2">{label}</p>
      <p className={`value-text text-2xl font-bold ${accent}`}>
        {formatPrice(amountDkk)}
      </p>
      {hint && <p className="text-[11px] text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

function MonthBar({
  label,
  totalDkk,
  count,
  maxDkk,
}: {
  label: string;
  totalDkk: number;
  count: number;
  maxDkk: number;
}) {
  const widthPct = maxDkk > 0 ? Math.max(2, (totalDkk / maxDkk) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-mono">
          {formatPrice(totalDkk)}{" "}
          {count > 0 && (
            <span className="text-muted text-xs ml-1">
              ({count} {count === 1 ? "payment" : "payments"})
            </span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-background rounded-full overflow-hidden">
        <div
          className="h-full bg-accent/70 rounded-full"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function EmptyState({ body }: { body: string }) {
  return (
    <div className="text-center py-10 bg-surface border border-border rounded-xl">
      <p className="text-muted text-sm">{body}</p>
    </div>
  );
}

// Helpers

function sumAmounts(payments: PaymentRow[]): number {
  return payments.reduce((sum, p) => sum + (p.total_dkk ?? p.amount_dkk ?? 0), 0);
}

function isThisYear(p: PaymentRow): boolean {
  const issued = p.invoice_issued_at ?? p.created_at;
  return new Date(issued).getUTCFullYear() === new Date().getUTCFullYear();
}

function isThisMonth(p: PaymentRow): boolean {
  const issued = p.invoice_issued_at ?? p.created_at;
  const d = new Date(issued);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth()
  );
}

interface OrgRow {
  orgId: string;
  orgName: string;
  count: number;
  totalDkk: number;
}

function aggregateByOrg(payments: PaymentRow[]): OrgRow[] {
  const map = new Map<string, OrgRow>();
  for (const p of payments) {
    const orgId = p.org?.id ?? p.org_id;
    const orgName = p.org?.name ?? "Unknown";
    if (!orgId) continue;
    const cur =
      map.get(orgId) ?? { orgId, orgName, count: 0, totalDkk: 0 };
    cur.count += 1;
    cur.totalDkk += p.total_dkk ?? p.amount_dkk ?? 0;
    map.set(orgId, cur);
  }
  return [...map.values()].sort((a, b) => b.totalDkk - a.totalDkk);
}

interface MonthRow {
  key: string; // YYYY-MM
  label: string; // "Apr 2026"
  count: number;
  totalDkk: number;
}

function aggregateByMonth(payments: PaymentRow[], months: number): MonthRow[] {
  const buckets = new Map<string, MonthRow>();
  // Pre-fill last N months so empty months still show in the chart.
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)
    );
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    buckets.set(key, { key, label, count: 0, totalDkk: 0 });
  }
  for (const p of payments) {
    const issued = p.invoice_issued_at ?? p.created_at;
    const d = new Date(issued);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const cur = buckets.get(key);
    if (!cur) continue; // outside the window
    cur.count += 1;
    cur.totalDkk += p.total_dkk ?? p.amount_dkk ?? 0;
  }
  return [...buckets.values()];
}
