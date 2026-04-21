import { Nav } from "@/components/nav";
import { MyBriefsListSkeleton } from "@/components/skeletons";

export default function MyBriefsLoading() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Briefs</h1>
            <p className="text-muted">Track your claimed briefs and submissions</p>
          </div>
          <MyBriefsListSkeleton />
        </div>
      </main>
    </>
  );
}
