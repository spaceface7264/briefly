import type { SupabaseClient } from "@supabase/supabase-js";

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

// Statuses that mean the subscription is "live" — the org is on
// that plan right now. Everything else (canceled, incomplete, etc.)
// falls through to the Free plan.
const LIVE_SUB_STATUSES = new Set([
  "free",
  "trialing",
  "active",
  "past_due",
]);

interface SubscriptionPlanRow {
  status: string;
  plan: PricingPlan | null;
}

async function loadOrgSubscriptionPlan(
  supabase: SupabaseClient,
  orgId: string
): Promise<SubscriptionPlanRow | null> {
  const { data } = await supabase
    .from("org_subscriptions")
    .select(
      "status, plan:pricing_plans(id, slug, name, default_fee_bp, limits, features)"
    )
    .eq("org_id", orgId)
    .maybeSingle();
  if (!data) return null;
  // The Supabase TS helper types FK-related data as an array because
  // it can't tell that this FK is many-to-one (plan_id has no unique
  // constraint pointing at it). At runtime it's a single object.
  const planRow = data.plan as unknown as
    | (Omit<PricingPlan, "limits" | "features"> & {
        limits: unknown;
        features: unknown;
      })
    | null;
  if (!planRow) return { status: data.status as string, plan: null };
  return {
    status: data.status as string,
    plan: {
      id: planRow.id,
      slug: planRow.slug,
      name: planRow.name,
      default_fee_bp: planRow.default_fee_bp,
      limits: (planRow.limits ?? {}) as PlanLimits,
      features: (planRow.features ?? {}) as PlanFeatures,
    },
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
  const orgOverrides = await loadActiveOverrides(supabase, { orgId });

  // 1. Plan override wins — admin manually placed the org on a
  //    specific plan slug (typically a comp Pro account).
  const planOverride = orgOverrides.find((o) => o.kind === "plan");

  let plan: PricingPlan | null = null;
  let source: PricingSource;

  if (planOverride) {
    plan = await loadPlanBySlug(supabase, String(planOverride.value.plan_slug));
    source = "org_override";
  } else {
    // 2. Live Stripe subscription — read the org's current plan.
    const sub = await loadOrgSubscriptionPlan(supabase, orgId);
    if (sub && sub.plan && LIVE_SUB_STATUSES.has(sub.status)) {
      plan = sub.plan;
      source = "subscription";
    } else {
      // 3. Free fallback. Either no subscription row (shouldn't
      //    happen post-0028 backfill) or the sub lapsed.
      plan = await loadPlanBySlug(supabase, "free");
      source = "free_default";
    }
  }

  const base: ResolvedPricing = plan
    ? {
        plan,
        fee_bp: plan.default_fee_bp,
        limits: plan.limits,
        features: plan.features,
        source,
        applied_overrides: [],
      }
    : {
        plan: null,
        fee_bp: PLATFORM_DEFAULT_FEE_BP,
        limits: {},
        features: {},
        source: "platform_default",
        applied_overrides: [],
      };

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
 * Detect "PLAN_LIMIT_EXCEEDED:" exceptions raised by the database
 * triggers from migration 0029. Returns the human-readable part of
 * the message (without the prefix), or null if this isn't a
 * plan-limit error.
 *
 * UI handlers should surface this directly and link to /admin/billing
 * when present.
 */
export function planLimitErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return null;
  if (!message.startsWith("PLAN_LIMIT_EXCEEDED:")) return null;
  return message.replace(/^PLAN_LIMIT_EXCEEDED:\s*/, "").trim();
}

// Format helpers used by the admin surface.
export function formatFeeBp(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

export function formatDkk(amountDkk: number): string {
  return `${amountDkk.toLocaleString("da-DK")} DKK`;
}
