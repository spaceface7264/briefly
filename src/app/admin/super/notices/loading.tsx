export default function SuperNoticesLoading() {
  return (
    <div className="animate-pulse space-y-10">
      <div>
        <div className="h-9 w-56 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-[32rem] max-w-full bg-surface rounded" />
      </div>

      <section>
        <div className="h-6 w-40 bg-surface rounded mb-4" />
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="h-3 w-20 bg-border/60 rounded" />
              <div className="h-10 bg-background border border-border rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-border/60 rounded" />
              <div className="h-10 bg-background border border-border rounded-lg" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-16 bg-border/60 rounded" />
            <div className="h-24 bg-background border border-border rounded-lg" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-20 bg-border/60 rounded" />
                <div className="h-10 bg-background border border-border rounded-lg" />
              </div>
            ))}
          </div>
          <div className="h-10 w-32 bg-foreground/10 rounded-lg" />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <div className="h-6 w-32 bg-surface rounded" />
          <div className="h-3 w-48 bg-surface rounded" />
        </div>
        <ul className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="bg-surface border border-border rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-16 bg-border/60 rounded" />
                    <div className="h-5 w-24 bg-border/60 rounded" />
                    <div className="h-4 w-40 bg-border/40 rounded" />
                  </div>
                  <div className="h-3 w-3/4 bg-border/40 rounded" />
                  <div className="h-3 w-1/2 bg-border/40 rounded" />
                </div>
                <div className="h-8 w-20 bg-border/40 rounded shrink-0" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
