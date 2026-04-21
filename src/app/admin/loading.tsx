export default function AdminDashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-10 w-48 bg-surface rounded-lg mb-8" />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5">
            <div className="h-4 w-20 bg-border rounded mb-2" />
            <div className="h-8 w-12 bg-border rounded" />
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-10">
        <div className="h-12 w-40 bg-surface rounded-lg" />
        <div className="h-12 w-48 bg-surface rounded-lg" />
      </div>

      {/* Recent Claims */}
      <div className="h-6 w-36 bg-surface rounded mb-4" />
      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-border/50 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
