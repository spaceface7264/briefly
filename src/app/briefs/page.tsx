import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { requireCreatorAccount } from "@/lib/account";
import { BriefsClient } from "./briefs-client";
import type { Brief, BriefWithClaims, BriefCategory, BriefDurationClass } from "@/types/database";

interface Props {
  searchParams: Promise<{
    category?: string;
    duration?: string;
  }>;
}

export default async function BriefsPage({ searchParams }: Props) {
  const { category, duration } = await searchParams;
  const supabase = await createClient();
  await requireCreatorAccount(supabase);
  const orgId = await requireActiveOrg(supabase);

  const { data: { user } } = await supabase.auth.getUser();

  // Build query with filters
  let query = supabase
    .from("briefs")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category as BriefCategory);
  }
  if (duration) {
    query = query.eq("duration_class", duration as BriefDurationClass);
  }

  // Fetch the active org's identity (name + logo + accent) in parallel
  // with the brief list so the "Briefs by <org>" header has the data
  // it needs from the very first paint. accent_color drives the
  // initial-letter fallback tile when logo_url is null, matching the
  // org-identity treatment in the admin sidebar.
  const [{ data: briefs, error }, { data: org }] = await Promise.all([
    query,
    supabase
      .from("organizations")
      .select("name, logo_url, accent_color")
      .eq("id", orgId)
      .single(),
  ]);

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
      initialDurationClass={duration as BriefDurationClass | undefined}
      org={
        org
          ? {
              name: org.name,
              logoUrl: org.logo_url,
              accentColor: org.accent_color,
            }
          : null
      }
    />
  );
}
