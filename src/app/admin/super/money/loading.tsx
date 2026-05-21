export default function SuperMoneyLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-9 w-40 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-[28rem] max-w-full bg-surface rounded" />
      </div>

      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <section
            key={i}
            className="bg-surface border border-border rounded-xl p-5"
          >
            <div className="mb-4 space-y-1.5">
              <div className="h-5 w-48 bg-border/60 rounded" />
              <div className="h-3 w-3/4 bg-border/40 rounded" />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="flex-1 h-10 bg-background border border-border rounded-lg" />
              <div className="h-10 w-24 bg-foreground/10 rounded-lg" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
