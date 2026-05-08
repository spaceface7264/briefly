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
  setActiveOrg: boolean;
}

export type CreateOrgResult =
  | { ok: true; orgId: string }
  | { ok: false; error: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

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
  if (!adminEmail) {
    return { ok: false, error: "Initial admin email is required." };
  }

  // Service-role client: bypass RLS for the bootstrap insert. The
  // platform-admin gate above is what authorises this.
  const db = createAdminClient();

  const { data: adminProfile, error: profErr } = await db
    .from("profiles")
    .select("id, active_org_id, account_type")
    .eq("email", adminEmail)
    .maybeSingle();
  if (profErr) {
    return { ok: false, error: `Lookup failed: ${profErr.message}` };
  }
  if (!adminProfile) {
    return {
      ok: false,
      error: `No user with email ${adminEmail}. Have them sign up first, then re-run.`,
    };
  }

  // Migration 0033 enforces (account_type, role) at the trigger level:
  // a 'creator' profile can only hold creator memberships. The
  // standard signup flow lands every user as 'creator' by default, so
  // any user we want to bootstrap as an org admin needs to be flipped
  // to 'org' first.
  //
  // Safe to flip only when the user has no active memberships yet:
  // otherwise we'd silently strip them of creator-side access without
  // their consent, or the trigger's "org accounts can only belong to
  // one organization" rule would fight us. In those cases we surface
  // a clear error and let the platform admin pick an unaffiliated
  // user instead.
  let flippedAccountType = false;
  if (adminProfile.account_type !== "org") {
    const { count: existingMembershipCount, error: memCountErr } = await db
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("user_id", adminProfile.id)
      .eq("status", "active");
    if (memCountErr) {
      return {
        ok: false,
        error: `Failed to check existing memberships: ${memCountErr.message}`,
      };
    }
    if ((existingMembershipCount ?? 0) > 0) {
      return {
        ok: false,
        error: `${adminEmail} is currently a creator with active memberships. Either pick a fresh user, or have them leave their existing org(s) first.`,
      };
    }
    const { error: flipErr } = await db
      .from("profiles")
      .update({ account_type: "org" })
      .eq("id", adminProfile.id);
    if (flipErr) {
      return {
        ok: false,
        error: `Failed to convert ${adminEmail} to an org account: ${flipErr.message}`,
      };
    }
    flippedAccountType = true;
  }

  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: `Slug "${slug}" is already taken.` };
  }

  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ slug, name, currency, country, discoverable: input.discoverable })
    .select("id")
    .single();
  if (orgErr || !org) {
    return { ok: false, error: orgErr?.message ?? "Failed to create org." };
  }

  const { error: memErr } = await db
    .from("memberships")
    .insert({
      user_id: adminProfile.id,
      org_id: org.id,
      role: "admin",
      status: "active",
    });
  if (memErr) {
    // Roll back the org so we don't leave it without any admin. Log
    // loudly if the rollback itself fails so support can clean up the
    // orphan org; the caller still gets the original "failed to attach
    // admin" error.
    const { error: rollbackErr } = await db
      .from("organizations")
      .delete()
      .eq("id", org.id);
    if (rollbackErr) {
      console.error(
        `[createOrg] Failed to roll back orphan org ${org.id} after membership insert failed: ${rollbackErr.message}`
      );
      return {
        ok: false,
        error: `Created org but failed to attach admin: ${memErr.message}. Rollback also failed; contact platform support to clean up org ${org.id}.`,
      };
    }
    // If we flipped the user's account_type up top, restore it so the
    // user isn't left as an orphaned 'org' account with no membership.
    if (flippedAccountType) {
      const { error: revertErr } = await db
        .from("profiles")
        .update({ account_type: "creator" })
        .eq("id", adminProfile.id);
      if (revertErr) {
        console.error(
          `[createOrg] Failed to revert account_type for ${adminEmail} after rollback: ${revertErr.message}`
        );
      }
    }
    return {
      ok: false,
      error: `Created org but failed to attach admin: ${memErr.message}. Org rolled back.`,
    };
  }

  if (input.setActiveOrg && !adminProfile.active_org_id) {
    await db
      .from("profiles")
      .update({ active_org_id: org.id })
      .eq("id", adminProfile.id);
  }

  revalidatePath("/admin/super");
  revalidatePath("/admin/super/orgs");

  return { ok: true, orgId: org.id };
}
