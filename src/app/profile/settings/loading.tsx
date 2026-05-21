export default function CreatorSettingsLoading() {
  return (
    <div className="max-w-2xl animate-pulse">
      <div className="mb-6">
        <div className="h-9 w-32 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-72 bg-surface rounded" />
      </div>

      <div className="mb-8 border-b border-border">
        <div className="flex gap-1 -mb-px">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-11 w-24 bg-surface rounded-t" />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-border/60 rounded" />
            <div className="h-10 bg-background border border-border rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-32 bg-foreground/10 rounded-lg" />
      </div>
    </div>
  );
}
