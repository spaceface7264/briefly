export function BriefCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-border rounded-full w-24" />
          <div className="h-6 bg-border rounded w-3/4" />
        </div>
        <div className="h-6 bg-border rounded w-20" />
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-border rounded w-full" />
        <div className="h-4 bg-border rounded w-2/3" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <div className="h-6 bg-border rounded-full w-20" />
        <div className="h-6 bg-border rounded-full w-16" />
        <div className="h-6 bg-border rounded-full w-24" />
      </div>
      <div className="h-4 bg-border rounded w-32 pt-3 border-t border-border" />
    </div>
  );
}

export function BriefGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <BriefCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BriefDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-border rounded w-24 mb-6" />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div className="flex-1">
          <div className="h-9 bg-border rounded w-3/4 mb-3" />
          <div className="flex gap-2">
            <div className="h-7 bg-border rounded-full w-24" />
            <div className="h-7 bg-border rounded-full w-20" />
            <div className="h-7 bg-border rounded-full w-28" />
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="h-9 bg-border rounded w-32 mb-2" />
          <div className="h-4 bg-border rounded w-24 sm:ml-auto" />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="h-6 bg-border rounded w-32 mb-3" />
            <div className="space-y-2">
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-3/4" />
            </div>
          </div>

          <div>
            <div className="h-6 bg-border rounded w-40 mb-3" />
            <div className="bg-surface-raised border border-border rounded-lg p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-border rounded w-20 mb-1" />
                    <div className="h-4 bg-border rounded w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="bg-surface-raised border border-border rounded-xl p-6">
            <div className="mb-4 pb-4 border-b border-border">
              <div className="h-3 bg-border rounded w-20 mb-2" />
              <div className="h-6 bg-border rounded w-32" />
            </div>
            <div className="h-5 bg-border rounded w-40 mb-4" />
            <div className="space-y-2 mb-6">
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-3/4" />
            </div>
            <div className="h-12 bg-border rounded-lg w-full" />
          </div>
          <div className="bg-surface-raised border border-border rounded-xl p-5">
            <div className="h-5 bg-border rounded w-28 mb-4" />
            <div className="space-y-2">
              <div className="h-4 bg-border rounded w-full" />
              <div className="h-4 bg-border rounded w-5/6" />
              <div className="h-4 bg-border rounded w-4/6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyBriefsListSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-lg p-4 h-20"
          />
        ))}
      </div>

      <div className="space-y-10">
        {Array.from({ length: 2 }).map((_, s) => (
          <div key={s}>
            <div className="h-6 bg-border rounded w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-surface border border-border rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-6 bg-border rounded w-48" />
                        <div className="h-6 bg-border rounded-full w-20" />
                      </div>
                      <div className="flex gap-2 mb-3">
                        <div className="h-6 bg-border rounded-full w-20" />
                        <div className="h-6 bg-border rounded-full w-16" />
                      </div>
                      <div className="h-4 bg-border rounded w-32" />
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="h-6 bg-border rounded w-24 mb-2" />
                      <div className="h-4 bg-border rounded w-20 sm:ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <div className="h-4 bg-border rounded w-24 mb-2" />
          <div className="h-12 bg-surface border border-border rounded-lg" />
        </div>
      ))}
      <div className="pt-4">
        <div className="h-12 bg-border rounded-lg w-32" />
      </div>
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface border border-border rounded-lg" />
        ))}
      </div>
      <div className="h-5 bg-border rounded w-32 mb-6" />
    </div>
  );
}
