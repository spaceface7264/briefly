import { Filter, MoreHorizontal, Plus, Search } from "lucide-react";

/**
 * Marketing-only browser frame showing the org-side admin briefs table:
 * a publish-ready list with status pills, claim counts, escrow values,
 * and deadlines. Mock data, decoupled from the database types.
 *
 * Visual language stays inside the existing token system so the preview
 * feels like the live product, not a stylized illustration.
 */

interface SampleRow {
  title: string;
  status: "Published" | "Reviewing" | "Draft";
  claims: string;
  budgetDkk: number;
  payoutDkk: number;
  deadline: string;
}

const rows: SampleRow[] = [
  {
    title: "Sourdough launch — three vertical cuts",
    status: "Published",
    claims: "2 / 3",
    budgetDkk: 5400,
    payoutDkk: 1800,
    deadline: "Jun 04",
  },
  {
    title: "Single-origin Ethiopia, kitchen shots",
    status: "Reviewing",
    claims: "1 / 1",
    budgetDkk: 1200,
    payoutDkk: 1200,
    deadline: "May 27",
  },
  {
    title: "Opening night at the new climbing wall",
    status: "Published",
    claims: "3 / 4",
    budgetDkk: 9600,
    payoutDkk: 2400,
    deadline: "Jun 11",
  },
  {
    title: "Summer menu walkthrough",
    status: "Draft",
    claims: "—",
    budgetDkk: 0,
    payoutDkk: 1600,
    deadline: "Jul 02",
  },
];

const statusPill: Record<SampleRow["status"], string> = {
  Published:
    "border-success-ink/30 bg-success/10 text-success-ink",
  Reviewing: "border-info-ink/30 bg-info/10 text-info-ink",
  Draft: "border-border bg-surface text-muted",
};

const statusDot: Record<SampleRow["status"], string> = {
  Published: "bg-success-ink",
  Reviewing: "bg-info-ink",
  Draft: "bg-muted",
};

function formatDkk(n: number): string {
  return new Intl.NumberFormat("da-DK").format(n);
}

interface AdminPreviewProps {
  /**
   * "default" renders the full 4-row dashboard at hero scale.
   * "compact" renders a 2-row variant for use as a secondary preview
   * inside a side column.
   */
  variant?: "default" | "compact";
}

export function AdminPreview({ variant = "default" }: AdminPreviewProps) {
  const visibleRows = variant === "compact" ? rows.slice(0, 2) : rows;
  const isCompact = variant === "compact";

  return (
    <div className="relative w-full">
      {/* subtle ground shadow */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-10 bottom-0 h-24 rounded-[50%] bg-brand/15 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="
          relative rounded-2xl border border-border-strong/80
          bg-surface/80 backdrop-blur
          shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_2px_0_0_rgba(255,255,255,0.04)_inset]
          overflow-hidden
        "
      >
        {/* browser chrome */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background/60">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-border-strong/70" />
            <span className="size-2.5 rounded-full bg-border-strong/70" />
            <span className="size-2.5 rounded-full bg-border-strong/70" />
          </div>
          <div className="flex-1 mx-2 px-3 py-1 rounded-md bg-surface border border-border text-[10.5px] font-mono text-muted tracking-tight truncate">
            briefly.app/admin/briefs
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Admin
          </span>
        </div>

        {/* page header */}
        <div className={`flex items-center justify-between gap-4 ${isCompact ? "px-4 pt-4 pb-3" : "px-6 pt-6 pb-4"}`}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted mb-1.5">
              Nordbak / Briefs
            </p>
            <h4 className={`font-display font-bold tracking-tight text-foreground ${isCompact ? "text-base" : "text-xl"}`}>
              Briefs
            </h4>
          </div>
          <div className="flex items-center gap-2">
            {!isCompact && (
              <span className="hidden sm:inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background/60 px-3 text-xs text-muted">
                <Search className="size-3" />
                Search
              </span>
            )}
            {!isCompact && (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 text-xs text-muted">
                <Filter className="size-3" />
                All status
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-full bg-brand font-semibold text-on-brand ${isCompact ? "h-6 px-2 text-[10px]" : "h-8 px-3 text-xs"}`}>
              <Plus className={isCompact ? "size-2.5" : "size-3"} />
              New brief
            </span>
          </div>
        </div>

        {/* table */}
        <div className={isCompact ? "px-2 pb-3" : "px-2 pb-4"}>
          <div className="rounded-xl border border-border overflow-hidden">
            <div
              className={`
                grid ${isCompact ? "grid-cols-[minmax(0,1fr)_82px_70px]" : "grid-cols-[minmax(0,1fr)_92px_88px_110px_82px_36px]"}
                gap-3 ${isCompact ? "px-3 py-1.5" : "px-4 py-2"}
                bg-background/60 border-b border-border
                font-mono ${isCompact ? "text-[9px]" : "text-[10px]"} uppercase tracking-[0.18em] text-muted
              `}
            >
              <span>Brief</span>
              <span>Status</span>
              {!isCompact && <span>Claims</span>}
              {!isCompact && <span className="text-right">In escrow</span>}
              <span className="text-right">Due</span>
              {!isCompact && <span />}
            </div>

            <ul className="divide-y divide-border">
              {visibleRows.map((row) => (
                <li
                  key={row.title}
                  className={`
                    grid ${isCompact ? "grid-cols-[minmax(0,1fr)_82px_70px]" : "grid-cols-[minmax(0,1fr)_92px_88px_110px_82px_36px]"}
                    gap-3 ${isCompact ? "px-3 py-2" : "px-4 py-3"}
                    items-center
                    bg-surface/40
                  `}
                >
                  <span className={`truncate text-foreground font-medium ${isCompact ? "text-[11px]" : "text-[12.5px]"}`}>
                    {row.title}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2 py-0.5 font-mono uppercase tracking-[0.12em] ${isCompact ? "text-[8.5px]" : "text-[9.5px]"} ${statusPill[row.status]}`}
                  >
                    <span
                      className={`size-1 rounded-full ${statusDot[row.status]}`}
                    />
                    {row.status}
                  </span>
                  {!isCompact && (
                    <span className="text-[11.5px] font-mono text-text-secondary">
                      {row.claims}
                    </span>
                  )}
                  {!isCompact && (
                    <span className="value-text text-right text-[12px] font-semibold text-foreground">
                      {row.budgetDkk === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <>
                          {formatDkk(row.budgetDkk)}{" "}
                          <span className="font-mono text-muted text-[10px]">
                            kr
                          </span>
                        </>
                      )}
                    </span>
                  )}
                  <span className={`value-text text-right font-mono text-text-secondary ${isCompact ? "text-[10px]" : "text-[11px]"}`}>
                    {row.deadline}
                  </span>
                  {!isCompact && (
                    <span className="flex justify-end text-muted">
                      <MoreHorizontal className="size-3.5" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* footer summary */}
          {!isCompact && (
            <div className="mt-3 px-2 flex items-center justify-between text-[11px] text-muted font-mono">
              <span>4 briefs · 6 active slots</span>
              <span>
                In escrow{" "}
                <span className="value-text font-semibold text-foreground">
                  16 200 kr
                </span>
              </span>
            </div>
          )}
        </div>

        {/* fade-to-bg at the bottom so the table reads as continuing */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface/80 to-transparent"
        />
      </div>
    </div>
  );
}
