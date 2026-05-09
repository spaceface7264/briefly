"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/org";

type ActionErr = { ok: false; error: string };
type ActionOk = { ok: true };

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1
const CODE_GROUP_SIZE = 4;
const CODE_GROUPS = 2;

function generateInviteCode(): string {
  let out = "";
  for (let g = 0; g < CODE_GROUPS; g += 1) {
    if (g > 0) out += "-";
    for (let i = 0; i < CODE_GROUP_SIZE; i += 1) {
      out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  }
  return out;
}

export async function createTeammateInvite(input: {
  role: "admin" | "member";
  expiresInDays: number | null;
}): Promise<({ ok: true; code: string }) | ActionErr> {
  if (input.role !== "admin" && input.role !== "member") {
    return { ok: false, error: "Invalid role" };
  }
  if (
    input.expiresInDays !== null &&
    (!Number.isInteger(input.expiresInDays) ||
      input.expiresInDays < 1 ||
      input.expiresInDays > 365)
  ) {
    return { ok: false, error: "Expiry must be 1–365 days, or never" };
  }

  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const expiresAt = input.expiresInDays
    ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Try a few codes in case of (extremely unlikely) collision on the
  // 10-char alphabet. After 5 retries we give up rather than spin.
  let code = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (gate.supabase.from("invite_codes") as any).insert({
      code,
      created_by: gate.userId,
      org_id: gate.orgId,
      role: input.role,
      intended_account_type: "org",
      expires_at: expiresAt,
    });

    if (!error) {
      revalidatePath("/admin/settings");
      return { ok: true, code };
    }

    if (error.code === "23505") {
      code = generateInviteCode();
      continue;
    }

    return { ok: false, error: `Failed to create invite: ${error.message}` };
  }

  return { ok: false, error: "Couldn't find a unique code, try again" };
}

export async function revokeTeammateInvite(
  inviteId: string
): Promise<ActionOk | ActionErr> {
  if (!inviteId) return { ok: false, error: "Missing invite id" };

  const gate = await requireOrgAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invite } = await (gate.supabase.from("invite_codes") as any)
    .select("id, org_id, used_by, intended_account_type")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) {
    return { ok: false, error: "Invite not found" };
  }
  if (invite.org_id !== gate.orgId) {
    return { ok: false, error: "Invite belongs to a different org" };
  }
  if (invite.used_by) {
    return { ok: false, error: "Invite has already been redeemed" };
  }
  if (invite.intended_account_type !== "org") {
    return {
      ok: false,
      error: "This invite is a creator invite. Manage it from /admin/invites.",
    };
  }

  // We expire the invite by setting expires_at to the past, rather
  // than deleting — keeps the audit trail of "this code was issued and
  // pulled back" without breaking the FK from anything that may
  // reference it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (gate.supabase.from("invite_codes") as any)
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", inviteId);

  if (error) {
    return { ok: false, error: `Failed to revoke: ${error.message}` };
  }

  revalidatePath("/admin/settings");
  return { ok: true };
}
