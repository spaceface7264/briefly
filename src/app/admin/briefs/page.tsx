import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Brief } from "@/types/database";
import { AdminBriefsClient } from "./admin-briefs-client";

export default async function AdminBriefsPage({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  const supabase = await createClient();

  const { data: briefs } = await supabase
    .from("briefs")
    .select("*")
    .order("created_at", { ascending: false });

  const briefIds = ((briefs || []) as Brief[]).map((brief) => brief.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeClaims } = briefIds.length > 0 ? await (supabase.from("claims") as any)
    .select("brief_id")
    .in("brief_id", briefIds)
    .eq("status", "active") : { data: [] };

  const claimCountByBriefId = new Map<string, number>();
  for (const claim of activeClaims || []) {
    claimCountByBriefId.set(claim.brief_id, (claimCountByBriefId.get(claim.brief_id) || 0) + 1);
  }

  const briefsWithCounts = ((briefs || []) as Brief[]).map((brief) => ({
    ...brief,
    activeClaimCount: claimCountByBriefId.get(brief.id) || 0,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Briefs</h1>
          <p className="text-muted text-sm mt-1">Showing {briefsWithCounts.length} total</p>
        </div>
        <Link
          href="/admin/briefs/new"
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
        >
          Create Brief
        </Link>
      </div>

      <AdminBriefsClient briefs={briefsWithCounts} />
    </div>
  );
}
