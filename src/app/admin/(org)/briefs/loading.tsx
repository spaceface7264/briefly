import { Skeleton } from "@/components/ui/skeleton";

// Page-shaped skeleton: matches the header + status filter chips +
// filter row + table layout the route shadows, so the swap-in is
// invisible. Generic block placeholders would re-flow the page when
// the real data lands.
export default function AdminBriefsLoading() {
  return (
    <div>
      <header className="mb-6 flex items-end justify-between gap-4">
        <Skeleton className="h-9 w-32 sm:h-10" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </header>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[88, 96, 110, 104].map((w) => (
          <Skeleton key={w} className="h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Search + filter row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-full" />
        <Skeleton className="h-8 w-40 rounded-full" />
        <Skeleton className="ml-auto h-8 w-24 rounded-full" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="size-4" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0"
            >
              <Skeleton className="size-4" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/5" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
