import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Atomically increment the org's brief publish counter for the
 * current period, lazily resetting it when the period anchor has
 * expired.
 *
 * Always pair with a successful `decidePublishCharge` outcome from
 * `src/lib/pricing.ts` and a successful Stripe charge — call this
 * AFTER both resolve so a failed charge doesn't leave a phantom
 * publish on the meter.
 *
 * Race window (documented, accepted): two concurrent publishes can
 * both read `published = N, allowance = N+1` and both decide
 * "allowance" without overage. Both then increment to N+1 and N+2.
 * The N+2 publish was over-quota but the org is not charged the
 * overage. Cost is bounded (one bypass per concurrency window) and
 * acceptable for early-stage volume. To close the window, replace
 * the atomic UPDATE here with a Postgres function that does
 * SELECT ... FOR UPDATE + the charge decision in one transaction.
 *
 * Caller MUST use the service-role admin client (RLS on
 * org_subscriptions blocks non-platform-admin writes).
 */
export async function commitBriefPublishCount(
  adminDb: SupabaseClient<Database>,
  orgId: string
): Promise<{ ok: true; newCount: number } | { ok: false; error: string }> {
  // Single atomic UPDATE: the CASE expressions handle the lazy reset
  // and the increment together. Postgres serializes per-row updates,
  // so concurrent calls to this function never lose a write — they
  // just both increment from whatever the row was when each acquired
  // the row lock for its UPDATE statement.
  //
  // We can't easily express a CASE-based atomic update through the
  // Supabase JS query builder, so go through the SQL RPC. The
  // function is named `commit_brief_publish` and is created in
  // migration 0045.
  const { data, error } = await adminDb.rpc("commit_brief_publish", {
    p_org_id: orgId,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  // Postgres function with `RETURNS TABLE(...)` returns an array of
  // rows. We always select one org, so take the first.
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      ok: false,
      error: `No org_subscriptions row for org ${orgId}`,
    };
  }
  return { ok: true, newCount: row.new_count };
}

/**
 * Reverse a publish-counter increment when a downstream step fails
 * after `commitBriefPublishCount` already ran. Idempotent at the SQL
 * level — multiple calls clamp at zero.
 *
 * Use this only for compensating rollbacks. The normal happy path
 * never decrements; the counter persists through the period.
 */
export async function decrementBriefPublishCount(
  adminDb: SupabaseClient<Database>,
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await adminDb.rpc("decrement_brief_publish", {
    p_org_id: orgId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
