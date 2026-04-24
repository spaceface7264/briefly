import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";
import type { Brief, BriefStatus } from "@/types/database";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

type SortField = "created_at" | "title" | "price_dkk";
type SortOrder = "asc" | "desc";
type StatusFilter = "all" | "open" | "claimed" | "archived";
type PlatformFilter = "all" | "instagram" | "tiktok" | "youtube";
type ColumnKey = "category" | "format" | "platform" | "price" | "claims" | "status" | "created" | "actions";

const PAGE_SIZE = 10;
const DEFAULT_COLUMNS: ColumnKey[] = [
  "category",
  "format",
  "platform",
  "price",
  "claims",
  "status",
  "created",
  "actions",
];
const PLATFORM_TO_FORMATS: Record<Exclude<PlatformFilter, "all">, Brief["format"][]> = {
  instagram: ["reel", "photo"],
  tiktok: ["tiktok"],
  youtube: ["youtube_short", "long_form"],
};

function getSingleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildHref(
  basePath: string,
  params: URLSearchParams,
  updates: Record<string, string | number | undefined>
) {
  const next = new URLSearchParams(params);

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  }

  const query = next.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function getNextSortState(
  currentField: SortField | undefined,
  currentOrder: SortOrder | undefined,
  clickedField: SortField
) {
  if (currentField !== clickedField) return { sort: clickedField, order: "asc" as const };
  if (currentOrder === "asc") return { sort: clickedField, order: "desc" as const };
  return { sort: undefined, order: undefined };
}

function getFormatLabel(format: Brief["format"]) {
  const labels: Record<Brief["format"], string> = {
    reel: "Reel",
    tiktok: "TikTok",
    youtube_short: "YouTube Short",
    long_form: "Long Form",
    photo: "Photo",
  };
  return labels[format];
}

function getPlatformForFormat(format: Brief["format"]): Exclude<PlatformFilter, "all"> {
  if (format === "tiktok") return "tiktok";
  if (format === "youtube_short" || format === "long_form") return "youtube";
  return "instagram";
}

function getPlatformLabel(platform: Exclude<PlatformFilter, "all">) {
  const labels: Record<Exclude<PlatformFilter, "all">, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
  };
  return labels[platform];
}

function parseColumnsParam(raw: string | string[] | undefined) {
  if (!raw) return new Set<ColumnKey>(DEFAULT_COLUMNS);
  const allowed = new Set<ColumnKey>(DEFAULT_COLUMNS);
  const parsed = new Set<ColumnKey>();

  if (Array.isArray(raw)) {
    for (const value of raw) {
      const key = value.trim() as ColumnKey;
      if (allowed.has(key)) parsed.add(key);
    }
  } else {
    for (const value of raw.split(",")) {
      const key = value.trim() as ColumnKey;
      if (allowed.has(key)) parsed.add(key);
    }
  }

  if (parsed.size === 0) return new Set<ColumnKey>(DEFAULT_COLUMNS);
  return parsed;
}

