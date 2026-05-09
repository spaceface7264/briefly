export default function AdminBriefsLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-10 w-32 bg-surface rounded-lg" />
        <div className="h-10 w-32 bg-surface rounded-lg" />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 w-24 bg-surface rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 bg-border/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
