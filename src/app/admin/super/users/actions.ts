"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSupportAction, requirePlatformAccount } from "@/lib/platform";
import {
  RESET_LINK_COOKIE_PREFIX,
  RESET_LINK_TTL_SECONDS,
} from "./constants";

/**
 * Disable a user. Sets profiles.disabled_at = now() and stores the
 * operator's reason so the support trail captures *why* a user was
 * flagged (chargeback, ToS, payout dispute, etc.).
 *
 * v1 caveat: this is a flag, not a hard ban. The auth row is
 * untouched, so the user can still sign in. Existing requireOrgAdmin
 * / requireCreatorAccount gates do NOT consult disabled_at yet, that's
 * a follow-up tightening. The platform admin uses this column today
 * to mark "do not engage" users in the dashboard and audit log.
 */
export async function disableUser(formData: FormData): Promise<void> {
  const userId = formData.get("user_id");
  if (typeof userId !== "string" || !userId) {
    throw new Error("user_id is required");
  }

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;
  if (!reason) {
    throw new Error("Reason is required when disabling a user");
  }

  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    throw new Error(gate.error);
  }

  const admin = createAdminClient();

  // Re-fetch the row from the trust-boundary client so the audit
  // before/after captures whatever's actually in the table, not a
  // client-side echo. Also lets us short-circuit if the row is
  // already disabled.
  const { data: before, error: beforeError } = await admin
    .from("profiles")
    .select("id, disabled_at, disabled_reason")
    .eq("id", userId)
    .maybeSingle();
  if (beforeError) {
    throw new Error(beforeError.message);
  }
  if (!before) {
    throw new Error("User not found");
  }
  if (before.disabled_at) {
    throw new Error("User is already disabled");
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("profiles")
    .update({ disabled_at: now, disabled_reason: reason })
    .eq("id", userId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  await logSupportAction(supabase, {
    actorId: gate.userId,
    action: "user.disable",
    targetOrgId: null,
    targetTable: "profiles",
    targetRowId: userId,
    reason,
    before: {
      disabled_at: before.disabled_at,
      disabled_reason: before.disabled_reason,
    },
    after: {
      disabled_at: now,
      disabled_reason: reason,
    },
  });

  revalidatePath(`/admin/super/users/${userId}`);
  revalidatePath("/admin/super/users");
  redirect(`/admin/super/users/${userId}`);
}

/**
 * Re-enable a previously disabled user by clearing both columns.
 * Reason is optional here, the disable action already captured why
 * the user was flagged in the first place. Logged so the audit
 * trail brackets each disable / enable cycle.
 */
export async function enableUser(formData: FormData): Promise<void> {
  const userId = formData.get("user_id");
  if (typeof userId !== "string" || !userId) {
    throw new Error("user_id is required");
  }

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" && reasonRaw.trim().length > 0
      ? reasonRaw.trim().slice(0, 500)
      : null;

  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    throw new Error(gate.error);
  }

  const admin = createAdminClient();

  const { data: before, error: beforeError } = await admin
    .from("profiles")
    .select("id, disabled_at, disabled_reason")
    .eq("id", userId)
    .maybeSingle();
  if (beforeError) {
    throw new Error(beforeError.message);
  }
  if (!before) {
    throw new Error("User not found");
  }
  if (!before.disabled_at) {
    throw new Error("User is already active");
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ disabled_at: null, disabled_reason: null })
    .eq("id", userId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  await logSupportAction(supabase, {
    actorId: gate.userId,
    action: "user.enable",
    targetOrgId: null,
    targetTable: "profiles",
    targetRowId: userId,
    reason,
    before: {
      disabled_at: before.disabled_at,
      disabled_reason: before.disabled_reason,
    },
    after: {
      disabled_at: null,
      disabled_reason: null,
    },
  });

  revalidatePath(`/admin/super/users/${userId}`);
  revalidatePath("/admin/super/users");
  redirect(`/admin/super/users/${userId}`);
}

/**
 * Generate a password-recovery link for the target user. Returns the
 * URL via a redirect that puts it on the detail page's query string,
 * so the platform admin can copy and forward it. We deliberately do
 * NOT email the link in v1; the operator pastes it into whatever
 * channel they're already talking to the user on.
 *
 * Uses supabase.auth.admin.generateLink which requires the service-
 * role client. The link is single-use and short-lived per Supabase's
 * defaults (1 hour), but anyone who reads the link can reset the
 * target's password, so we still keep it out of the URL (which would
 * persist in browser history + leak via Referer). Instead, we stash
 * it in an HttpOnly path-scoped cookie with a 60s TTL; the detail
 * page reads it once on render and immediately clears it.
 */
export async function forcePasswordReset(formData: FormData): Promise<void> {
  const userId = formData.get("user_id");
  if (typeof userId !== "string" || !userId) {
    throw new Error("user_id is required");
  }

  const supabase = await createClient();
  const gate = await requirePlatformAccount(supabase);
  if (!gate.ok) {
    throw new Error(gate.error);
  }

  const admin = createAdminClient();

  // Look up the email under the service-role client so we can pass
  // it to generateLink. Belt-and-suspenders: re-verify the row
  // exists rather than trusting the form-supplied id.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) {
    throw new Error(profileError.message);
  }
  if (!profile) {
    throw new Error("User not found");
  }
  if (!profile.email) {
    throw new Error("User has no email on file; cannot generate reset link");
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
    });
  if (linkError) {
    throw new Error(linkError.message);
  }

  const actionLink = linkData?.properties?.action_link ?? null;
  if (!actionLink) {
    throw new Error("Supabase did not return an action link");
  }

  await logSupportAction(supabase, {
    actorId: gate.userId,
    action: "user.reset_password",
    targetOrgId: null,
    targetTable: "profiles",
    targetRowId: userId,
    reason: null,
    before: null,
    // The link itself isn't logged; we only record the email it was
    // generated for. Anyone with the link can reset the user's
    // password, so it stays out of the durable audit table.
    after: { email: profile.email },
  });

  // Stash the link in an HttpOnly cookie scoped to this user's detail
  // path. The detail page reads it on the next render and clears it.
  // 60s is long enough to survive the redirect + first paint but
  // short enough that a forgotten browser session doesn't keep the
  // link recoverable.
  const cookieStore = await cookies();
  cookieStore.set({
    name: `${RESET_LINK_COOKIE_PREFIX}${userId}`,
    value: actionLink,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/admin/super/users/${userId}`,
    maxAge: RESET_LINK_TTL_SECONDS,
  });

  revalidatePath(`/admin/super/users/${userId}`);
  redirect(`/admin/super/users/${userId}`);
}
