"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { categoryLabel, durationClassLabel, formatPrice } from "@/lib/utils";
import type { Brief, BriefStatus } from "@/types/database";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import {
  badgeToneByCategory,
  badgeToneByDurationClass,
  badgeToneByFundedStatus,
  badgeToneByStatus,
  fundedStatusLabel,
} from "@/lib/admin-badge-tones";
import type { BriefFundedStatus } from "@/types/database";
import { ConfirmDialog } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
type DurationFilter = Brief["duration_class"] | "all";

export type ColumnKey =
  | "category"
  | "duration"
  | "price"
  | "claims"
  | "status"
  | "created"
  | "actions";

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

const COLUMN_LABELS: Record<ColumnKey, string> = {
  category: "Category",
  duration: "Duration",
  price: "Price",
  claims: "Claims",
  status: "Status",
  created: "Created",
  actions: "Actions",
};

const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: "All",
  open: "Open",
  claimed: "Claimed",
  archived: "Archived",
};

// Dot styling for the status filter chips. "Open" pulses to mirror
// the live indicator used elsewhere; the other states are static.
// Counts and labels are paired with the dot so color never carries
// meaning alone.
const STATUS_DOT_CLASS: Record<StatusFilter, string> = {
  all: "bg-muted/70",
  open: "bg-success-ink",
  claimed: "bg-brand-ink",
  archived: "bg-muted/60",
};

