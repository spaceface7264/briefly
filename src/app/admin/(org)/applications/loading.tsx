export default function ApplicationsLoading() {
  return (
    <div className="animate-pulse">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-48 rounded-lg bg-surface" />
          <div className="h-4 w-56 rounded bg-surface" />
        </div>
      </header>

      <section className="mb-10">
        <div className="mb-3 flex items-baseline gap-2">
          <div className="h-3 w-14 rounded bg-surface" />
          <div className="h-4 w-6 rounded-full bg-surface" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-border/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-border/60" />
                  <div className="h-3 w-1/2 rounded bg-border/40" />
                  <div className="h-3 w-1/4 rounded bg-border/40" />
                </div>
              </div>
              <div className="mt-3 ml-14 flex gap-1.5">
                <div className="h-5 w-16 rounded-full bg-border/40" />
                <div className="h-5 w-20 rounded-full bg-border/40" />
                <div className="h-5 w-14 rounded-full bg-border/40" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline gap-2">
          <div className="h-3 w-16 rounded bg-surface" />
          <div className="h-4 w-6 rounded-full bg-surface" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-border/60" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 rounded bg-border/60" />
                <div className="h-3 w-1/2 rounded bg-border/40" />
              </div>
              <div className="h-5 w-16 rounded-full bg-border/40" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
