import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getOrgRole, requireActiveOrg } from "@/lib/org";
import Link from "next/link";
import type { Brief } from "@/types/database";
import { AdminBriefsClient } from "./admin-briefs-client";
import { FlashToast } from "@/components/flash-toast";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

export default async function AdminBriefsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  const supabase = await createClient();
  const orgId = await requireActiveOrg(supabase);
  const role = await getOrgRole(supabase);
  const isAdmin = role === "admin";

  const { data: briefs } = await supabase
    .from("briefs")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const briefIds = ((briefs || []) as Brief[]).map((brief) => brief.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: claimRows } = briefIds.length > 0 ? await (supabase.from("claims") as any)
    .select("brief_id, status")
    .in("brief_id", briefIds) : { data: [] };

  // Track active claims for the slot-fill column AND total claims
  // (any status) so the bulk-delete UI can pre-disable rows that
  // have any claim history. The action layer re-checks server-side,
  // but mirroring the rule here avoids a confusing "click delete →
  // get partial-failure toast" experience.
  const activeClaimCountByBriefId = new Map<string, number>();
  const totalClaimCountByBriefId = new Map<string, number>();
  for (const claim of (claimRows || []) as { brief_id: string; status: string }[]) {
    totalClaimCountByBriefId.set(
      claim.brief_id,
      (totalClaimCountByBriefId.get(claim.brief_id) || 0) + 1
    );
    if (claim.status === "active") {
      activeClaimCountByBriefId.set(
        claim.brief_id,
        (activeClaimCountByBriefId.get(claim.brief_id) || 0) + 1
      );
    }
  }

  const briefsWithCounts = ((briefs || []) as Brief[]).map((brief) => ({
    ...brief,
    activeClaimCount: activeClaimCountByBriefId.get(brief.id) || 0,
    totalClaimCount: totalClaimCountByBriefId.get(brief.id) || 0,
  }));

  return (
    <div>
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>
      <header className="mb-6 flex items-end justify-between gap-4">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
          Briefs
        </h1>
        <Button nativeButton={false} render={<Link href="/admin/briefs/new" />}>
          <PlusIcon data-icon="inline-start" />
          New brief
        </Button>
      </header>

      <AdminBriefsClient briefs={briefsWithCounts} canBulkEdit={isAdmin} />
    </div>
  );
}
