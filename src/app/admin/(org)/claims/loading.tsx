import { Skeleton } from "@/components/ui/skeleton";

// Page-shaped skeleton for /admin/claims: header + 7 status filter
// pills + table with avatar-bearing rows. Matches the route's real
// layout so the swap-in doesn't reflow.
export default function AdminClaimsLoading() {
  return (
    <div>
      <header className="mb-6">
        <Skeleton className="h-9 w-32 sm:h-10" />
      </header>

      {/* Status filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[60, 86, 132, 156, 100, 76, 104].map((w) => (
          <Skeleton key={w} className="h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-4 border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="ml-8 h-3 w-16" />
          <Skeleton className="ml-auto h-3 w-12" />
        </div>
        <div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border px-4 py-4 last:border-0"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex flex-1 items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
