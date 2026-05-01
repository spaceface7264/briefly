"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { categoryLabel, durationClassLabel, formatPrice } from "@/lib/utils";
import type { Brief, BriefStatus } from "@/types/database";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import { type ColumnKey } from "./columns-dropdown";
import {
  badgeToneByCategory,
  badgeToneByDurationClass,
  badgeToneByFundedStatus,
  badgeToneByStatus,
  fundedStatusLabel,
} from "@/lib/admin-badge-tones";
import type { BriefFundedStatus } from "@/types/database";

type SortField = "created_at" | "title" | "price_dkk";
type SortOrder = "asc" | "desc";
type StatusFilter = "all" | "open" | "claimed" | "archived";
type AdFilter = "all" | "ad" | "non_ad";

const PAGE_SIZE = 10;
const DEFAULT_COLUMNS: ColumnKey[] = [
  "category",
  "duration",
  "price",
  "claims",
  "status",
  "created",
  "actions",
];

type BriefWithCount = Brief & { activeClaimCount: number };

function FundedBadge({ status }: { status: BriefFundedStatus | null }) {
  if (!status || status === "unfunded") return null;
  const tone = badgeToneByFundedStatus[status];
  const label = fundedStatusLabel[status];
  if (!tone || !label) return null;
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${tone}`}>
      {label}
    </span>
  );
}

function SortIcon({ activeOrder }: { activeOrder?: SortOrder }) {
  if (activeOrder === "asc") return <ArrowUpIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  if (activeOrder === "desc") return <ArrowDownIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  return <ArrowUpDownIcon className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />;
}

export function AdminBriefsClient({ briefs }: { briefs: BriefWithCount[] }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [durationFilter, setDurationFilter] = useState<Brief["duration_class"] | "all">("all");
  const [adFilter, setAdFilter] = useState<AdFilter>("all");
  const [q, setQ] = useState("");
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS));

  const statusCounts = useMemo(() => ({
    all: briefs.length,
    open: briefs.filter((b) => b.status === "open").length,
    claimed: briefs.filter((b) => b.status === "claimed").length,
    archived: briefs.filter((b) => b.status === "archived").length,
  }), [briefs]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let rows = briefs.filter((brief) => {
      if (statusFilter !== "all" && brief.status !== statusFilter) return false;
      if (durationFilter !== "all" && brief.duration_class !== durationFilter) return false;
      if (adFilter === "ad" && !brief.is_ad_intended) return false;
      if (adFilter === "non_ad" && brief.is_ad_intended) return false;
      if (term && !`${brief.title} ${brief.location || ""}`.toLowerCase().includes(term)) return false;
      return true;
    });

    if (sortField && sortOrder) {
      rows = [...rows].sort((a, b) => {
        let cmp = 0;
        if (sortField === "title") cmp = a.title.localeCompare(b.title);
        if (sortField === "price_dkk") cmp = a.price_dkk - b.price_dkk;
        if (sortField === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortOrder === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [briefs, statusFilter, durationFilter, adFilter, q, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const animationKey = `${statusFilter}|${durationFilter}|${adFilter}|${q}|${sortField || "none"}|${sortOrder || "none"}|${safePage}`;

  function cycleSort(field: SortField) {
    setPage(1);
    if (sortField !== field) {
      setSortField(field);
      setSortOrder("asc");
      return;
    }
    if (sortOrder === "asc") {
      setSortOrder("desc");
      return;
    }
    setSortField(undefined);
    setSortOrder(undefined);
  }

  function toggleColumn(col: ColumnKey) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      if (next.size === 0) return new Set(DEFAULT_COLUMNS);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "open", "claimed", "archived"] as StatusFilter[]).map((status) => {
          const colorDotStyles: Record<StatusFilter, string> = {
            all: "bg-muted",
            open: "bg-success",
            claimed: "bg-accent",
            archived: "bg-muted",
          };
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setPage(1); }}
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface-raised text-foreground border-border-strong"
                  : "bg-surface border-border text-foreground hover:border-brand/40"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${colorDotStyles[status]}`} />
                {status === "all" ? "All" : status[0].toUpperCase() + status.slice(1)} ({statusCounts[status]})
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="Search title or location..."
          className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <select
          value={durationFilter}
          onChange={(e) => { setDurationFilter(e.target.value as Brief["duration_class"] | "all"); setPage(1); }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All durations</option>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
          <option value="static">Static</option>
        </select>
        <select
          value={adFilter}
          onChange={(e) => { setAdFilter(e.target.value as AdFilter); setPage(1); }}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="all">All brief types</option>
          <option value="ad">Intended for ads</option>
          <option value="non_ad">Organic only</option>
        </select>

        <details className="relative ml-auto">
          <summary className="list-none cursor-pointer px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors">
            Columns
          </summary>
          <div className="absolute right-0 mt-2 z-10 min-w-56 rounded-lg border border-border bg-surface p-3 shadow-lg space-y-2">
            {DEFAULT_COLUMNS.map((column) => (
              <label key={column} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column)}
                  onChange={() => toggleColumn(column)}
                  className="accent-accent"
                />
                <span className="capitalize">{column}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      {paginated.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  <button onClick={() => cycleSort("title")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                    Title
                    <SortIcon activeOrder={sortField === "title" ? sortOrder : undefined} />
                  </button>
                </th>
                {visibleColumns.has("category") && <th className="text-left text-sm font-medium text-muted px-4 py-3">Category</th>}
                {visibleColumns.has("duration") && <th className="text-left text-sm font-medium text-muted px-4 py-3">Duration</th>}
                {visibleColumns.has("price") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">
                    <button onClick={() => cycleSort("price_dkk")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      Price
                      <SortIcon activeOrder={sortField === "price_dkk" ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {visibleColumns.has("claims") && <th className="text-left text-sm font-medium text-muted px-4 py-3">Claims</th>}
                {visibleColumns.has("status") && <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>}
                {visibleColumns.has("created") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">
                    <button onClick={() => cycleSort("created_at")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      Created
                      <SortIcon activeOrder={sortField === "created_at" ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {visibleColumns.has("actions") && <th className="text-right text-sm font-medium text-muted px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody key={animationKey} className="animate-stagger-in">
              {paginated.map((brief) => (
                <tr key={brief.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/admin/briefs/${brief.id}`} className="font-medium hover:text-accent">{brief.title}</Link>
                    {brief.location && <p className="mt-0.5 text-muted text-sm">{brief.location}</p>}
                  </td>
                  {visibleColumns.has("category") && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${badgeToneByCategory[brief.category]}`}>
                          {categoryLabel(brief.category)}
                        </span>
                        {brief.is_ad_intended && (
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[11px] font-medium">
                            Ad
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  {visibleColumns.has("duration") && (
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${badgeToneByDurationClass[brief.duration_class]}`}>
                        {durationClassLabel(brief.duration_class)}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("price") && <td className="px-4 py-3 text-sm">{formatPrice(brief.price_dkk)}</td>}
                  {visibleColumns.has("claims") && <td className="px-4 py-3 text-sm">{brief.activeClaimCount} / {brief.claim_limit}</td>}
                  {visibleColumns.has("status") && (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${badgeToneByStatus[brief.status as BriefStatus]}`}>
                          {brief.status}
                        </span>
                        <FundedBadge status={brief.funded_status as BriefFundedStatus | null} />
                      </div>
                    </td>
                  )}
                  {visibleColumns.has("created") && <td className="px-4 py-3 text-muted text-sm">{new Date(brief.created_at).toLocaleDateString("en-GB")}</td>}
                  {visibleColumns.has("actions") && (
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/briefs/${brief.id}`} className="text-accent hover:underline text-sm">Edit</Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-surface border border-border rounded-xl">
          <p className="text-muted mb-4">No briefs found for the current filters</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted">Page {safePage} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-2 rounded-lg border text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 border-border hover:border-accent/50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-2 rounded-lg border text-sm transition-colors disabled:pointer-events-none disabled:opacity-50 border-border hover:border-accent/50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
