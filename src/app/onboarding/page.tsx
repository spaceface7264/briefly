import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCreatorAccount } from "@/lib/account";
import { readSocialHandles } from "@/lib/socials";
import { OnboardingClient } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Org / platform accounts have their own shells. Bounce them out
  // before they see the creator-interview UI.
  await requireCreatorAccount(supabase);

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "name, avatar_url, bio, city, country, languages, skills, social_handles, onboarded_at"
    )
    .eq("id", user.id)
    .single();

  // Already finished? Send them on. /onboarding is a one-shot route;
  // there's no "edit interview" — that lives in /profile/settings.
  if (profile?.onboarded_at) redirect("/briefs");

  // Seed the client with whatever we already have. Email local-part
  // serves as a soft default for the display name when the profile
  // row is empty — gives the user something to confirm instead of an
  // empty input on step 1.
  const fallbackName = (user.email ?? "").split("@")[0] ?? "";

  return (
    <OnboardingClient
      initial={{
        name: profile?.name ?? fallbackName,
        avatarUrl: profile?.avatar_url ?? null,
        bio: profile?.bio ?? "",
        city: profile?.city ?? null,
        country: profile?.country ?? null,
        languages: profile?.languages ?? [],
        skills: profile?.skills ?? [],
        socials: readSocialHandles(profile?.social_handles),
      }}
      userEmail={user.email ?? ""}
      initialError={params.error ?? null}
    />
  );
}
