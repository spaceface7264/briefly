import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Hard fallback if the pricing_plans seed never ran for some reason.
// Matches the Free plan's seeded default_fee_bp.
const PLATFORM_DEFAULT_FEE_BP = 500;

export interface PlanLimits {
  max_active_briefs?: number | null;
  max_creators?: number | null;
}

export interface PlanFeatures {
  analytics?: boolean;
  custom_branding?: boolean;
  discovery_boost?: boolean;
}

export interface PricingPlan {
  id: string;
  slug: string;
  name: string;
  default_fee_bp: number;
  limits: PlanLimits;
  features: PlanFeatures;
}

export interface ResolvedPricing {
  plan: PricingPlan | null;
  fee_bp: number;
  limits: PlanLimits;
  features: PlanFeatures;
  // Where the fee_bp came from. Phase 2 will add 'override',
  // Phase 3 will populate 'subscription' from a real org_subscriptions row.
  source: "free_default" | "platform_default";
}

/**
 * Resolve the effective pricing for an org.
 *
 * Phase 1: every org reads as "Free plan". Phase 2 will layer
 * `pricing_overrides`. Phase 3 will read the org's active
 * `org_subscriptions` row and only fall through to Free when none
 * exists (or when the subscription is canceled/past_due).
 *
 * Callers should treat the returned shape as opaque — never read
 * `org.fee_bp` directly anywhere in the codebase.
 */
export async function resolveOrgPricing(
  supabase: SupabaseClient,
  orgId: string
): Promise<ResolvedPricing> {
  // Phase 2 will look up overrides by orgId, Phase 3 the active
  // org_subscriptions row. Reference here so the param is actually
  // typed at call sites today.
  void orgId;

  const { data } = await supabase
    .from("pricing_plans")
    .select("id, slug, name, default_fee_bp, limits, features")
    .eq("slug", "free")
    .maybeSingle();

  if (data) {
    const plan: PricingPlan = {
      id: data.id as string,
      slug: data.slug as string,
      name: data.name as string,
      default_fee_bp: data.default_fee_bp as number,
      limits: (data.limits ?? {}) as PlanLimits,
      features: (data.features ?? {}) as PlanFeatures,
    };
    return {
      plan,
      fee_bp: plan.default_fee_bp,
      limits: plan.limits,
      features: plan.features,
      source: "free_default",
    };
  }

  return {
    plan: null,
    fee_bp: PLATFORM_DEFAULT_FEE_BP,
    limits: {},
    features: {},
    source: "platform_default",
  };
}

/**
 * Compute the platform fee for a payout. Floors the fee so rounding
 * errors on small amounts always favour the creator (creator never
 * gets short-changed by a rounding artefact).
 */
export function computeFee(
  grossDkk: number,
  feeBp: number
): { feeDkk: number; netDkk: number } {
  if (grossDkk <= 0 || feeBp <= 0) {
    return { feeDkk: 0, netDkk: grossDkk };
  }
  const feeDkk = Math.floor((grossDkk * feeBp) / 10000);
  return { feeDkk, netDkk: grossDkk - feeDkk };
}

/**
 * Guard for server actions and routes that should only run for
 * platform-level admins (manage plans, grant overrides, view
 * revenue). Distinct from `requireOrgAdmin` — platform admins are a
 * tiny set of users (typically the founders), per-org admins are
 * customer-side admins of an individual org.
 */
export async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: "Not authenticated" };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_platform_admin) {
    return { ok: false as const, error: "Platform admin access required" };
  }
  return { ok: true as const, supabase, userId: user.id };
}
