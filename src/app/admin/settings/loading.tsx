export default function Loading() {
  return (
    <div className="max-w-4xl animate-pulse">
      <div className="h-9 bg-border rounded w-40 mb-2" />
      <div className="h-4 bg-border rounded w-80 mb-10" />

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-10">
          <div className="h-6 bg-border rounded w-48 mb-2" />
          <div className="h-4 bg-border rounded w-72 mb-4" />
          <div className="bg-surface border border-border rounded-xl">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className={`px-4 py-4 flex items-center justify-between ${
                  j > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="h-4 bg-border rounded w-40" />
                <div className="h-4 bg-border rounded w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
