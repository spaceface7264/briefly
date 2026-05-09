export default function ApplicationsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="h-9 w-44 bg-surface rounded-lg" />
          <div className="h-4 w-72 bg-surface rounded" />
        </div>
        <div className="h-7 w-32 bg-surface rounded-md" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-5 w-1/2 bg-border/60 rounded" />
                <div className="h-3 w-3/4 bg-border/40 rounded" />
                <div className="h-3 w-2/3 bg-border/40 rounded" />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="h-8 w-20 bg-border/60 rounded-lg" />
                <div className="h-8 w-20 bg-border/60 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
