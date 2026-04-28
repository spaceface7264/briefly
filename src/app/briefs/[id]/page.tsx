import { createClient } from "@/lib/supabase/server";
import { RECLAIM_COOLDOWN_DAYS } from "@/lib/claims";
import { notFound } from "next/navigation";
import { requireCreatorAccount } from "@/lib/account";
import { BriefDetailClient } from "./brief-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BriefDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  await requireCreatorAccount(supabase);

  const { data: { user } } = await supabase.auth.getUser();

  const { data: brief, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !brief) {
    notFound();
  }

  // Get claim count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: claimCount } = await (supabase
    .from("claims") as any)
    .select("*", { count: "exact", head: true })
    .eq("brief_id", id)
    .eq("status", "active");

  // Check if user has claimed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userClaim } = user
    ? await (supabase
        .from("claims") as any)
        .select("*")
        .eq("brief_id", id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };

  // Cooldown: after releasing/cancelling, creators must wait before reclaiming
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latestCancelledClaim } = user
    ? await (supabase
        .from("claims") as any)
        .select("updated_at")
        .eq("brief_id", id)
        .eq("user_id", user.id)
        .eq("status", "cancelled")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  let reclaimBlockedUntil: string | null = null;
  if (latestCancelledClaim?.updated_at) {
    const cancelledAt = new Date(latestCancelledClaim.updated_at);
    const cooldownEndsAt = new Date(
      cancelledAt.getTime() + RECLAIM_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );
    if (cooldownEndsAt > new Date()) {
      reclaimBlockedUntil = cooldownEndsAt.toISOString();
    }
  }

  return (
    <BriefDetailClient
      brief={brief}
      claimCount={claimCount || 0}
      userClaim={userClaim}
      reclaimBlockedUntil={reclaimBlockedUntil}
      reclaimCooldownDays={RECLAIM_COOLDOWN_DAYS}
    />
  );
}