const DURATION_OPTIONS: { value: DurationFilter; label: string }[] = [
  { value: "all", label: "All durations" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
  { value: "static", label: "Static" },
];

const AD_OPTIONS: { value: AdFilter; label: string }[] = [
  { value: "all", label: "All brief types" },
  { value: "ad", label: "Intended for ads" },
  { value: "non_ad", label: "Organic only" },
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
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function SortIcon({ activeOrder }: { activeOrder?: SortOrder }) {
  if (activeOrder === "asc") return <ArrowUpIcon className="size-3.5" aria-hidden="true" />;
  if (activeOrder === "desc") return <ArrowDownIcon className="size-3.5" aria-hidden="true" />;
  return <ArrowUpDownIcon className="size-3.5 opacity-60" aria-hidden="true" />;
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
  const [durationFilter, setDurationFilter] = useState<DurationFilter>("all");
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
  const hasNonStatusFilter =
    durationFilter !== "all" || adFilter !== "all" || q.trim().length > 0;

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
      // Never let users hide every column; fall back to defaults if
      // they tried.
      if (next.size === 0) return new Set(DEFAULT_COLUMNS);
      return next;
    });
  }

  function resetFilters() {
    setStatusFilter("all");
    setDurationFilter("all");
    setAdFilter("all");
    setQ("");
    setPage(1);
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
  // briefsById is treated as gone; bulk actions clearSelection() on
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

  const durationLabel =
    DURATION_OPTIONS.find((o) => o.value === durationFilter)?.label ?? "All durations";
  const adLabel = AD_OPTIONS.find((o) => o.value === adFilter)?.label ?? "All brief types";

  return (
    <div>
      {/* Status filter row. Pill-shaped chips that match the rest of
          the design system (rounded-full, brand-tinted on active).
          Each chip pairs its dot with a label and count so colour is
          never the sole signal. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((status) => {
          const isActive = statusFilter === status;
          const count = statusCounts[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              aria-pressed={isActive}
              className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-brand-ink/25 bg-brand-soft text-foreground"
                  : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-foreground"
              }`}
            >
              <span className={`size-2 rounded-full ${STATUS_DOT_CLASS[status]}`} aria-hidden="true" />
              <span>{STATUS_FILTER_LABEL[status]}</span>
              <span
                className={`value-text text-xs ${
                  isActive ? "text-muted" : "text-muted/80"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + filter row. Search owns the left so the eye lands
          there first; the dropdown chips group on the right with the
          columns control. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search title or location"
            aria-label="Search briefs"
            className="pl-7.5"
          />
        </div>

        <FilterChip
          label={durationLabel}
          value={durationFilter}
          options={DURATION_OPTIONS}
          onChange={(v) => {
            setDurationFilter(v);
            setPage(1);
          }}
        />
        <FilterChip
          label={adLabel}
          value={adFilter}
          options={AD_OPTIONS}
          onChange={(v) => {
            setAdFilter(v);
            setPage(1);
          }}
        />

        {hasNonStatusFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="text-muted hover:text-foreground"
          >
            Clear
          </Button>
        )}

        <ColumnsMenu visibleColumns={visibleColumns} onToggle={toggleColumn} />
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
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[640px]">
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <button
                    onClick={() => cycleSort("title")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    Title
                    <SortIcon activeOrder={sortField === "title" ? sortOrder : undefined} />
                  </button>
                </th>
                {visibleColumns.has("category") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                    Category
                  </th>
                )}
                {visibleColumns.has("duration") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                    Duration
                  </th>
                )}
                {visibleColumns.has("price") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                    <button
                      onClick={() => cycleSort("price_dkk")}
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      Price
                      <SortIcon activeOrder={sortField === "price_dkk" ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {visibleColumns.has("claims") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                    Claims
                  </th>
                )}
                {visibleColumns.has("status") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                    Status
                  </th>
                )}
                {visibleColumns.has("created") && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted">
                    <button
                      onClick={() => cycleSort("created_at")}
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      Created
                      <SortIcon activeOrder={sortField === "created_at" ? sortOrder : undefined} />
                    </button>
                  </th>
                )}
                {visibleColumns.has("actions") && (
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody key={animationKey} className="animate-stagger-in">
              {paginated.map((brief) => {
                const isSelected = selectedIds.has(brief.id);
                return (
                  <tr
                    key={brief.id}
                    className={`border-b border-border transition-colors last:border-0 hover:bg-surface-hover ${
                      isSelected ? "bg-brand-soft hover:bg-brand-soft" : ""
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
                    <td className="max-w-[280px] px-4 py-3 sm:max-w-[360px]">
                      <Link
                        href={`/admin/briefs/${brief.id}`}
                        title={brief.title}
                        className="block truncate font-medium text-foreground transition-colors hover:text-brand-ink"
                      >
                        {brief.title}
                      </Link>
                      {brief.location && (
                        <p className="mt-0.5 truncate text-sm text-muted" title={brief.location}>
                          {brief.location}
                        </p>
                      )}
                    </td>
                    {visibleColumns.has("category") && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badgeToneByCategory[brief.category]}`}
                          >
                            {categoryLabel(brief.category)}
                          </span>
                          {brief.is_ad_intended && (
                            <span className="inline-flex whitespace-nowrap rounded-full bg-warning-muted px-2 py-0.5 text-[11px] font-medium text-warning-ink ring-1 ring-warning-ink/20">
                              Ad
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {visibleColumns.has("duration") && (
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${badgeToneByDurationClass[brief.duration_class]}`}
                        >
                          {durationClassLabel(brief.duration_class)}
                        </span>
                      </td>
                    )}
                    {visibleColumns.has("price") && (
                      <td className="value-text whitespace-nowrap px-4 py-3 text-sm text-foreground">
                        {formatPrice(brief.price_dkk)}
                      </td>
                    )}
                    {visibleColumns.has("claims") && (
                      <td className="value-text whitespace-nowrap px-4 py-3 text-sm text-text-secondary">
                        {brief.activeClaimCount}
                        <span className="text-muted"> / {brief.claim_limit}</span>
                      </td>
                    )}
                    {visibleColumns.has("status") && (
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${badgeToneByStatus[brief.status as BriefStatus]}`}
                          >
                            {brief.status}
                          </span>
                          <FundedBadge status={brief.funded_status as BriefFundedStatus | null} />
                        </div>
                      </td>
                    )}
                    {visibleColumns.has("created") && (
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted">
                        {new Date(brief.created_at).toLocaleDateString("en-GB")}
                      </td>
                    )}
                    {visibleColumns.has("actions") && (
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/briefs/${brief.id}`}
                          className="text-sm font-medium text-brand-ink hover:underline"
                        >
                          Edit
                        </Link>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          hasFilters={statusFilter !== "all" || hasNonStatusFilter}
          onResetFilters={resetFilters}
        />
      )}

      {totalPages > 1 && (
        <Pagination className="mt-6 justify-between">
          <p className="text-sm text-muted">
            Page <span className="value-text text-foreground">{safePage}</span>
            <span className="text-muted"> of </span>
            <span className="value-text text-foreground">{totalPages}</span>
          </p>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={(e) => {
                  e.preventDefault();
                  if (safePage > 1) setPage((p) => Math.max(1, p - 1));
                }}
                aria-disabled={safePage <= 1}
                className={safePage <= 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={(e) => {
                  e.preventDefault();
                  if (safePage < totalPages) setPage((p) => Math.min(totalPages, p + 1));
                }}
                aria-disabled={safePage >= totalPages}
                className={
                  safePage >= totalPages ? "pointer-events-none opacity-50" : undefined
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
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

/**
 * Chip-style filter trigger backed by DropdownMenu + RadioGroup. The
 * trigger shows the current selection so users don't have to open the
 * menu to read state. Generic over the option value type, but the
 * underlying RadioGroup is string-based, so we adapt at the boundary.
 */
function FilterChip<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="font-medium">
            <span>{label}</span>
            <ChevronDownIcon data-icon="inline-end" className="opacity-70" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-[180px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => {
            if (typeof v === "string") onChange(v as T);
          }}
        >
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value} closeOnClick>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Column visibility menu. Icon-led trigger keeps the row tight; the
 * dropdown uses checkbox items so toggling a column doesn't close the
 * menu (saves clicks when adjusting several at once).
 */
function ColumnsMenu({
  visibleColumns,
  onToggle,
}: {
  visibleColumns: Set<ColumnKey>;
  onToggle: (col: ColumnKey) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="ml-auto font-medium">
            <SlidersHorizontalIcon data-icon="inline-start" />
            Columns
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {DEFAULT_COLUMNS.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={visibleColumns.has(column)}
            onCheckedChange={() => onToggle(column)}
          >
            {COLUMN_LABELS[column]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Empty state for the briefs table. Distinguishes "no briefs yet"
 * (first-run, point at New brief) from "filters hide everything"
 * (offer Clear). DESIGN.md: specific copy, secondary line, optional
 * primary CTA. No decorative illustration.
 */
function EmptyState({
  hasFilters,
  onResetFilters,
}: {
  hasFilters: boolean;
  onResetFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
        <p className="text-base text-text-secondary">No briefs match these filters</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Try widening the status or duration, or clear the search.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResetFilters}
          className="mt-4"
        >
          Clear filters
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <p className="text-base text-text-secondary">No briefs yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        Publish your first brief and creators in your network can claim it.
      </p>
      <Button
        nativeButton={false}
        render={<Link href="/admin/briefs/new" className="mt-4" />}
      >
        Create your first brief
      </Button>
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
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-ink/20 bg-brand-soft px-4 py-2.5">
      <span className="text-sm font-medium text-foreground">
        <span className="value-text">{selectedCount}</span> selected
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAction("reopen")}
          disabled={working || reopenableCount === 0}
          title={
            reopenableCount === 0
              ? "Select archived briefs to reopen"
              : `Reopen ${reopenableCount} of ${selectedCount}`
          }
        >
          Reopen
          {reopenableCount > 0 && reopenableCount !== selectedCount && (
            <span className="text-muted">({reopenableCount})</span>
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAction("archive")}
          disabled={working || archivableCount === 0}
          title={
            archivableCount === 0
              ? "Selected briefs are already archived"
              : `Archive ${archivableCount} of ${selectedCount}`
          }
        >
          Archive
          {archivableCount > 0 && archivableCount !== selectedCount && (
            <span className="text-muted">({archivableCount})</span>
          )}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onAction("delete")}
          disabled={working || deletableCount === 0}
          title={
            deletableCount === 0
              ? "Briefs with claim history cannot be deleted, archive instead"
              : deletableCount < selectedCount
                ? `Delete ${deletableCount} of ${selectedCount} (others have claims)`
                : `Delete ${deletableCount}`
          }
        >
          Delete
          {deletableCount > 0 && deletableCount !== selectedCount && (
            <span>({deletableCount})</span>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={working}
          className="text-muted hover:text-foreground"
        >
          Clear
        </Button>
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
