import { createClient } from "@/lib/supabase/server";
import { requireActiveOrg } from "@/lib/org";
import { requireOnboardedCreator } from "@/lib/account";
import { BriefsClient } from "./briefs-client";
import { rankBriefsForCreator } from "@/lib/brief-matching";
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
  await requireOnboardedCreator(supabase);
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

  // Fetch the active org's identity (name + logo + accent) and the
  // viewer's profile (for match scoring) in parallel with the brief
  // list so the page has everything it needs from the first paint.
  const [{ data: briefs, error }, { data: org }, { data: profile }] =
    await Promise.all([
      query,
      supabase
        .from("organizations")
        .select("name, logo_url, accent_color")
        .eq("id", orgId)
        .single(),
      user
        ? supabase
            .from("profiles")
            .select("skills, languages, country")
            .eq("id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (error) {
    console.error("Error fetching briefs:", error);
  }

  // Rank briefs against the creator's profile before fanning out the
  // per-brief claim-count queries. Sort applies to the list passed
  // to the client, so the order on /briefs reflects match quality.
  const ranked = profile
    ? rankBriefsForCreator(
        (briefs ?? []) as Brief[],
        {
          skills: (profile as { skills?: string[] }).skills ?? [],
          languages: (profile as { languages?: string[] }).languages ?? [],
          country: (profile as { country?: string | null }).country ?? null,
        }
      )
    : ((briefs ?? []) as Brief[]).map((brief) => ({
        brief,
        match: { score: 0, overlapCount: 0, hasTargeting: false },
      }));

  // Get claim counts for each brief (parallel, preserves ranked order).
  const briefsWithClaims: BriefWithClaims[] = await Promise.all(
    ranked.map(async ({ brief, match }) => {
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
        match,
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
