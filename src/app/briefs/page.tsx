import { createClient } from "@/lib/supabase/server";
import { BriefsClient } from "./briefs-client";
import type { Brief, BriefWithClaims } from "@/types/database";

export default async function BriefsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch open briefs with claim counts
  const { data: briefs, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching briefs:", error);
  }

  // Get claim counts for each brief
  const briefsWithClaims: BriefWithClaims[] = await Promise.all(
    ((briefs || []) as Brief[]).map(async (brief) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (supabase
        .from("claims") as any)
        .select("*", { count: "exact", head: true })
        .eq("brief_id", brief.id)
        .eq("status", "active");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userClaim } = user
        ? await (supabase
            .from("claims") as any)
            .select("id")
            .eq("brief_id", brief.id)
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle()
        : { data: null };

      return {
        ...brief,
        claim_count: count || 0,
        user_has_claimed: !!userClaim,
      };
    })
  );

  return <BriefsClient briefs={briefsWithClaims} />;
}
