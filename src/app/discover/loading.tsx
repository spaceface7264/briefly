import { Nav } from "@/components/nav";

export default function DiscoverLoading() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 animate-pulse">
          <div className="mb-6 space-y-2">
            <div className="h-9 w-48 bg-surface rounded-lg" />
            <div className="h-4 w-80 bg-surface rounded" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface border border-border rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-border/60 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-2/3 bg-border/60 rounded" />
                    <div className="h-3 w-1/3 bg-border/40 rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full bg-border/40 rounded" />
                  <div className="h-3 w-5/6 bg-border/40 rounded" />
                </div>
                <div className="h-8 w-24 bg-border/30 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
