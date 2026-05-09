export default function CreatorDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-32 bg-surface rounded mb-4" />

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="h-10 w-64 bg-surface rounded-lg mb-2" />
          <div className="h-5 w-48 bg-surface rounded mb-1" />
          <div className="h-5 w-32 bg-surface rounded" />
        </div>
        <div className="h-8 w-20 bg-surface rounded-full" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-4">
            <div className="h-4 w-24 bg-border rounded mb-2" />
            <div className="h-8 w-16 bg-border rounded" />
          </div>
        ))}
      </div>

      {/* Claims History */}
      <div className="h-6 w-48 bg-surface rounded mb-4" />
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-border/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
