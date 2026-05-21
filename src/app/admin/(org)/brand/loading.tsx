export default function AdminBrandLoading() {
  return (
    <div className="max-w-4xl animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-32 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-[28rem] max-w-full bg-surface rounded" />
      </div>

      <div className="space-y-10">
        <section className="space-y-3">
          <div className="h-5 w-20 bg-surface rounded" />
          <div className="grid sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-xl p-4 space-y-3"
              >
                <div className="h-4 w-24 bg-border/60 rounded" />
                <div className="aspect-video bg-background border border-border rounded-lg" />
                <div className="h-3 w-32 bg-border/40 rounded" />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="h-5 w-20 bg-surface rounded" />
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-10 bg-border/60 rounded" />
                <div className="h-10 flex-1 bg-background border border-border rounded-lg" />
                <div className="h-10 w-32 bg-background border border-border rounded-lg" />
                <div className="h-8 w-8 bg-border/40 rounded" />
              </div>
            ))}
            <div className="h-9 w-32 bg-foreground/10 rounded-lg" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="h-5 w-28 bg-surface rounded" />
          <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="grid sm:grid-cols-3 gap-3">
                <div className="h-10 bg-background border border-border rounded-lg" />
                <div className="h-10 bg-background border border-border rounded-lg" />
                <div className="h-10 bg-background border border-border rounded-lg" />
              </div>
            ))}
            <div className="h-9 w-36 bg-foreground/10 rounded-lg" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="h-5 w-24 bg-surface rounded" />
          <div className="h-10 bg-background border border-border rounded-lg" />
        </section>

        <section className="space-y-3">
          <div className="h-5 w-16 bg-surface rounded" />
          <div className="h-32 bg-background border border-border rounded-lg" />
        </section>

        <div className="h-10 w-32 bg-foreground/10 rounded-lg" />
      </div>
    </div>
  );
}
