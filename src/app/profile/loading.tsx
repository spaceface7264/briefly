import { Nav } from "@/components/nav";
import { ProfileSkeleton } from "@/components/skeletons";

export default function ProfileLoading() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Profile</h1>
            <p className="text-muted">Update your creator information</p>
          </div>
          <ProfileSkeleton />
        </div>
      </main>
    </>
  );
}
