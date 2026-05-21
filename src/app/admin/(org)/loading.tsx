export default function AdminDashboardLoading() {
  return (
    <div className="max-w-6xl animate-pulse">
      {/* Header */}
      <header className="mb-12">
        <div className="h-3 w-32 bg-surface rounded mb-3" />
        <div className="h-10 w-80 bg-surface rounded-lg mb-3" />
        <div className="h-4 w-96 bg-surface/70 rounded mb-6" />
        <div className="flex gap-2">
          <div className="h-9 w-40 bg-surface rounded-full" />
          <div className="h-9 w-28 bg-surface/70 rounded-full" />
        </div>
      </header>

      {/* KPI strip */}
      <div className="mb-12 pb-8 border-b border-border flex flex-wrap items-baseline gap-x-10 gap-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-20 bg-surface rounded mb-2" />
            <div className="h-7 w-24 bg-surface rounded-md" />
          </div>
        ))}
      </div>

      {/* Body grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-12">
        <section className="lg:col-span-3">
          <div className="flex items-baseline justify-between mb-5">
            <div className="h-5 w-32 bg-surface rounded" />
            <div className="h-3 w-12 bg-surface/70 rounded" />
          </div>
          <ul className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <li key={i} className="py-4 first:pt-0">
                <div className="flex items-baseline justify-between gap-4 mb-2.5">
                  <div className="h-4 w-2/3 bg-surface rounded" />
                  <div className="h-4 w-20 bg-surface rounded" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1 flex-1 rounded-full bg-surface" />
                  <div className="h-3 w-10 bg-surface rounded" />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-5">
            <div className="h-5 w-32 bg-surface rounded" />
            <div className="h-3 w-12 bg-surface/70 rounded" />
          </div>
          <ul className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="mt-1.5 size-1.5 rounded-full bg-surface" />
                <div className="flex-1">
                  <div className="h-4 w-full bg-surface rounded mb-1.5" />
                  <div className="h-3 w-24 bg-surface/70 rounded" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
