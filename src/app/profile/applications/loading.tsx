export default function MyApplicationsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-7 w-48 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-72 bg-surface rounded" />
      </div>

      <div className="space-y-8">
        {Array.from({ length: 2 }).map((_, section) => (
          <section key={section}>
            <div className="h-5 w-36 bg-surface rounded mb-4" />
            <ul className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className="bg-surface border border-border rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="size-10 bg-border/60 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="h-4 w-1/3 bg-border/60 rounded" />
                    <div className="h-3 w-2/3 bg-border/40 rounded" />
                  </div>
                  <div className="h-5 w-20 bg-border/60 rounded shrink-0" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
