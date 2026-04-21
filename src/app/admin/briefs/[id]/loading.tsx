export default function EditBriefLoading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-4 w-28 bg-surface rounded mb-2" />
          <div className="h-10 w-36 bg-surface rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-surface rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form skeleton */}
        <div className="lg:col-span-2 space-y-6">
          {[...Array(8)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-surface rounded mb-2" />
              <div className="h-12 bg-surface rounded-lg" />
            </div>
          ))}
        </div>

        {/* Sidebar skeleton */}
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="h-5 w-32 bg-border rounded mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-border/50 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
