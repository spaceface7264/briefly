import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MyBriefsClient } from "./my-briefs-client";
import type { Brief, Claim } from "@/types/database";

export type ClaimWithBrief = Claim & { brief: Brief };

export default async function MyBriefsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user's claims with brief details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claims, error } = await (supabase
    .from("claims") as any)
    .select("*, brief:briefs(*)")
    .eq("user_id", user.id)
    .order("claimed_at", { ascending: false });

  if (error) {
    console.error("Error fetching claims:", error);
  }

  // Transform the data to match our expected type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const claimsWithBriefs: ClaimWithBrief[] = ((claims || []) as any[])
    .filter((claim) => claim.brief !== null)
    .map((claim) => ({
      ...claim,
      brief: claim.brief as Brief,
    }));

  return <MyBriefsClient claims={claimsWithBriefs} />;
}
