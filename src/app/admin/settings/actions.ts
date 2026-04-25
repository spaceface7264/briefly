"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/org";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function promoteToAdmin(targetUserId: string): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!targetUserId) return { ok: false, error: "Missing user id" };

  // Check if user has a membership in this org
  const { data: membership, error: fetchError } = await gate.supabase
    .from("memberships")
    .select("id, role")
    .eq("user_id", targetUserId)
    .eq("org_id", gate.orgId)
    .eq("status", "active")
    .single();

  if (fetchError || !membership) {
    return { ok: false, error: "User is not a member of this organization" };
  }

  if (membership.role === "admin") {
    return { ok: true }; // idempotent no-op
  }

  const { error: updateError } = await gate.supabase
    .from("memberships")
    .update({ role: "admin" })
    .eq("id", membership.id);

  if (updateError) {
    return { ok: false, error: `Failed to promote: ${updateError.message}` };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/creators");
  return { ok: true };
}

export async function demoteFromAdmin(targetUserId: string): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!targetUserId) return { ok: false, error: "Missing user id" };

  if (targetUserId === gate.userId) {
    return {
      ok: false,
      error:
        "You cannot remove your own admin access. Ask another admin to do it.",
    };
  }

  // Check if user has an admin membership in this org
  const { data: membership, error: fetchError } = await gate.supabase
    .from("memberships")
    .select("id, role")
    .eq("user_id", targetUserId)
    .eq("org_id", gate.orgId)
    .eq("status", "active")
    .single();

  if (fetchError || !membership) {
    return { ok: false, error: "User not found in this organization" };
  }

  if (membership.role !== "admin") {
    return { ok: true }; // idempotent no-op
  }

  // Ensure at least one admin remains in this org
  const { count, error: countError } = await gate.supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("org_id", gate.orgId)
    .eq("role", "admin")
    .eq("status", "active");

  if (countError) {
    return { ok: false, error: "Failed to verify admin count" };
  }

  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error: "At least one admin must remain. Promote someone else first.",
    };
  }

  const { error: updateError } = await gate.supabase
    .from("memberships")
    .update({ role: "creator" })
    .eq("id", membership.id);

  if (updateError) {
    return { ok: false, error: `Failed to demote: ${updateError.message}` };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/creators");
  return { ok: true };
}
