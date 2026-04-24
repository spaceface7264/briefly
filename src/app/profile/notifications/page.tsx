import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./notifications-client";
import { preferencesFromProfile } from "@/lib/notifications";
import type { UserRole } from "@/types/database";

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
  }

  const preferences = preferencesFromProfile(profile ?? {});

  const role = (profile?.role ?? "creator") as UserRole;

  return <NotificationsClient preferences={preferences} role={role} />;
}
