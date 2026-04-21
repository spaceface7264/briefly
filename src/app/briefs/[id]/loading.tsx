import { Nav } from "@/components/nav";
import { BriefDetailSkeleton } from "@/components/skeletons";

export default function BriefDetailLoading() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <BriefDetailSkeleton />
        </div>
      </main>
    </>
  );
}
