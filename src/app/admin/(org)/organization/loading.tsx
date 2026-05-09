export default function OrganizationLoading() {
  return (
    <div className="animate-pulse max-w-4xl">
      <div className="mb-6 space-y-2">
        <div className="h-9 w-44 bg-surface rounded-lg" />
        <div className="h-4 w-80 bg-surface rounded" />
      </div>

      {/* Tab strip */}
      <div className="mb-8 border-b border-border">
        <div className="flex gap-1 -mb-px">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-surface rounded-t-md" />
          ))}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-surface rounded" />
            <div className="h-10 bg-surface rounded-lg" />
          </div>
        ))}
        <div className="h-10 w-32 bg-surface rounded-lg" />
      </div>
    </div>
  );
}
