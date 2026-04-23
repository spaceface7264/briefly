"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function setEmailNotificationsEnabled(
  enabled: boolean
): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (gate.supabase.from("profiles") as any)
    .update({ email_notifications_enabled: enabled })
    .eq("id", gate.userId);

  if (error) {
    return { ok: false, error: `Failed to save preference: ${error.message}` };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false as const, error: "Admin access required" };
  }

  return { ok: true as const, supabase, userId: user.id };
}

export async function promoteToAdmin(targetUserId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!targetUserId) return { ok: false, error: "Missing user id" };

  const { data: target, error: fetchError } = await gate.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .single();

  if (fetchError || !target) {
    return { ok: false, error: "User not found" };
  }

  if (target.role === "admin") {
    return { ok: true }; // idempotent no-op
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (gate.supabase.from("profiles") as any)
    .update({ role: "admin" })
    .eq("id", targetUserId);

  if (updateError) {
    return { ok: false, error: `Failed to promote: ${updateError.message}` };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/creators");
  return { ok: true };
}

export async function demoteFromAdmin(targetUserId: string): Promise<ActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (!targetUserId) return { ok: false, error: "Missing user id" };

  if (targetUserId === gate.userId) {
    return {
      ok: false,
      error:
        "You cannot remove your own admin access. Ask another admin to do it.",
    };
  }

  const { data: target, error: fetchError } = await gate.supabase
    .from("profiles")
    .select("id, role")
    .eq("id", targetUserId)
    .single();

  if (fetchError || !target) {
    return { ok: false, error: "User not found" };
  }

  if (target.role !== "admin") {
    return { ok: true }; // idempotent no-op
  }

  const { count, error: countError } = await gate.supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (countError) {
    return { ok: false, error: "Failed to verify admin count" };
  }

  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error: "At least one admin must remain. Promote someone else first.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (gate.supabase.from("profiles") as any)
    .update({ role: "creator" })
    .eq("id", targetUserId);

  if (updateError) {
    return { ok: false, error: `Failed to demote: ${updateError.message}` };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin/creators");
  return { ok: true };
}
