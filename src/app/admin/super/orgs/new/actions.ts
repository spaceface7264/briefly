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
    .select("id, active_org_id")
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
    // Roll back the org so we don't leave it without any admin.
    await db.from("organizations").delete().eq("id", org.id);
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
