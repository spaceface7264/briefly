import { ProfileSkeleton } from "@/components/skeletons";

export default function ProfileLoading() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Profile</h1>
        <p className="text-muted">Update your creator information</p>
      </div>
      <ProfileSkeleton />
    </>
  );
}
