export default function AdminClaimsLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-32 bg-surface rounded-lg mb-8" />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-10 w-28 bg-surface rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-16 bg-border/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
