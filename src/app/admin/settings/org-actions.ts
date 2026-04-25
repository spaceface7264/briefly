"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgAdmin } from "@/lib/org";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Switch the current user's active org.
 */
export async function switchOrg(orgId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Verify user has a membership in the target org
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .single();

  if (!membership) {
    return { ok: false, error: "You are not a member of this organization" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_org_id: orgId })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: `Failed to switch org: ${error.message}` };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Update organization details (admin only).
 */
export async function updateOrgDetails(
  data: {
    name?: string;
    description?: string;
    logo_url?: string;
    accent_color?: string;
    discoverable?: boolean;
    industry?: string;
    contact_email?: string;
    address?: string;
    cvr?: string;
    vat_number?: string;
  }
): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error } = await gate.supabase
    .from("organizations")
    .update(data)
    .eq("id", gate.orgId);

  if (error) {
    return { ok: false, error: `Failed to update: ${error.message}` };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}
