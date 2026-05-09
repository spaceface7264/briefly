export default function SuperOrgsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-56 bg-surface rounded-lg" />
          <div className="h-4 w-80 bg-surface rounded" />
        </div>
        <div className="h-9 w-32 bg-surface rounded-lg" />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="bg-surface-raised h-10 border-b border-border" />
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 px-4 flex items-center gap-4">
              <div className="h-4 w-1/3 bg-border/60 rounded" />
              <div className="h-4 w-20 bg-border/60 rounded" />
              <div className="h-4 w-16 bg-border/60 rounded" />
              <div className="h-4 w-12 bg-border/60 rounded" />
              <div className="h-4 w-16 bg-border/60 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
