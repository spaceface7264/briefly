import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { BriefDetailClient } from "./brief-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BriefDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

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

  return (
    <BriefDetailClient
      brief={brief}
      claimCount={claimCount || 0}
      userClaim={userClaim}
    />
  );
}