function SortIcon({ activeOrder }: { activeOrder?: SortOrder }) {
  if (activeOrder === "asc") {
    return <ArrowUpIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  if (activeOrder === "desc") {
    return <ArrowDownIcon className="h-3.5 w-3.5" aria-hidden="true" />;
  }

  return <ArrowUpDownIcon className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />;
}

export default async function AdminBriefsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const statusParam = getSingleParam(params.status);
  const qParam = getSingleParam(params.q)?.trim() || "";
  const sortParam = getSingleParam(params.sort);
  const orderParam = getSingleParam(params.order);
  const pageParam = Number.parseInt(getSingleParam(params.page) || "1", 10);
  const formatParam = getSingleParam(params.format);
  const platformParam = getSingleParam(params.platform);
  const colsParam = params.cols;

  const statusFilter: StatusFilter = ["open", "claimed", "archived"].includes(statusParam || "")
    ? (statusParam as StatusFilter)
    : "all";
  const formatFilter: Brief["format"] | "all" = ["reel", "tiktok", "youtube_short", "long_form", "photo"].includes(formatParam || "")
    ? (formatParam as Brief["format"])
    : "all";
  const platformFilter: PlatformFilter = ["instagram", "tiktok", "youtube"].includes(platformParam || "")
    ? (platformParam as PlatformFilter)
    : "all";
  const parsedSortField = ["title", "price_dkk", "created_at"].includes(sortParam || "")
    ? (sortParam as SortField)
    : undefined;
  const parsedSortOrder: SortOrder | undefined = orderParam === "asc" || orderParam === "desc" ? orderParam : undefined;
  const sortField = parsedSortField && parsedSortOrder ? parsedSortField : undefined;
  const sortOrder = parsedSortField && parsedSortOrder ? parsedSortOrder : undefined;
  const currentPage = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const baseParams = new URLSearchParams();
  if (statusFilter !== "all") baseParams.set("status", statusFilter);
  if (qParam) baseParams.set("q", qParam);
  if (formatFilter !== "all") baseParams.set("format", formatFilter);
  if (platformFilter !== "all") baseParams.set("platform", platformFilter);
  if (sortField) baseParams.set("sort", sortField);
  if (sortOrder) baseParams.set("order", sortOrder);
  const visibleColumns = parseColumnsParam(colsParam);
  const colsQueryValue = [...visibleColumns].join(",");
  if (colsQueryValue !== DEFAULT_COLUMNS.join(",")) baseParams.set("cols", colsQueryValue);

  let countQuery = supabase.from("briefs").select("*", { count: "exact", head: true });
  let dataQuery = supabase.from("briefs").select("*");

  if (statusFilter !== "all") {
    countQuery = countQuery.eq("status", statusFilter);
    dataQuery = dataQuery.eq("status", statusFilter);
  }

  if (qParam) {
    const term = `%${qParam}%`;
    countQuery = countQuery.or(`title.ilike.${term},gym.ilike.${term}`);
    dataQuery = dataQuery.or(`title.ilike.${term},gym.ilike.${term}`);
  }

  if (formatFilter !== "all") {
    countQuery = countQuery.eq("format", formatFilter);
    dataQuery = dataQuery.eq("format", formatFilter);
  }

  if (platformFilter !== "all") {
    const platformFormats = PLATFORM_TO_FORMATS[platformFilter];
    countQuery = countQuery.in("format", platformFormats);
    dataQuery = dataQuery.in("format", platformFormats);
  }

  const { count: totalCount } = await countQuery;
  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let sortedQuery = dataQuery;
  if (sortField && sortOrder) {
    sortedQuery = sortedQuery.order(sortField, { ascending: sortOrder === "asc" });
  }

  const { data: briefs } = await sortedQuery.range(from, to);

  const statusCounts = await Promise.all([
    supabase.from("briefs").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("briefs").select("*", { count: "exact", head: true }).eq("status", "claimed"),
    supabase.from("briefs").select("*", { count: "exact", head: true }).eq("status", "archived"),
    supabase.from("briefs").select("*", { count: "exact", head: true }),
  ]);

  const briefIds = ((briefs || []) as Brief[]).map((brief) => brief.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeClaims } = briefIds.length > 0 ? await (supabase.from("claims") as any)
    .select("brief_id")
    .in("brief_id", briefIds)
    .eq("status", "active") : { data: [] };

  const claimCountByBriefId = new Map<string, number>();
  for (const claim of activeClaims || []) {
    claimCountByBriefId.set(claim.brief_id, (claimCountByBriefId.get(claim.brief_id) || 0) + 1);
  }

  const briefsWithCounts = ((briefs || []) as Brief[]).map((brief) => ({
    ...brief,
    activeClaimCount: claimCountByBriefId.get(brief.id) || 0,
  }));

  const statusGroups: { status: StatusFilter; label: string; count: number }[] = [
    { status: "all", label: "All", count: statusCounts[3].count || 0 },
    { status: "open", label: "Open", count: statusCounts[0].count || 0 },
    { status: "claimed", label: "Claimed", count: statusCounts[1].count || 0 },
    { status: "archived", label: "Archived", count: statusCounts[2].count || 0 },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Briefs</h1>
          <p className="text-muted text-sm mt-1">
            Showing {briefsWithCounts.length} of {totalCount || 0}
          </p>
        </div>
        <Link
          href="/admin/briefs/new"
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
        >
          Create Brief
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {statusGroups.map((group) => {
          const isActive = statusFilter === group.status;
          return (
            <Link
              key={group.status}
              href={buildHref("/admin/briefs", baseParams, {
                status: group.status === "all" ? undefined : group.status,
                page: undefined,
              })}
              className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface-raised text-foreground border-border-strong"
                  : "bg-surface border-border hover:border-accent/50"
              }`}
            >
              {group.label} ({group.count})
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <form action="/admin/briefs" method="get" className="flex items-center gap-2">
          {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
          {formatFilter !== "all" && <input type="hidden" name="format" value={formatFilter} />}
          {platformFilter !== "all" && <input type="hidden" name="platform" value={platformFilter} />}
          {colsQueryValue !== DEFAULT_COLUMNS.join(",") && <input type="hidden" name="cols" value={colsQueryValue} />}
          {sortField && <input type="hidden" name="sort" value={sortField} />}
          {sortOrder && <input type="hidden" name="order" value={sortOrder} />}
          <input
            type="search"
            name="q"
            defaultValue={qParam}
            placeholder="Search title or gym..."
            className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors"
          >
            Filter
          </button>
        </form>

        <form action="/admin/briefs" method="get" className="flex items-center gap-2">
          {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
          {qParam && <input type="hidden" name="q" value={qParam} />}
          {colsQueryValue !== DEFAULT_COLUMNS.join(",") && <input type="hidden" name="cols" value={colsQueryValue} />}
          {sortField && <input type="hidden" name="sort" value={sortField} />}
          {sortOrder && <input type="hidden" name="order" value={sortOrder} />}
          <select
            name="format"
            defaultValue={formatFilter}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="all">All formats</option>
            <option value="reel">Reel</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube_short">YouTube Short</option>
            <option value="long_form">Long Form</option>
            <option value="photo">Photo</option>
          </select>
          <select
            name="platform"
            defaultValue={platformFilter}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="all">All platforms</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors"
          >
            Apply
          </button>
        </form>

        <details className="relative">
          <summary className="list-none cursor-pointer px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors">
            Columns
          </summary>
          <form
            action="/admin/briefs"
            method="get"
            className="absolute right-0 mt-2 z-10 min-w-56 rounded-lg border border-border bg-surface p-3 shadow-lg space-y-2"
          >
            {statusFilter !== "all" && <input type="hidden" name="status" value={statusFilter} />}
            {qParam && <input type="hidden" name="q" value={qParam} />}
            {formatFilter !== "all" && <input type="hidden" name="format" value={formatFilter} />}
            {platformFilter !== "all" && <input type="hidden" name="platform" value={platformFilter} />}
            {sortField && <input type="hidden" name="sort" value={sortField} />}
            {sortOrder && <input type="hidden" name="order" value={sortOrder} />}
            {DEFAULT_COLUMNS.map((column) => (
              <label key={column} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="cols"
                  value={column}
                  defaultChecked={visibleColumns.has(column)}
                  className="accent-accent"
                />
                <span className="capitalize">{column}</span>
              </label>
            ))}
            <button
              type="submit"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border text-sm hover:border-accent/50 transition-colors"
            >
              Update columns
            </button>
          </form>
        </details>

        {(qParam || statusFilter !== "all" || formatFilter !== "all" || platformFilter !== "all" || sortField || sortOrder || colsQueryValue !== DEFAULT_COLUMNS.join(",")) && (
          <Link href="/admin/briefs" className="text-sm text-accent hover:underline">
            Clear filters
          </Link>
        )}
      </div>

      {/* Briefs Table */}
      {briefsWithCounts.length > 0 ? (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  <Link
                    href={buildHref("/admin/briefs", baseParams, {
                      ...getNextSortState(sortField, sortOrder, "title"),
                      page: undefined,
                    })}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Title
                    <SortIcon activeOrder={sortField === "title" ? sortOrder : undefined} />
                  </Link>
                </th>
                {visibleColumns.has("category") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Category</th>
                )}
                {visibleColumns.has("format") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Format</th>
                )}
                {visibleColumns.has("platform") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Platform</th>
                )}
                {visibleColumns.has("price") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  <Link
                    href={buildHref("/admin/briefs", baseParams, {
                      ...getNextSortState(sortField, sortOrder, "price_dkk"),
                      page: undefined,
                    })}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Price
                    <SortIcon activeOrder={sortField === "price_dkk" ? sortOrder : undefined} />
                  </Link>
                </th>
                )}
                {visibleColumns.has("claims") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Claims</th>
                )}
                {visibleColumns.has("status") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">Status</th>
                )}
                {visibleColumns.has("created") && (
                  <th className="text-left text-sm font-medium text-muted px-4 py-3">
                  <Link
                    href={buildHref("/admin/briefs", baseParams, {
                      ...getNextSortState(sortField, sortOrder, "created_at"),
                      page: undefined,
                    })}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Created
                    <SortIcon activeOrder={sortField === "created_at" ? sortOrder : undefined} />
                  </Link>
                </th>
                )}
                {visibleColumns.has("actions") && (
                  <th className="text-right text-sm font-medium text-muted px-4 py-3">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {briefsWithCounts.map((brief) => (
                <tr key={brief.id} className="border-b border-border last:border-0 hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/admin/briefs/${brief.id}`} className="font-medium hover:text-accent">
                      {brief.title}
                    </Link>
                    {brief.gym && (
                      <p className="text-muted text-sm">{brief.gym}</p>
                    )}
                  </td>
                  {visibleColumns.has("category") && (
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-accent-muted text-accent text-xs font-medium rounded-full capitalize">
                        {brief.category}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("format") && (
                    <td className="px-4 py-3 text-sm">{getFormatLabel(brief.format)}</td>
                  )}
                  {visibleColumns.has("platform") && (
                    <td className="px-4 py-3 text-sm">
                      {getPlatformLabel(getPlatformForFormat(brief.format))}
                    </td>
                  )}
                  {visibleColumns.has("price") && (
                    <td className="px-4 py-3 text-sm">
                      {formatPrice(brief.price_dkk)}
                    </td>
                  )}
                  {visibleColumns.has("claims") && (
                    <td className="px-4 py-3 text-sm">
                      {brief.activeClaimCount} / {brief.claim_limit}
                    </td>
                  )}
                  {visibleColumns.has("status") && (
                    <td className="px-4 py-3">
                      <BriefStatusBadge status={brief.status} />
                    </td>
                  )}
                  {visibleColumns.has("created") && (
                    <td className="px-4 py-3 text-muted text-sm">
                      {new Date(brief.created_at).toLocaleDateString("en-GB")}
                    </td>
                  )}
                  {visibleColumns.has("actions") && (
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/briefs/${brief.id}`}
                        className="text-accent hover:underline text-sm"
                      >
                        Edit
                      </Link>
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
          <Link href="/admin/briefs" className="inline-flex px-5 py-2.5 border border-border rounded-lg hover:border-accent/50 transition-colors">
            Reset Filters
          </Link>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref("/admin/briefs", baseParams, {
                page: safePage > 1 ? safePage - 1 : 1,
              })}
              aria-disabled={safePage <= 1}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                safePage <= 1
                  ? "pointer-events-none opacity-50 border-border"
                  : "border-border hover:border-accent/50"
              }`}
            >
              Previous
            </Link>
            <Link
              href={buildHref("/admin/briefs", baseParams, {
                page: safePage < totalPages ? safePage + 1 : totalPages,
              })}
              aria-disabled={safePage >= totalPages}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                safePage >= totalPages
                  ? "pointer-events-none opacity-50 border-border"
                  : "border-border hover:border-accent/50"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BriefStatusBadge({ status }: { status: BriefStatus }) {
  const styles: Record<BriefStatus, string> = {
    open: "bg-success/20 text-success",
    claimed: "bg-accent-muted text-accent",
    submitted: "bg-warning/20 text-warning",
    approved: "bg-success/20 text-success",
    paid: "bg-muted/20 text-muted",
    archived: "bg-muted/20 text-muted",
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-medium rounded-full capitalize ${styles[status]}`}>
      {status}
    </span>
  );
}
