export default function SuperHealthLoading() {
  return (
    <div className="animate-pulse space-y-10">
      <div>
        <div className="h-9 w-56 bg-surface rounded-lg mb-2" />
        <div className="h-4 w-80 bg-surface rounded" />
      </div>

      {/* Four stacked sections, each a heading + a list of cards */}
      {Array.from({ length: 4 }).map((_, sectionIndex) => (
        <section key={sectionIndex}>
          <div className="h-5 w-48 bg-surface rounded mb-3" />
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <li
                key={rowIndex}
                className="bg-surface border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="h-4 w-2/3 bg-border/60 rounded" />
                    <div className="h-3 w-1/2 bg-border/40 rounded" />
                  </div>
                  <div className="text-right shrink-0 space-y-2">
                    <div className="h-4 w-20 bg-border/60 rounded" />
                    <div className="h-3 w-16 bg-border/40 rounded" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
