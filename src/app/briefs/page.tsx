import { createClient } from "@/lib/supabase/server";
import { BriefsClient } from "./briefs-client";
import type { Brief, BriefWithClaims, BriefCategory, BriefFormat } from "@/types/database";

interface Props {
  searchParams: Promise<{
    category?: string;
    format?: string;
  }>;
}

export default async function BriefsPage({ searchParams }: Props) {
  const { category, format } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Build query with filters
  let query = supabase
    .from("briefs")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category as BriefCategory);
  }
  if (format) {
    query = query.eq("format", format as BriefFormat);
  }

  const { data: briefs, error } = await query;

  if (error) {
    console.error("Error fetching briefs:", error);
  }

  // Get claim counts for each brief
  const briefsWithClaims: BriefWithClaims[] = await Promise.all(
    ((briefs || []) as Brief[]).map(async (brief) => {
      const { count } = await supabase
        .from("claims")
        .select("*", { count: "exact", head: true })
        .eq("brief_id", brief.id)
        .eq("status", "active");

      const { data: userClaim } = user
        ? await supabase
            .from("claims")
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

  return (
    <BriefsClient
      briefs={briefsWithClaims}
      initialCategory={category as BriefCategory | undefined}
      initialFormat={format as BriefFormat | undefined}
    />
  );
}
