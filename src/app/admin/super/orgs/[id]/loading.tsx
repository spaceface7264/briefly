export default function SuperOrgDetailLoading() {
  return (
    <div className="animate-pulse space-y-10">
      {/* Header: back link + identity + meta */}
      <div>
        <div className="h-4 w-32 bg-surface rounded" />
        <div className="mt-3 flex items-center gap-4">
          <div className="size-14 rounded-xl bg-surface shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-8 w-64 bg-surface rounded-lg" />
            <div className="h-3 w-32 bg-surface rounded" />
          </div>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 max-w-2xl">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 bg-surface rounded" />
          ))}
        </div>
      </div>

      {/* Lifecycle card */}
      <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
        <div className="h-5 w-28 bg-border/60 rounded" />
        <div className="h-3 w-2/3 bg-border/40 rounded" />
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="h-24 bg-border/30 rounded-lg" />
          <div className="h-24 bg-border/30 rounded-lg" />
        </div>
      </div>

      {/* Support mode hero */}
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-5 space-y-3">
        <div className="h-5 w-32 bg-border/60 rounded" />
        <div className="h-4 w-3/4 bg-border/40 rounded" />
        <div className="h-9 bg-border/30 rounded-lg" />
      </div>

      {/* Stats grid */}
      <div>
        <div className="h-6 w-32 bg-surface rounded mb-4" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-xl p-4 space-y-2"
            >
              <div className="h-3 w-20 bg-border/60 rounded" />
              <div className="h-7 w-16 bg-border/60 rounded" />
              <div className="h-3 w-24 bg-border/40 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* People section */}
      <div>
        <div className="h-6 w-24 bg-surface rounded mb-4" />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="bg-surface-raised h-10 border-b border-border" />
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 px-4 flex items-center gap-4">
                <div className="h-4 w-1/4 bg-border/60 rounded" />
                <div className="h-4 w-1/3 bg-border/60 rounded" />
                <div className="h-4 w-16 bg-border/60 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing + audit blocks */}
      <div className="space-y-4">
        <div className="h-6 w-44 bg-surface rounded" />
        <div className="bg-surface border border-border rounded-xl p-5 grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 bg-border/60 rounded" />
              <div className="h-5 w-24 bg-border/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
