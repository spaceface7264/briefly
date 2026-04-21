import { Nav } from "@/components/nav";
import { BriefGridSkeleton, FiltersSkeleton } from "@/components/skeletons";

export default function BriefsLoading() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Available Briefs</h1>
            <p className="text-muted">
              Browse open briefs and claim one to get started
            </p>
          </div>
          <FiltersSkeleton />
          <BriefGridSkeleton count={6} />
        </div>
      </main>
    </>
  );
}
