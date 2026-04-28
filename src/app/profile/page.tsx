import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireCreatorAccount } from "@/lib/account";
import { ProfileInfoClient } from "./profile-info-client";

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Org users manage their personal info inside /admin/settings.
  await requireCreatorAccount(supabase);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching profile:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }

  return <ProfileInfoClient profile={profile} userEmail={user.email || ""} />;
}
