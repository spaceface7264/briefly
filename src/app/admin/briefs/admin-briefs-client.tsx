"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { ConfirmDialog } from "@/components/modal";
import { Checkbox } from "@/components/ui/checkbox";
import {
  archiveBriefsBulk,
  deleteBriefsBulk,
  reopenBriefsBulk,
  type BulkBriefResult,
} from "./actions";

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

type BriefWithCount = Brief & {
  activeClaimCount: number;
  totalClaimCount: number;
};

type BulkAction = "archive" | "reopen" | "delete";

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

export function AdminBriefsClient({
  briefs,
  canBulkEdit = false,
}: {
  briefs: BriefWithCount[];
  /** Org admins move money (refunds) and can hard-delete; members
   * can browse but the bulk-edit toolbar is hidden for them. */
  canBulkEdit?: boolean;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [durationFilter, setDurationFilter] = useState<Brief["duration_class"] | "all">("all");
  const [adFilter, setAdFilter] = useState<AdFilter>("all");
  const [q, setQ] = useState("");
  const [sortField, setSortField] = useState<SortField | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [working, startBulkTransition] = useTransition();

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

  const briefsById = useMemo(() => {
    const map = new Map<string, BriefWithCount>();
    for (const b of briefs) map.set(b.id, b);
    return map;
  }, [briefs]);

  // Derive selection from the live brief list so a server refresh
  // that removes rows (e.g. bulk delete) drops stale ids from the
  // active count without needing to write back into selectedIds in
  // an effect. Anything that survives in selectedIds but not in
  // briefsById is treated as gone — bulk actions clearSelection() on
  // completion anyway, so the only path that hits this is a router
  // refresh racing the user.
  const selectedBriefs = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => briefsById.get(id))
        .filter((b): b is BriefWithCount => Boolean(b)),
    [selectedIds, briefsById]
  );
  const selectedCount = selectedBriefs.length;
  const archivableCount = selectedBriefs.filter((b) => b.status !== "archived").length;
  const reopenableCount = selectedBriefs.filter(
    (b) => b.status === "archived" && b.funded_status !== "refunded"
  ).length;
  const deletableBriefs = selectedBriefs.filter((b) => b.totalClaimCount === 0);
  const deletableCount = deletableBriefs.length;

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // After a bulk action: refresh server data and surface a summary
  // toast. "Mostly succeeded" cases get a sticky toast listing the
  // first few failures so admins know what didn't go through.
  function handleBulkResult(
    action: BulkAction,
    target: number,
    result: BulkBriefResult | { ok: false; error: string }
  ) {
    if (!result.ok) {
      toast.error("Couldn't run bulk action", { description: result.error });
      return;
    }
    const verbPast: Record<BulkAction, string> = {
      archive: "Archived",
      reopen: "Reopened",
      delete: "Deleted",
    };
    const noun = result.succeeded === 1 ? "brief" : "briefs";
    if (result.failed.length === 0) {
      toast.success(`${verbPast[action]} ${result.succeeded} ${noun}`);
    } else if (result.succeeded === 0) {
      toast.error(
        `Couldn't ${action} ${target === 1 ? "the brief" : `any of the ${target} briefs`}`,
        {
          description: summarizeFailures(result.failed, briefsById),
          duration: 8000,
        }
      );
    } else {
      toast.warning(
        `${verbPast[action]} ${result.succeeded} of ${target} ${target === 1 ? "brief" : "briefs"}`,
        {
          description: summarizeFailures(result.failed, briefsById),
          duration: 8000,
        }
      );
    }
    clearSelection();
    router.refresh();
  }

  function runBulk(action: BulkAction) {
    const ids = (() => {
      if (action === "archive") {
        return selectedBriefs
          .filter((b) => b.status !== "archived")
          .map((b) => b.id);
      }
      if (action === "reopen") {
        return selectedBriefs
          .filter((b) => b.status === "archived" && b.funded_status !== "refunded")
          .map((b) => b.id);
      }
      return deletableBriefs.map((b) => b.id);
    })();

    if (ids.length === 0) {
      setPendingAction(null);
      return;
    }

    startBulkTransition(async () => {
      let result: BulkBriefResult | { ok: false; error: string };
      if (action === "archive") result = await archiveBriefsBulk(ids);
      else if (action === "reopen") result = await reopenBriefsBulk(ids);
      else result = await deleteBriefsBulk(ids);
      setPendingAction(null);
      handleBulkResult(action, ids.length, result);
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

      {canBulkEdit && selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          archivableCount={archivableCount}
          reopenableCount={reopenableCount}
          deletableCount={deletableCount}
          working={working}
          onAction={(action) => setPendingAction(action)}
          onClear={clearSelection}
        />
      )}

      {paginated.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {canBulkEdit && (
                  <th className="w-10 px-4 py-3">
                    <SelectAllCheckbox
                      pageBriefs={paginated}
                      selectedIds={selectedIds}
                      onTogglePage={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          for (const b of paginated) {
                            if (checked) next.add(b.id);
                            else next.delete(b.id);
                          }
                          return next;
                        });
                      }}
                    />
                  </th>
                )}
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
              {paginated.map((brief) => {
                const isSelected = selectedIds.has(brief.id);
                return (
                <tr
                  key={brief.id}
                  className={`border-b border-border last:border-0 hover:bg-surface-hover ${
                    isSelected ? "bg-accent-muted/40" : ""
                  }`}
                >
                  {canBulkEdit && (
                    <td className="px-4 py-3 align-middle">
                      <Checkbox
                        aria-label={`Select ${brief.title}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleSelect(brief.id, checked === true)
                        }
                      />
                    </td>
                  )}
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
                );
              })}
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

      <ConfirmDialog
        open={pendingAction === "archive"}
        onClose={() => !working && setPendingAction(null)}
        onConfirm={() => runBulk("archive")}
        title={
          archivableCount === 1
            ? "Archive this brief?"
            : `Archive ${archivableCount} briefs?`
        }
        description={
          archivableCount === 0
            ? "None of the selected briefs can be archived."
            : `Held escrow on funded briefs will be refunded to the org's saved card. ${
                selectedCount - archivableCount > 0
                  ? `${selectedCount - archivableCount} already-archived ${
                      selectedCount - archivableCount === 1 ? "brief" : "briefs"
                    } in the selection will be skipped.`
                  : ""
              }`.trim()
        }
        confirmLabel={archivableCount === 0 ? "Close" : "Archive"}
        tone="danger"
        loading={working}
      />

      <ConfirmDialog
        open={pendingAction === "reopen"}
        onClose={() => !working && setPendingAction(null)}
        onConfirm={() => runBulk("reopen")}
        title={
          reopenableCount === 1
            ? "Reopen this brief?"
            : `Reopen ${reopenableCount} briefs?`
        }
        description={
          reopenableCount === 0
            ? "None of the selected briefs can be reopened. Refunded briefs need to be republished from scratch."
            : `${
                selectedCount - reopenableCount > 0
                  ? `${selectedCount - reopenableCount} ineligible ${
                      selectedCount - reopenableCount === 1 ? "brief" : "briefs"
                    } in the selection will be skipped (already open or refunded).`
                  : "Selected briefs will be visible to creators again."
              }`
        }
        confirmLabel={reopenableCount === 0 ? "Close" : "Reopen"}
        tone="brand"
        loading={working}
      />

      <ConfirmDialog
        open={pendingAction === "delete"}
        onClose={() => !working && setPendingAction(null)}
        onConfirm={() => runBulk("delete")}
        title={
          deletableCount === 1
            ? "Delete this brief?"
            : `Delete ${deletableCount} briefs?`
        }
        description={
          deletableCount === 0
            ? "None of the selected briefs can be deleted. Briefs with any claim history must be archived instead."
            : `This permanently removes ${
                deletableCount === 1 ? "the brief" : "the briefs"
              } and refunds any held escrow. This cannot be undone.${
                selectedCount - deletableCount > 0
                  ? ` ${selectedCount - deletableCount} ${
                      selectedCount - deletableCount === 1 ? "brief" : "briefs"
                    } with claims in the selection will be skipped.`
                  : ""
              }`
        }
        confirmLabel={deletableCount === 0 ? "Close" : "Delete permanently"}
        tone="danger"
        loading={working}
      />
    </div>
  );
}

function BulkActionBar({
  selectedCount,
  archivableCount,
  reopenableCount,
  deletableCount,
  working,
  onAction,
  onClear,
}: {
  selectedCount: number;
  archivableCount: number;
  reopenableCount: number;
  deletableCount: number;
  working: boolean;
  onAction: (action: BulkAction) => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent-muted/40 px-4 py-3">
      <span className="text-sm font-medium">
        {selectedCount} selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onAction("reopen")}
          disabled={working || reopenableCount === 0}
          title={
            reopenableCount === 0
              ? "Select archived briefs to reopen"
              : `Reopen ${reopenableCount} of ${selectedCount}`
          }
          className="px-3 py-1.5 text-sm font-medium border border-border bg-surface hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Reopen
          {reopenableCount > 0 && reopenableCount !== selectedCount && (
            <span className="ml-1.5 text-xs text-muted">({reopenableCount})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onAction("archive")}
          disabled={working || archivableCount === 0}
          title={
            archivableCount === 0
              ? "Selected briefs are already archived"
              : `Archive ${archivableCount} of ${selectedCount}`
          }
          className="px-3 py-1.5 text-sm font-medium border border-border bg-surface hover:border-accent/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Archive
          {archivableCount > 0 && archivableCount !== selectedCount && (
            <span className="ml-1.5 text-xs text-muted">({archivableCount})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onAction("delete")}
          disabled={working || deletableCount === 0}
          title={
            deletableCount === 0
              ? "Briefs with claim history cannot be deleted — archive instead"
              : deletableCount < selectedCount
                ? `Delete ${deletableCount} of ${selectedCount} (others have claims)`
                : `Delete ${deletableCount}`
          }
          className="px-3 py-1.5 text-sm font-medium border border-error/40 text-error bg-surface hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Delete
          {deletableCount > 0 && deletableCount !== selectedCount && (
            <span className="ml-1.5 text-xs">({deletableCount})</span>
          )}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={working}
          className="px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function SelectAllCheckbox({
  pageBriefs,
  selectedIds,
  onTogglePage,
}: {
  pageBriefs: BriefWithCount[];
  selectedIds: Set<string>;
  onTogglePage: (checked: boolean) => void;
}) {
  const selectedOnPage = pageBriefs.filter((b) => selectedIds.has(b.id)).length;
  const allSelected = pageBriefs.length > 0 && selectedOnPage === pageBriefs.length;
  const someSelected = selectedOnPage > 0 && !allSelected;

  // Base UI Checkbox handles `indeterminate` natively as a prop, so
  // the partial-selection visual no longer needs an imperative
  // ref + effect to set the underlying input's indeterminate
  // property. Clicking while indeterminate fires onCheckedChange
  // with `true`, which selects every row on the current page.
  return (
    <Checkbox
      aria-label="Select all on page"
      checked={allSelected}
      indeterminate={someSelected}
      onCheckedChange={(checked) => onTogglePage(checked === true)}
    />
  );
}

// Render a compact failure summary for the partial-success toast.
// Falls back to the raw error count when too many fail to list
// individually.
function summarizeFailures(
  failed: { briefId: string; error: string }[],
  briefsById: Map<string, BriefWithCount>
): string {
  if (failed.length === 0) return "";
  const sample = failed.slice(0, 3).map((f) => {
    const title = briefsById.get(f.briefId)?.title ?? "Brief";
    return `${title}: ${f.error}`;
  });
  const overflow = failed.length - sample.length;
  return overflow > 0
    ? `${sample.join(" • ")} • +${overflow} more`
    : sample.join(" • ");
}
