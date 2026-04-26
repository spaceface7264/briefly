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

// Where the resolved fee_bp came from. Useful in /admin/super to show
// admins why an org's effective rate is what it is.
export type PricingSource =
  | "free_default"        // Phase 1 fallback — every org reads as Free
  | "subscription"        // Phase 3 — read from org_subscriptions
  | "org_override"        // Phase 2 — pricing_overrides scope_org_id row
  | "user_override"       // Phase 2 — pricing_overrides scope_user_id row
  | "platform_default";   // last-resort hardcoded fallback

export interface ResolvedPricing {
  plan: PricingPlan | null;
  fee_bp: number;
  limits: PlanLimits;
  features: PlanFeatures;
  source: PricingSource;
  // Distinct overrides that contributed to the resolved value.
  // Empty when no override applied.
  applied_overrides: AppliedOverride[];
}

export interface AppliedOverride {
  id: string;
  scope: "org" | "user";
  kind: "fee_bp" | "plan" | "feature_flag" | "limit" | "trial_extension";
  value: Record<string, unknown>;
  reason: string;
  expires_at: string | null;
}

interface OverrideRow {
  id: string;
  kind: AppliedOverride["kind"];
  value: Record<string, unknown>;
  reason: string;
  expires_at: string | null;
  scope_org_id: string | null;
  scope_user_id: string | null;
}

async function loadPlanBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<PricingPlan | null> {
  const { data } = await supabase
    .from("pricing_plans")
    .select("id, slug, name, default_fee_bp, limits, features")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    default_fee_bp: data.default_fee_bp as number,
    limits: (data.limits ?? {}) as PlanLimits,
    features: (data.features ?? {}) as PlanFeatures,
  };
}

async function loadActiveOverrides(
  supabase: SupabaseClient,
  scope: { orgId?: string; userId?: string }
): Promise<OverrideRow[]> {
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("pricing_overrides")
    .select("id, kind, value, reason, expires_at, scope_org_id, scope_user_id")
    .eq("active", true)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("granted_at", { ascending: true });

  if (scope.orgId) query = query.eq("scope_org_id", scope.orgId);
  if (scope.userId) query = query.eq("scope_user_id", scope.userId);

  const { data } = await query;
  return (data ?? []) as unknown as OverrideRow[];
}

function applyOverrides(
  base: ResolvedPricing,
  overrides: OverrideRow[],
  scope: "org" | "user"
): ResolvedPricing {
  const { plan } = base;
  let { fee_bp, limits, features, source } = base;
  const applied = [...base.applied_overrides];

  for (const ov of overrides) {
    const remember: AppliedOverride = {
      id: ov.id,
      scope,
      kind: ov.kind,
      value: ov.value,
      reason: ov.reason,
      expires_at: ov.expires_at,
    };

    switch (ov.kind) {
      case "fee_bp": {
        const next = Number(ov.value.fee_bp);
        if (Number.isFinite(next) && next >= 0 && next <= 10000) {
          fee_bp = next;
          source = scope === "org" ? "org_override" : "user_override";
          applied.push(remember);
        }
        break;
      }
      case "plan": {
        // The plan switch is handled at fetch time (we'd need an
        // async loadPlanBySlug here). For now, record the override
        // so the surface can show it, but the plan swap is performed
        // by resolveOrgPricing before we apply overrides on top.
        applied.push(remember);
        break;
      }
      case "feature_flag": {
        const key = String(ov.value.key);
        const enabled = Boolean(ov.value.enabled);
        if (key) {
          features = { ...features, [key]: enabled };
          applied.push(remember);
        }
        break;
      }
      case "limit": {
        const key = String(ov.value.key);
        const value = ov.value.value;
        if (key) {
          limits = { ...limits, [key]: value as number | null };
          applied.push(remember);
        }
        break;
      }
      case "trial_extension":
        // Recorded; consumed by Phase 3 subscription logic.
        applied.push(remember);
        break;
    }
  }

  return { plan, fee_bp, limits, features, source, applied_overrides: applied };
}

/**
 * Resolve effective pricing for an organisation.
 *
 * Precedence (highest wins):
 *   1. Org-level overrides (`pricing_overrides.scope_org_id = orgId`)
 *   2. Org's subscription plan (Phase 3 — currently always falls
 *      through to Free)
 *   3. Free plan
 *   4. Hardcoded `PLATFORM_DEFAULT_FEE_BP` (only if seed is missing)
 *
 * For payouts that should also respect a per-creator override, call
 * `resolveUserPricing(supabase, userId, orgId)` instead — that wraps
 * this function and layers user-scoped overrides on top.
 */
export async function resolveOrgPricing(
  supabase: SupabaseClient,
  orgId: string
): Promise<ResolvedPricing> {
  // 1. Look for a "plan" override first so we can fetch the right
  //    plan row before computing fee_bp.
  const orgOverrides = await loadActiveOverrides(supabase, { orgId });
  const planOverride = orgOverrides.find((o) => o.kind === "plan");
  const planSlugTarget = planOverride
    ? String(planOverride.value.plan_slug)
    : "free"; // Phase 3 will read the live subscription instead.

  const plan = await loadPlanBySlug(supabase, planSlugTarget);

  let base: ResolvedPricing;
  if (plan) {
    base = {
      plan,
      fee_bp: plan.default_fee_bp,
      limits: plan.limits,
      features: plan.features,
      source: planOverride ? "org_override" : "free_default",
      applied_overrides: [],
    };
  } else {
    base = {
      plan: null,
      fee_bp: PLATFORM_DEFAULT_FEE_BP,
      limits: {},
      features: {},
      source: "platform_default",
      applied_overrides: [],
    };
  }

  return applyOverrides(base, orgOverrides, "org");
}

/**
 * Resolve effective pricing for a specific user-in-org context.
 * Starts from the org's resolved pricing and layers per-user
 * overrides. Used at payout time so a per-creator fee waiver
 * applies.
 */
export async function resolveUserPricing(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<ResolvedPricing> {
  const orgPricing = await resolveOrgPricing(supabase, orgId);
  const userOverrides = await loadActiveOverrides(supabase, { userId });
  return applyOverrides(orgPricing, userOverrides, "user");
}

/**
 * Compute the platform fee for a payout. Floors the fee so rounding
 * errors on small amounts always favour the creator.
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
 * revenue).
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

// Format helpers used by the admin surface.
export function formatFeeBp(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

export function formatDkk(amountDkk: number): string {
  return `${amountDkk.toLocaleString("da-DK")} DKK`;
}
