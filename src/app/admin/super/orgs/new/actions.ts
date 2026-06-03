"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/pricing-server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CreateOrgInput {
  slug: string;
  name: string;
  currency: string;
  country: string;
  discoverable: boolean;
  adminEmail: string;
}

export type CreateOrgResult =
  | {
      ok: true;
      orgId: string;
      inviteCode: string;
      inviteUrl: string;
      emailSent: boolean;
    }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_DAYS = 14;

// Same alphabet/shape as the teammate-invite generator: no I, O, 0, 1 to
// avoid ambiguity when a human reads the code off an email.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateInviteCode(): string {
  let out = "";
  for (let g = 0; g < 2; g += 1) {
    if (g > 0) out += "-";
    for (let i = 0; i < 4; i += 1) {
      out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  }
  return out;
}

export async function createOrg(input: CreateOrgInput): Promise<CreateOrgResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();
  const currency = input.currency.trim().toUpperCase();
  const country = input.country.trim().toUpperCase();
  const adminEmail = input.adminEmail.trim().toLowerCase();

  if (!SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "Slug must be lowercase letters, digits, or hyphens (2–64 chars).",
    };
  }
  if (name.length < 2) {
    return { ok: false, error: "Name must be at least 2 characters." };
  }
  if (currency.length !== 3) {
    return { ok: false, error: "Currency must be a 3-letter ISO code (e.g. DKK)." };
  }
  if (country.length !== 2) {
    return { ok: false, error: "Country must be a 2-letter ISO code (e.g. DK)." };
  }
  if (!EMAIL_RE.test(adminEmail)) {
    return { ok: false, error: "Enter a valid org admin email." };
  }

  // Service-role client: bypass RLS for the bootstrap insert. The
  // platform-admin gate above is what authorises this.
  const db = createAdminClient();

  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Slug "${slug}" is already taken.` };
  }

  // Create the org with no owner yet. owner_id stays NULL ("pending
  // first admin") until the invited admin redeems the code below, at
  // which point use_invite_code() sets account_type='org', creates the
  // admin membership, and stamps owner_id.
  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ slug, name, currency, country, discoverable: input.discoverable })
    .select("id")
    .single();
  if (orgErr || !org) {
    return { ok: false, error: orgErr?.message ?? "Failed to create org." };
  }

  // Mint the first-admin invite (role=admin, intended_account_type=org).
  // Retry a few times on the (extremely unlikely) unique-code collision.
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  let code = generateInviteCode();
  let inviteOk = false;
  let lastInviteErr = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error: inviteErr } = await db.from("invite_codes").insert({
      code,
      org_id: org.id,
      role: "admin",
      intended_account_type: "org",
      created_by: gate.userId,
      expires_at: expiresAt,
    });
    if (!inviteErr) {
      inviteOk = true;
      break;
    }
    lastInviteErr = inviteErr.message;
    if (inviteErr.code === "23505") {
      code = generateInviteCode();
      continue;
    }
    break;
  }

  if (!inviteOk) {
    // Roll back the org so we never leave one without a way to claim it.
    const { error: rollbackErr } = await db
      .from("organizations")
      .delete()
      .eq("id", org.id);
    if (rollbackErr) {
      console.error(
        `[createOrg] Failed to roll back orphan org ${org.id} after invite insert failed: ${rollbackErr.message}`
      );
      return {
        ok: false,
        error: `Created org but failed to mint the admin invite: ${lastInviteErr}. Rollback also failed; contact support to clean up org ${org.id}.`,
      };
    }
    return {
      ok: false,
      error: `Failed to mint the admin invite: ${lastInviteErr}. Org rolled back.`,
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const inviteUrl = `${baseUrl}/login?mode=signup&code=${code}`;

  // Email the invite. A delivery failure is non-fatal: the org + code
  // already exist, so we surface emailSent=false and let the operator
  // copy the link manually instead of throwing away the org.
  //
  // Call the edge function directly with a dedicated FUNCTIONS_INVOKE_SECRET
  // bearer. We don't use functions.invoke() because it forces the Supabase
  // API key as the Authorization header, and this project's sb_secret_* key
  // isn't a JWT the function can validate.
  const fnBase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const fnSecret = process.env.FUNCTIONS_INVOKE_SECRET;
  let emailSent = false;
  if (fnBase && fnSecret) {
    try {
      const res = await fetch(`${fnBase}/functions/v1/notify-org-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${fnSecret}`,
        },
        body: JSON.stringify({
          to: adminEmail,
          orgName: name,
          role: "admin",
          inviteUrl,
          expiresAt,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        console.error(
          `[createOrg] notify-org-invite returned ${res.status} for org ${org.id}: ${await res.text()}`
        );
      }
    } catch (err) {
      console.error(`[createOrg] notify-org-invite threw for org ${org.id}:`, err);
    }
  } else {
    console.error(
      `[createOrg] NEXT_PUBLIC_SUPABASE_URL or WEBHOOK_AUTH_SECRET not set; skipping invite email for org ${org.id}`
    );
  }

  revalidatePath("/admin/super");
  revalidatePath("/admin/super/orgs");

  return { ok: true, orgId: org.id, inviteCode: code, inviteUrl, emailSent };
}
