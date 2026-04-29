import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { requireCreatorAccount } from "@/lib/account";
import { NotificationsClient } from "./notifications-client";
import { preferencesFromProfile } from "@/lib/notifications";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Org users see their notification prefs inside /admin/settings.
  await requireCreatorAccount(supabase);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
  }

  const preferences = preferencesFromProfile(profile ?? {});

  return <NotificationsClient preferences={preferences} />;
}
