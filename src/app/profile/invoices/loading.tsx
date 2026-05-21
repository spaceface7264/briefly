export default function InvoicesLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-48 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-72 bg-surface rounded" />
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="bg-surface-raised h-10 border-b border-border" />
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 px-4 flex items-center gap-4">
              <div className="h-4 w-24 bg-border/60 rounded" />
              <div className="h-4 w-1/3 bg-border/40 rounded" />
              <div className="h-4 w-16 bg-border/60 rounded" />
              <div className="h-4 w-20 bg-border/60 rounded ml-auto" />
              <div className="h-4 w-24 bg-border/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
