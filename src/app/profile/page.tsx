import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./profile-client";
import { refreshStripeStatus } from "./stripe-actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { stripe: stripeFlag } = await searchParams;

  // Returning from Stripe onboarding — sync latest status before render.
  if (stripeFlag === "return") {
    try {
      await refreshStripeStatus();
    } catch (err) {
      console.error("Failed to refresh Stripe status:", err);
    }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
  }

  return <ProfileClient profile={profile} userEmail={user.email || ""} />;
}
