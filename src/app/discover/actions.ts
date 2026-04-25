"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function applyToOrg(
  orgId: string,
  message?: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not authenticated" };

  // Check if already a member
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (existing) {
    return { ok: false, error: "You are already a member of this organization" };
  }

  // Check if already applied
  const { data: existingApp } = await supabase
    .from("org_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .single();

  if (existingApp) {
    if (existingApp.status === "pending") {
      return { ok: false, error: "You already have a pending application" };
    }
    if (existingApp.status === "rejected") {
      return { ok: false, error: "Your application was not accepted" };
    }
  }

  const { error } = await supabase.from("org_applications").insert({
    user_id: user.id,
    org_id: orgId,
    message: message || null,
  });

  if (error) {
    return { ok: false, error: `Failed to apply: ${error.message}` };
  }

  revalidatePath(`/discover`);
  return { ok: true };
}
