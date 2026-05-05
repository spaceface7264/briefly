import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { RECLAIM_COOLDOWN_DAYS } from "@/lib/claims";
import { notFound } from "next/navigation";
import { requireCreatorAccount } from "@/lib/account";
import { BriefDetailClient } from "./brief-detail-client";
import {
  extractBrandStoragePath,
  getBrandAssetSignedUrls,
} from "@/lib/storage/brand";
import type { BrandKitPanelData } from "./brand-kit-panel";
import type {
  BrandColor,
  BrandTypography,
} from "@/app/admin/brand/types";

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

  // Fetch the user's most recent live claim for this brief — any state
  // EXCEPT cancelled. The earlier `.eq("status", "active")` filter
  // dropped the claim from the page the moment it flipped to
  // `submitted`, leaving the user staring at a "Claim brief" button
  // after they'd just submitted. ClaimedState in brief-detail-client
  // handles all live states (active / submitted / approved / paid) with
  // the right UI per state, so we just need to feed it the row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userClaim } = user
    ? await (supabase
        .from("claims") as any)
        .select("*")
        .eq("brief_id", id)
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
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

  // Brand kit gate: only fetch + sign URLs when the viewing creator
  // already has a live (non-cancelled, non-rejected) claim on this
  // brief. The userClaim query above already excludes 'cancelled', so
  // any non-null userClaim is enough. We also check status explicitly
  // so we never expose the kit to a stale row that somehow slipped
  // through.
  const brandKit = await maybeLoadBrandKit({
    supabase,
    orgId: brief.org_id,
    userClaim,
  });

  return (
    <BriefDetailClient
      brief={brief}
      claimCount={claimCount || 0}
      userClaim={userClaim}
      reclaimBlockedUntil={reclaimBlockedUntil}
      reclaimCooldownDays={RECLAIM_COOLDOWN_DAYS}
      brandKit={brandKit}
    />
  );
}

// Mirror the RLS policy in 0041_brand_kits_active_claim_fix.sql so the
// page-level gate avoids a wasted round-trip when the claim wouldn't
// pass RLS anyway. Anything that isn't `cancelled` is "live enough" to
// see the kit; `paid` stays in for portfolio / case-study reuse.
const BRAND_KIT_VISIBLE_STATUSES = new Set([
  "active",
  "submitted",
  "approved",
  "paid",
]);

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

async function maybeLoadBrandKit({
  supabase,
  orgId,
  userClaim,
}: {
  supabase: SupabaseLike;
  orgId: string;
  userClaim: { status: string } | null;
}): Promise<BrandKitPanelData | null> {
  if (!userClaim || !BRAND_KIT_VISIBLE_STATUSES.has(userClaim.status)) {
    return null;
  }

  const { data: kit } = await supabase
    .from("brand_kits")
    .select(
      "logo_mark_url, logo_dark_url, logo_light_url, colors, typography, guidelines_url, notes"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  if (!kit) {
    // Org hasn't created a kit yet. Render the empty-state panel so
    // creators know the surface exists and what to expect later.
    return {
      logos: { mark: null, dark: null, light: null },
      colors: [],
      typography: [],
      guidelines: null,
      notes: null,
    };
  }

  const signed = await getBrandAssetSignedUrls({
    logo_mark_url: kit.logo_mark_url,
    logo_dark_url: kit.logo_dark_url,
    logo_light_url: kit.logo_light_url,
    guidelines_url: kit.guidelines_url,
  });

  const guidelinesIsExternal =
    Boolean(kit.guidelines_url) &&
    signed.guidelines_url === kit.guidelines_url;

  return {
    logos: {
      mark: signed.logo_mark_url
        ? { url: signed.logo_mark_url, filename: filenameForLogo("mark", kit.logo_mark_url) }
        : null,
      dark: signed.logo_dark_url
        ? { url: signed.logo_dark_url, filename: filenameForLogo("dark", kit.logo_dark_url) }
        : null,
      light: signed.logo_light_url
        ? { url: signed.logo_light_url, filename: filenameForLogo("light", kit.logo_light_url) }
        : null,
    },
    colors: ((kit.colors as BrandColor[] | null) ?? []) as BrandColor[],
    typography: ((kit.typography as BrandTypography[] | null) ?? []) as BrandTypography[],
    guidelines: signed.guidelines_url
      ? { url: signed.guidelines_url, isExternal: guidelinesIsExternal }
      : null,
    notes: kit.notes,
  };
}

function filenameForLogo(slot: "mark" | "dark" | "light", storedUrl: string | null): string {
  if (!storedUrl) return `logo-${slot}`;
  const storagePath = extractBrandStoragePath(storedUrl);
  if (storagePath) {
    return path.basename(storagePath);
  }
  try {
    const parsed = new URL(storedUrl);
    return path.basename(parsed.pathname) || `logo-${slot}`;
  } catch {
    return `logo-${slot}`;
  }
}
