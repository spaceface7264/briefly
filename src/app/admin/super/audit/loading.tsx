export default function SuperAuditLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-9 w-40 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-96 bg-surface rounded" />
      </div>

      <div className="mb-6 border-b border-border">
        <div className="flex gap-1 -mb-px">
          <div className="h-11 w-24 bg-surface rounded-t" />
          <div className="h-11 w-24 bg-surface rounded-t" />
        </div>
      </div>

      <ul className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="bg-surface border border-border rounded-xl p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-28 bg-border/60 rounded" />
                  <div className="h-4 w-32 bg-border/60 rounded" />
                  <div className="h-4 w-40 bg-border/40 rounded" />
                </div>
                <div className="h-3 w-2/3 bg-border/40 rounded" />
              </div>
              <div className="text-right space-y-1.5 shrink-0">
                <div className="h-3 w-24 bg-border/60 rounded ml-auto" />
                <div className="h-3 w-28 bg-border/40 rounded ml-auto" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
