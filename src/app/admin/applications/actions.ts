"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/org";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function reviewApplication(
  applicationId: string,
  decision: "approved" | "rejected"
): Promise<ActionResult> {
  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  if (decision === "approved") {
    const { data, error } = await gate.supabase.rpc("approve_application", {
      p_application_id: applicationId,
      p_admin_id: gate.userId,
    });

    if (error) {
      return { ok: false, error: `Failed to approve: ${error.message}` };
    }
    if (!data) {
      return { ok: false, error: "Application not found or already reviewed" };
    }
  } else {
    const { error } = await gate.supabase
      .from("org_applications")
      .update({
        status: "rejected",
        reviewed_by: gate.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("status", "pending");

    if (error) {
      return { ok: false, error: `Failed to reject: ${error.message}` };
    }
  }

  revalidatePath("/admin/applications");
  return { ok: true };
}
