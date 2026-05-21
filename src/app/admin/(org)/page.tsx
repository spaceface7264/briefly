import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { getAccountType } from "@/lib/account";
import { getSupportOrg } from "@/lib/platform";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { claimStatusLabel } from "@/lib/admin-badge-tones";
import type { BriefCategory, ClaimStatus } from "@/types/database";
import { formatPrice } from "@/lib/utils";

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Platform admins without a support session belong on the platform
  // shell. With a support session they land here acting as the org
  // they entered support mode for, so let the request fall through.
  const accountType = await getAccountType(supabase);
  if (accountType === "platform") {
    const support = await getSupportOrg(supabase);
    if (!support) redirect("/admin/super");
  }

  const orgId = await requireActiveOrg(supabase);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [
    totalBriefsResult,
    openBriefsResult,
    activeClaimsResult,
    pendingResult,
  ] = await Promise.all([
    supabase
      .from("briefs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("briefs")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "open"),
    (supabase.from("claims") as any)
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active"),
    (supabase.from("claims") as any)
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "submitted"),
  ]);

  const totalBriefs = totalBriefsResult.count ?? 0;
  const openBriefsCount = openBriefsResult.count ?? 0;
  const activeClaimsCount = activeClaimsResult.count ?? 0;
  const pendingCount = pendingResult.count ?? 0;

  const [
    { data: openBriefsRaw },
    { data: escrowRows },
    { data: recentClaims },
  ] = await Promise.all([
    supabase
      .from("briefs")
      .select(
        "id, title, price_dkk, claim_limit, category, escrow_held_dkk, created_at",
      )
      .eq("org_id", orgId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("briefs")
      .select("escrow_held_dkk")
      .eq("org_id", orgId)
      .in("funded_status", ["funded", "partially_released"]),
    (supabase.from("claims") as any)
      .select(
        "id, status, claimed_at, brief_id, brief:briefs(title), creator:profiles(name, email)",
      )
      .eq("org_id", orgId)
      .order("claimed_at", { ascending: false })
      .limit(6),
  ]);

  // Per-brief slot fill for the running list. A second roundtrip
  // keeps the query simple and avoids supabase-js embed-filter syntax.
  const briefIds = (openBriefsRaw ?? []).map((b: any) => b.id);
  const claimsByBrief: Record<string, number> = {};
  if (briefIds.length > 0) {
    const { data: claimRows } = await (supabase.from("claims") as any)
      .select("brief_id")
      .in("brief_id", briefIds)
      .neq("status", "cancelled");
    for (const row of (claimRows ?? []) as Array<{ brief_id: string }>) {
      claimsByBrief[row.brief_id] = (claimsByBrief[row.brief_id] ?? 0) + 1;
    }
  }

  const escrowSum = (escrowRows ?? []).reduce(
    (s: number, r: any) => s + (r.escrow_held_dkk ?? 0),
    0,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  type Tone = "attention" | "calm" | "empty";
  let tone: Tone;
  let headline: React.ReactNode;
  let subtitle: string | null;

  if (pendingCount > 0) {
    tone = "attention";
    headline = (
      <>
        <span className="text-brand-ink">{pendingCount}</span>{" "}
        {pendingCount === 1 ? "submission" : "submissions"} to review
      </>
    );
    subtitle =
      pendingCount === 1
        ? "A creator is waiting on your decision."
        : "Creators are waiting on your decisions.";
  } else if (totalBriefs === 0) {
    tone = "empty";
    headline = "Nothing running yet";
    subtitle =
      "Publish a brief and creators in your network can start claiming it. Funds sit in escrow until you approve the work.";
  } else if (openBriefsCount === 0) {
    tone = "calm";
    headline = "No briefs running";
    subtitle = "Publish a new one to keep momentum.";
  } else {
    tone = "calm";
    headline = "All caught up";
    subtitle = "Nothing waiting on you right now.";
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-12">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
          {today}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          {headline}
        </h1>
        {subtitle && (
          <p className="mt-3 text-base text-text-secondary max-w-prose">
            {subtitle}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {tone === "attention" ? (
            <>
              <Link
                href="/admin/claims?status=submitted"
                className={buttonVariants({ variant: "default", size: "lg" })}
              >
                Review submissions
              </Link>
              <Link
                href="/admin/briefs/new"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                New brief
              </Link>
            </>
          ) : tone === "empty" ? (
            <Link
              href="/admin/briefs/new"
              className={buttonVariants({ variant: "default", size: "lg" })}
            >
              Publish your first brief
            </Link>
          ) : (
            <>
              <Link
                href="/admin/briefs/new"
                className={buttonVariants({ variant: "default", size: "lg" })}
              >
                New brief
              </Link>
              <Link
                href="/admin/briefs"
                className={buttonVariants({ variant: "ghost", size: "lg" })}
              >
                View all briefs
              </Link>
            </>
          )}
        </div>
      </header>

      {totalBriefs > 0 && (
        <div className="mb-12 pb-8 border-b border-border flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <Kpi
            label="Open briefs"
            value={openBriefsCount.toLocaleString("en-GB")}
          />
          <Kpi
            label="Escrow held"
            value={`${escrowSum.toLocaleString("en-GB")} DKK`}
          />
          <Kpi
            label="Active claims"
            value={activeClaimsCount.toLocaleString("en-GB")}
          />
        </div>
      )}

      {totalBriefs > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-12">
          <section className="lg:col-span-3">
            <SectionHeader title="Running briefs" href="/admin/briefs" />
            {(openBriefsRaw ?? []).length > 0 ? (
              <ul className="divide-y divide-border">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(openBriefsRaw ?? []).map((b: any) => {
                  const filled = claimsByBrief[b.id] ?? 0;
                  const pct =
                    b.claim_limit > 0
                      ? Math.min(100, (filled / b.claim_limit) * 100)
                      : 0;
                  return (
                    <li key={b.id} className="py-4 first:pt-0 last:pb-0">
                      <Link
                        href={`/admin/briefs/${b.id}`}
                        className="group block"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`size-1.5 rounded-full shrink-0 ${categoryDot(b.category)}`}
                              aria-hidden
                            />
                            <h3 className="truncate text-base text-foreground group-hover:text-brand-ink transition-colors">
                              {b.title}
                            </h3>
                          </div>
                          <span className="value-text text-sm text-foreground shrink-0">
                            {formatPrice(b.price_dkk)}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-3">
                          <div
                            className="relative h-1 flex-1 rounded-full bg-surface-raised overflow-hidden"
                            role="progressbar"
                            aria-valuenow={filled}
                            aria-valuemin={0}
                            aria-valuemax={b.claim_limit}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-brand rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="value-text text-xs text-muted shrink-0">
                            {filled}/{b.claim_limit}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                No open briefs. Publish a new one to get started.
              </p>
            )}
          </section>

          <section className="lg:col-span-2">
            <SectionHeader title="Recent activity" href="/admin/claims" />
            {(recentClaims ?? []).length > 0 ? (
              <ul className="space-y-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(recentClaims ?? []).map((c: any) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 size-1.5 rounded-full shrink-0 ${claimStatusDot(c.status as ClaimStatus)}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground leading-snug">
                        <span className="text-text-secondary">
                          {c.creator?.name || c.creator?.email || "Unknown"}
                        </span>
                        <span className="text-muted"> · </span>
                        <Link
                          href={`/admin/briefs/${c.brief_id}`}
                          className="hover:text-brand-ink transition-colors"
                        >
                          {c.brief?.title || "Unknown brief"}
                        </Link>
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {claimStatusLabel[c.status as ClaimStatus]}
                        <span> · </span>
                        {formatRelative(c.claimed_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No activity yet.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="value-text text-2xl text-foreground">{value}</p>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between mb-5">
      <h2 className="font-display text-xl font-semibold text-foreground">
        {title}
      </h2>
      <Link
        href={href}
        className="text-xs text-muted hover:text-foreground transition-colors"
      >
        View all
      </Link>
    </div>
  );
}

const CATEGORY_DOT: Record<BriefCategory, string> = {
  ad: "bg-warning-ink",
  event: "bg-info-ink",
  guide: "bg-success-ink",
  entertaining: "bg-[#EC4899]",
  community: "bg-[#A855F7]",
};

function categoryDot(c: BriefCategory): string {
  return CATEGORY_DOT[c] ?? "bg-muted";
}

const CLAIM_STATUS_DOT: Record<ClaimStatus, string> = {
  active: "bg-brand-ink",
  submitted: "bg-info-ink",
  revision_requested: "bg-warning-ink",
  approved: "bg-success-ink",
  paid: "bg-success-ink",
  cancelled: "bg-muted",
};

function claimStatusDot(s: ClaimStatus): string {
  return CLAIM_STATUS_DOT[s] ?? "bg-muted";
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
