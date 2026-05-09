import { Nav } from "@/components/nav";

export default function NotificationsLoading() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 animate-pulse">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-9 w-44 bg-surface rounded-lg" />
            <div className="h-8 w-28 bg-surface rounded-md" />
          </div>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-4 flex items-start gap-3">
                  <div className="size-8 rounded-full bg-border/60 shrink-0" />
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="h-4 w-3/4 bg-border/60 rounded" />
                    <div className="h-3 w-1/2 bg-border/40 rounded" />
                  </div>
                  <div className="h-3 w-12 bg-border/40 rounded shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
