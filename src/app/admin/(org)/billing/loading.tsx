export default function BillingLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8 space-y-2">
        <div className="h-9 w-32 bg-surface rounded-lg" />
        <div className="h-4 w-96 bg-surface rounded" />
      </div>

      {/* Current plan */}
      <section className="mb-10">
        <div className="h-6 w-32 bg-surface rounded mb-4" />
        <div className="bg-surface border border-border rounded-xl p-6 grid sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-16 bg-border/60 rounded" />
              <div className="h-7 w-24 bg-border/60 rounded" />
              <div className="h-3 w-20 bg-border/40 rounded" />
            </div>
          ))}
        </div>
      </section>

      {/* Escrow + payment method blocks */}
      <section className="mb-10 grid sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
          <div className="h-5 w-32 bg-border/60 rounded" />
          <div className="h-3 w-3/4 bg-border/40 rounded" />
          <div className="h-9 w-32 bg-border/30 rounded-lg" />
        </div>
        <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
          <div className="h-5 w-40 bg-border/60 rounded" />
          <div className="h-3 w-2/3 bg-border/40 rounded" />
          <div className="h-9 w-36 bg-border/30 rounded-lg" />
        </div>
      </section>

      {/* Available plans grid */}
      <section>
        <div className="h-6 w-40 bg-surface rounded mb-4" />
        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-xl p-6 space-y-4"
            >
              <div className="space-y-2">
                <div className="h-3 w-12 bg-border/60 rounded" />
                <div className="h-7 w-32 bg-border/60 rounded" />
                <div className="h-3 w-3/4 bg-border/40 rounded" />
              </div>
              <div className="space-y-2 pt-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-3 w-2/3 bg-border/40 rounded" />
                ))}
              </div>
              <div className="h-9 bg-border/30 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
