export default function SuperUserDetailLoading() {
  return (
    <div className="animate-pulse space-y-10">
      <div>
        <div className="h-4 w-24 bg-surface rounded" />
        <div className="mt-3 flex items-center gap-4">
          <div className="size-14 rounded-xl bg-surface-raised border border-border shrink-0" />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-48 bg-surface rounded-lg" />
              <div className="h-5 w-16 bg-border/60 rounded" />
              <div className="h-5 w-20 bg-border/60 rounded" />
            </div>
            <div className="h-3 w-56 bg-surface rounded" />
          </div>
        </div>

        <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 max-w-2xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="h-3 w-24 bg-border/60 rounded" />
              <div className="h-3 flex-1 bg-border/40 rounded" />
            </div>
          ))}
        </dl>
      </div>

      <section>
        <div className="h-6 w-32 bg-surface rounded mb-4" />
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <div className="h-4 w-3/4 bg-border/40 rounded" />
          <div className="h-10 w-40 bg-foreground/10 rounded-lg" />
        </div>
      </section>

      <section>
        <div className="h-6 w-40 bg-surface rounded mb-4" />
        <div className="bg-surface border border-border rounded-xl p-5 grid sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 bg-border/60 rounded" />
              <div className="h-4 w-32 bg-border/40 rounded" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="h-6 w-36 bg-surface rounded mb-4" />
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="bg-surface-raised h-10 border-b border-border" />
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 px-4 flex items-center gap-4">
                <div className="h-4 w-1/3 bg-border/60 rounded" />
                <div className="h-4 w-16 bg-border/60 rounded" />
                <div className="h-4 w-20 bg-border/60 rounded" />
                <div className="h-4 w-24 bg-border/60 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="h-6 w-56 bg-surface rounded mb-4" />
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="bg-surface border border-border rounded-lg px-4 py-3 flex items-start gap-3"
            >
              <div className="h-4 w-24 bg-border/60 rounded shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 bg-border/40 rounded" />
                <div className="h-3 w-1/3 bg-border/40 rounded" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
