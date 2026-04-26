"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/pricing-server";
import type { Json } from "@/types/database";

type ActionResult = { ok: true } | { ok: false; error: string };

interface GrantOrgOverrideInput {
  orgId: string;
  kind: "fee_bp" | "plan" | "feature_flag" | "limit" | "trial_extension";
  value: Record<string, unknown>;
  reason: string;
  expiresAt?: string | null;
}

export async function grantOrgOverride(
  input: GrantOrgOverrideInput
): Promise<ActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!input.reason || input.reason.trim().length < 3) {
    return { ok: false, error: "Reason is required (min 3 chars)" };
  }

  const { data: row, error } = await gate.supabase
    .from("pricing_overrides")
    .insert({
      scope_org_id: input.orgId,
      scope_user_id: null,
      kind: input.kind,
      value: input.value as Json,
      reason: input.reason.trim(),
      granted_by: gate.userId,
      expires_at: input.expiresAt ?? null,
      active: true,
    })
    .select("id")
    .single();

  if (error || !row) {
    return { ok: false, error: error?.message ?? "Failed to grant override" };
  }

  await gate.supabase.from("pricing_audit_log").insert({
    actor_id: gate.userId,
    action: "override.granted",
    scope_org_id: input.orgId,
    before: null,
    after: {
      kind: input.kind,
      value: input.value,
      expires_at: input.expiresAt ?? null,
    } as Json,
    reason: input.reason.trim(),
  });

  revalidatePath(`/admin/super/orgs/${input.orgId}`);
  revalidatePath(`/admin/super/orgs`);
  revalidatePath(`/admin/super/audit`);
  return { ok: true };
}

export async function revokeOverride(
  overrideId: string,
  reason: string
): Promise<ActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "Reason is required (min 3 chars)" };
  }

  const { data: existing, error: fetchError } = await gate.supabase
    .from("pricing_overrides")
    .select("id, scope_org_id, scope_user_id, kind, value")
    .eq("id", overrideId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Override not found" };
  }

  const { error: updateError } = await gate.supabase
    .from("pricing_overrides")
    .update({ active: false })
    .eq("id", overrideId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await gate.supabase.from("pricing_audit_log").insert({
    actor_id: gate.userId,
    action: "override.revoked",
    scope_org_id: existing.scope_org_id,
    scope_user_id: existing.scope_user_id,
    before: { kind: existing.kind, value: existing.value } as Json,
    after: null,
    reason: reason.trim(),
  });

  if (existing.scope_org_id) {
    revalidatePath(`/admin/super/orgs/${existing.scope_org_id}`);
  }
  revalidatePath(`/admin/super/orgs`);
  revalidatePath(`/admin/super/audit`);
  return { ok: true };
}
