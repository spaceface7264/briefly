// One-shot DB sanity check used during onboarding.
// Reads service-role key from .env.local, prints which migrations have
// been applied (by fingerprinting the schema) and the user/org graph.
//
// Usage: node scripts/db-sanity.mjs [email]
//   email — optional, defaults to argv[2] or env CHECK_EMAIL

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[m[1]] = value;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checkEmail = process.argv[2] ?? env.CHECK_EMAIL ?? null;

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m!\x1b[0m ${s}`;
const head = (s) => `\n\x1b[1m${s}\x1b[0m`;

// We don't have raw SQL access via supabase-js without an RPC, so we
// fingerprint each migration by SELECTing a known column/table that it
// added. If the SELECT errors with 42P01 (table missing) or 42703
// (column missing), the migration has not been applied.
async function fingerprint(name, query) {
  const { error } = await query();
  if (!error) return { name, applied: true };
  // PostgREST error codes are stringified; we look at message + code.
  const code = error.code;
  const msg = error.message ?? "";
  if (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    /does not exist/i.test(msg) ||
    /could not find the (table|column)/i.test(msg)
  ) {
    return { name, applied: false, reason: msg };
  }
  return { name, applied: false, reason: `unexpected: ${msg}` };
}

async function main() {
  console.log(head("Migration fingerprints"));

  const checks = [
    // Core schema (0001-0014). One probe per major feature.
    ["0001_init (profiles, briefs)", () =>
      supabase.from("profiles").select("id", { head: true, count: "exact" })],
    ["0006_payments", () =>
      supabase.from("payments").select("id", { head: true, count: "exact" })],
    ["0007_vat_invoicing (subtotal_dkk)", () =>
      supabase.from("payments").select("subtotal_dkk", { head: true, count: "exact" })],
    ["0012_notifications_system", () =>
      supabase.from("notifications").select("id", { head: true, count: "exact" })],
    ["0013_replace_format_with_duration_class", () =>
      supabase.from("briefs").select("duration_class", { head: true, count: "exact" })],
    ["0015_organizations", () =>
      supabase.from("organizations").select("id", { head: true, count: "exact" })],
    ["0015_memberships", () =>
      supabase.from("memberships").select("id", { head: true, count: "exact" })],
    ["0019_org_invoice_counters", () =>
      supabase.from("invoice_counters").select("org_id", { head: true, count: "exact" })],
    ["0022_creator_discovery (organizations.discoverable)", () =>
      supabase.from("organizations").select("discoverable", { head: true, count: "exact" })],
    ["0022_creator_discovery (org_applications)", () =>
      supabase.from("org_applications").select("id", { head: true, count: "exact" })],
    ["0024_application_notifications (notify_applications)", () =>
      supabase.from("profiles").select("notify_applications", { head: true, count: "exact" })],

    // Phase 1-3b (the new fee-system work)
    ["0026_pricing_phase1 (profiles.is_platform_admin)", () =>
      supabase.from("profiles").select("is_platform_admin", { head: true, count: "exact" })],
    ["0026_pricing_phase1 (pricing_plans)", () =>
      supabase.from("pricing_plans").select("slug", { head: true, count: "exact" })],
    ["0026_pricing_phase1 (payments.gross_dkk)", () =>
      supabase.from("payments").select("gross_dkk", { head: true, count: "exact" })],
    ["0027_pricing_overrides (pricing_overrides)", () =>
      supabase.from("pricing_overrides").select("id", { head: true, count: "exact" })],
    ["0027_pricing_overrides (pricing_audit_log)", () =>
      supabase.from("pricing_audit_log").select("id", { head: true, count: "exact" })],
    ["0028_org_subscriptions", () =>
      supabase.from("org_subscriptions").select("org_id", { head: true, count: "exact" })],
    ["0029_pricing_limits (pricing_plans.limits has rows)", () =>
      supabase.from("pricing_plans").select("limits", { head: true, count: "exact" })],
  ];

  const results = [];
  for (const [name, q] of checks) {
    const r = await fingerprint(name, q);
    results.push(r);
    console.log(r.applied ? ok(name) : bad(`${name} — ${r.reason ?? "missing"}`));
  }

  // Plan seed sanity
  console.log(head("Plan seeds"));
  {
    const { data, error } = await supabase
      .from("pricing_plans")
      .select("slug, name, default_fee_bp, monthly_price_dkk, annual_price_dkk, stripe_monthly_price_id, stripe_annual_price_id, visible, legacy");
    if (error) {
      console.log(bad(`pricing_plans: ${error.message}`));
    } else if (!data?.length) {
      console.log(warn("pricing_plans is empty — Phase 1 seeds did not insert"));
    } else {
      for (const p of data) {
        const fee = (p.default_fee_bp / 100).toFixed(2);
        const stripe = p.stripe_monthly_price_id || p.stripe_annual_price_id ? "stripe wired" : "no Stripe price IDs";
        console.log(`  ${p.slug.padEnd(8)} ${p.name.padEnd(8)} fee=${fee}% monthly=${p.monthly_price_dkk} annual=${p.annual_price_dkk}  (${stripe})${p.legacy ? " [LEGACY]" : ""}`);
      }
    }
  }

  // Org subscription auto-trigger sanity
  console.log(head("Subscriptions per org"));
  {
    const { count: orgCount } = await supabase.from("organizations").select("*", { count: "exact", head: true });
    const { count: subCount } = await supabase.from("org_subscriptions").select("*", { count: "exact", head: true }).then(
      (r) => r,
      (e) => ({ count: null, error: e })
    );
    console.log(`  organizations: ${orgCount ?? "?"} / org_subscriptions: ${subCount ?? "?"}`);
    if (orgCount != null && subCount != null && orgCount > subCount) {
      console.log(warn("Some orgs have no subscription row — the create_default_subscription trigger may have been added after they existed. Backfill needed."));
    }
  }

  // Specific user state
  if (checkEmail) {
    console.log(head(`User: ${checkEmail}`));
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, email, name, active_org_id, is_platform_admin, notify_applications")
      .eq("email", checkEmail)
      .maybeSingle();
    if (error) {
      console.log(bad(`profiles fetch: ${error.message}`));
    } else if (!profile) {
      console.log(bad("No profiles row for that email — auth user may exist but profile wasn't created"));
    } else {
      console.log(`  profile.id              = ${profile.id}`);
      console.log(`  profile.active_org_id   = ${profile.active_org_id ?? "(null)"}`);
      console.log(`  profile.is_platform_admin = ${profile.is_platform_admin}`);

      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id, role, status, organizations(name, slug, discoverable)")
        .eq("user_id", profile.id);
      if (!memberships?.length) {
        console.log(bad("No memberships — middleware will redirect this user to /discover"));
      } else {
        console.log(`  memberships:`);
        for (const m of memberships) {
          const org = m.organizations;
          const tag = m.org_id === profile.active_org_id ? " [ACTIVE]" : "";
          console.log(`    ${m.role.padEnd(8)} ${m.status.padEnd(8)} org=${org?.slug ?? m.org_id} (${org?.name ?? "?"})${tag}`);
        }
        const adminInActive = memberships.find(
          (m) => m.org_id === profile.active_org_id && m.role === "admin" && m.status === "active"
        );
        if (!adminInActive) {
          console.log(warn("No active 'admin' membership in active_org_id — the Admin button in nav will not show"));
        }
      }
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
