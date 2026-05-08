"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requirePlatformAccountOrRedirect,
  logSupportAction,
} from "@/lib/platform";

type LifecycleAction = "suspend" | "restore" | "archive";

interface OrgRow {
  id: string;
  status: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  archived_at: string | null;
}

/**
 * Apply a lifecycle change (suspend / restore / archive) to an org.
 * Platform-admin only. Every transition writes a row to
 * platform_audit_log with the before/after status snapshot.
 *
 * Reversibility is intentional: archive is a state change, not a
 * delete. Restoring an archived org sets status back to 'active' and
 * clears archived_at; the org's data, memberships, and history all
 * survive.
 */
async function applyLifecycle(
  formData: FormData,
  action: LifecycleAction
): Promise<void> {
  const orgId = formData.get("org_id");
  if (typeof orgId !== "string" || !orgId) {
    throw new Error("org_id is required");
  }

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;

  // Suspend specifically wants a reason captured for the
  // billing/legal trail. Restore and archive accept it but don't
  // require it.
  if (action === "suspend" && !reason) {
    throw new Error("Reason is required when suspending an org");
  }

  // Cross-tenant write (the platform admin isn't a member of this
  // org). The RLS-bound client would silently 0-row the UPDATE,
  // leave the audit row in place, and make this look successful.
  // Use the service-role client and rely on requirePlatformAccount
  // for authorization.
  const { supabase, userId } = await requirePlatformAccountOrRedirect();
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("organizations")
    .select("id, status, suspended_at, suspended_reason, archived_at")
    .eq("id", orgId)
    .maybeSingle();
  if (!before) {
    throw new Error("Org not found");
  }

  const beforeRow = before as OrgRow;
  const now = new Date().toISOString();

  // Validate the transition. Active <-> Suspended <-> Archived all
  // round-trip through 'active', so the rules are simple: each verb
  // must produce a different status than the current one. No need
  // for a state machine yet.
  let nextStatus: "active" | "suspended" | "archived";
  let updates: {
    status: "active" | "suspended" | "archived";
    suspended_at: string | null;
    suspended_reason: string | null;
    archived_at: string | null;
  };

  if (action === "suspend") {
    if (beforeRow.status === "suspended") {
      throw new Error("Org is already suspended");
    }
    nextStatus = "suspended";
    updates = {
      status: "suspended",
      suspended_at: now,
      suspended_reason: reason,
      archived_at: null,
    };
  } else if (action === "archive") {
    if (beforeRow.status === "archived") {
      throw new Error("Org is already archived");
    }
    nextStatus = "archived";
    updates = {
      status: "archived",
      suspended_at: null,
      suspended_reason: null,
      archived_at: now,
    };
  } else {
    if (beforeRow.status === "active") {
      throw new Error("Org is already active");
    }
    nextStatus = "active";
    updates = {
      status: "active",
      suspended_at: null,
      suspended_reason: null,
      archived_at: null,
    };
  }

  const { error: updateError } = await admin
    .from("organizations")
    .update(updates)
    .eq("id", orgId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  await logSupportAction(supabase, {
    actorId: userId,
    action: `org.${action}`,
    targetOrgId: orgId,
    targetTable: "organizations",
    targetRowId: orgId,
    reason,
    before: {
      status: beforeRow.status,
      suspended_at: beforeRow.suspended_at,
      suspended_reason: beforeRow.suspended_reason,
      archived_at: beforeRow.archived_at,
    },
    after: {
      status: nextStatus,
      suspended_at: updates.suspended_at,
      suspended_reason: updates.suspended_reason,
      archived_at: updates.archived_at,
    },
  });

  revalidatePath(`/admin/super/orgs/${orgId}`);
  revalidatePath("/admin/super/orgs");
  redirect(`/admin/super/orgs/${orgId}`);
}

export async function suspendOrg(formData: FormData): Promise<void> {
  await applyLifecycle(formData, "suspend");
}

export async function restoreOrg(formData: FormData): Promise<void> {
  await applyLifecycle(formData, "restore");
}

export async function archiveOrg(formData: FormData): Promise<void> {
  await applyLifecycle(formData, "archive");
}
