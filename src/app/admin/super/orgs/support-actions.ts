"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAccount } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";

/**
 * Enter support mode for the given org. Server action; redirects to
 * /admin on success so the platform admin lands directly inside the
 * target org's shell.
 *
 * Writes go through the service-role client only for the audit log
 * insert (to skirt RLS during ON CONFLICT-style retries). The
 * profiles.support_org_id update goes through the user's own client —
 * RLS already lets them update their own row.
 */
export async function enterSupportMode(formData: FormData) {
  const orgId = formData.get("org_id");
  if (typeof orgId !== "string" || !orgId) {
    throw new Error("org_id is required");
  }

  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    throw new Error(gate.error);
  }

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) throw new Error("Org not found");

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ support_org_id: orgId })
    .eq("id", gate.userId);
  if (updateError) throw new Error(updateError.message);

  const admin = createAdminClient();
  const { error: auditError } = await admin
    .from("platform_audit_log")
    .insert({
      actor_id: gate.userId,
      action: "support.enter",
      target_org_id: orgId,
      reason,
    });
  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

/**
 * Exit support mode. Clears profiles.support_org_id and sends the
 * platform admin back to /admin/super. Logged so the audit trail
 * brackets each support session with an enter/exit pair.
 */
export async function exitSupportMode() {
  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    throw new Error(gate.error);
  }

  const previousOrgId = gate.supportOrgId;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ support_org_id: null })
    .eq("id", gate.userId);
  if (updateError) throw new Error(updateError.message);

  if (previousOrgId) {
    const admin = createAdminClient();
    const { error: auditError } = await admin
      .from("platform_audit_log")
      .insert({
        actor_id: gate.userId,
        action: "support.exit",
        target_org_id: previousOrgId,
      });
    if (auditError) throw new Error(auditError.message);
  }

  revalidatePath("/admin", "layout");
  redirect("/admin/super");
}
