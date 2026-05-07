import type { SupabaseClient } from "@supabase/supabase-js";

// Hard fallback if the pricing_plans seed never ran for some reason.
// Matches the Free plan's seeded default_fee_bp.
const PLATFORM_DEFAULT_FEE_BP = 500;

// Stripe rejects DKK charges below 2.50 kr (250 øre). Since DKK is
// stored in whole units across the app, the practical minimum total
// escrow on a publish-time PaymentIntent is 3 DKK. Enforced both
// server-side in createBriefWithEscrow and in the brief form so the
// user doesn't round-trip Stripe just to learn the floor.
export const MIN_TOTAL_ESCROW_DKK = 3;

// Hard cap on brief titles. Matches the existing 80-char truncations
// scattered through the app (Stripe PaymentIntent description, toast
// description ellipsize, notification snippets) so the UI never has
// to guess at how much to clip. Enforced both client-side via the
// input's maxLength and server-side in createBriefWithEscrow so a
// crafted request can't sneak past the form.
export const MAX_BRIEF_TITLE_LEN = 80;

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
  // Pricing v2 (migration 0044). Null on either field = unlimited /
  // not metered. monthly_brief_allowance is the count of briefs an
  // org can publish per period before overages kick in.
  // overage_dkk_per_brief is the flat fee charged per extra brief
  // beyond the allowance.
  monthly_brief_allowance: number | null;
  overage_dkk_per_brief: number | null;
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
    .select("id, slug, name, default_fee_bp, monthly_brief_allowance, overage_dkk_per_brief, limits, features")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    slug: data.slug as string,
    name: data.name as string,
    default_fee_bp: data.default_fee_bp as number,
    monthly_brief_allowance: (data.monthly_brief_allowance ?? null) as number | null,
    overage_dkk_per_brief: (data.overage_dkk_per_brief ?? null) as number | null,
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
      "status, plan:pricing_plans(id, slug, name, default_fee_bp, monthly_brief_allowance, overage_dkk_per_brief, limits, features)"
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
      monthly_brief_allowance: planRow.monthly_brief_allowance ?? null,
      overage_dkk_per_brief: planRow.overage_dkk_per_brief ?? null,
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

/**
 * Read the org's brief publishing state for the current period.
 *
 * Lazy reset semantics: if `period_anchor + 1 month < now()` the
 * stored counter is stale (Free plan has no Stripe webhook to reset
 * it). Callers that need to *commit* a publish will atomically reset
 * inside the same transaction; this read helper only reports the
 * effective values, treating the counter as 0 when the anchor has
 * expired so the UI shows the right "remaining" without first
 * mutating.
 */
export interface BriefAllowanceState {
  // Allowance from the resolved plan. Null = unlimited (Pro/Enterprise).
  allowance: number | null;
  // Overage rate from the resolved plan. Null = no overage permitted
  // (Pro/Enterprise — they don't have overages, but they also don't
  // need them since allowance is unlimited).
  overageDkk: number | null;
  // Counter as it would be after applying lazy reset.
  publishedThisPeriod: number;
  // Anchor as it would be after applying lazy reset.
  periodAnchor: string;
  // Convenience: allowance - publishedThisPeriod, or null when
  // unlimited. Negative values indicate prior overage publishes
  // already happened this period (shouldn't happen with the lazy
  // reset, but the math allows it for safety).
  remaining: number | null;
}

export async function getBriefAllowanceState(
  supabase: SupabaseClient,
  orgId: string
): Promise<BriefAllowanceState> {
  const pricing = await resolveOrgPricing(supabase, orgId);
  const allowance = pricing.plan?.monthly_brief_allowance ?? null;
  const overageDkk = pricing.plan?.overage_dkk_per_brief ?? null;

  const { data: sub } = await supabase
    .from("org_subscriptions")
    .select("briefs_published_this_period, period_anchor")
    .eq("org_id", orgId)
    .maybeSingle();

  const storedCount = (sub?.briefs_published_this_period ?? 0) as number;
  const storedAnchor = (sub?.period_anchor ?? new Date().toISOString()) as string;

  const anchorMs = new Date(storedAnchor).getTime();
  const nowMs = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const expired = anchorMs + monthMs < nowMs;

  const publishedThisPeriod = expired ? 0 : storedCount;
  const periodAnchor = expired ? new Date().toISOString() : storedAnchor;

  const remaining =
    allowance === null ? null : Math.max(0, allowance - publishedThisPeriod);

  return {
    allowance,
    overageDkk,
    publishedThisPeriod,
    periodAnchor,
    remaining,
  };
}

/**
 * Decide what charging the next publish will cost the org. Read-only
 * counterpart to the server-side commit step.
 *
 *   { kind: "allowance" }              — covered by the included quota
 *   { kind: "overage", overageDkk: N } — over the quota, charge N DKK
 *   { kind: "blocked" }                — over the quota, no overage
 *                                        permitted (Pro/Enterprise
 *                                        won't hit this since they're
 *                                        unlimited; Free/Studio hit
 *                                        this only if a future plan
 *                                        sets overage_dkk_per_brief
 *                                        to NULL deliberately)
 */
export type PublishChargeDecision =
  | { kind: "allowance" }
  | { kind: "overage"; overageDkk: number }
  | { kind: "blocked"; reason: string };

export function decidePublishCharge(
  state: BriefAllowanceState
): PublishChargeDecision {
  if (state.allowance === null) {
    return { kind: "allowance" };
  }
  if (state.publishedThisPeriod < state.allowance) {
    return { kind: "allowance" };
  }
  if (state.overageDkk !== null && state.overageDkk > 0) {
    return { kind: "overage", overageDkk: state.overageDkk };
  }
  return {
    kind: "blocked",
    reason:
      "Your plan's monthly brief allowance is exhausted and overages are not enabled. Upgrade to publish more.",
  };
}

// Format helpers used by the admin surface.
export function formatFeeBp(bp: number): string {
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

export function formatDkk(amountDkk: number): string {
  return `${amountDkk.toLocaleString("da-DK")} DKK`;
}
