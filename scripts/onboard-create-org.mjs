// Create the first organisation, attach the named user as admin, set
// their active_org_id, and verify the auto-Free-subscription trigger
// fired. Idempotent — safe to re-run.
//
// Usage: node scripts/onboard-create-org.mjs <email> <slug> <name> [currency] [country] [discoverable]

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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [, , email, slug, name, currency = "DKK", country = "DK", discoverableRaw = "true"] = process.argv;
const discoverable = discoverableRaw === "true";

if (!email || !slug || !name) {
  console.error("Usage: node scripts/onboard-create-org.mjs <email> <slug> <name> [currency] [country] [discoverable]");
  process.exit(1);
}

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m!\x1b[0m ${s}`;
const head = (s) => `\n\x1b[1m${s}\x1b[0m`;

async function main() {
  // 1. Resolve the user.
  console.log(head(`1. Resolving user ${email}`));
  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("id, email, name, active_org_id, is_platform_admin")
    .eq("email", email)
    .maybeSingle();
  if (profErr) {
    console.log(bad(`profiles fetch: ${profErr.message}`));
    process.exit(1);
  }
  if (!profile) {
    console.log(bad("No profiles row for that email. Sign up via the app first, then re-run."));
    process.exit(1);
  }
  console.log(ok(`profile.id = ${profile.id}`));

  // 2. Insert (or fetch) the organisation. Idempotent by slug.
  console.log(head(`2. Creating organisation ${slug}`));
  let { data: org, error: orgFetchErr } = await supabase
    .from("organizations")
    .select("id, slug, name, currency, country, discoverable")
    .eq("slug", slug)
    .maybeSingle();
  if (orgFetchErr) {
    console.log(bad(`org fetch: ${orgFetchErr.message}`));
    process.exit(1);
  }
  if (!org) {
    const { data: created, error: createErr } = await supabase
      .from("organizations")
      .insert({ slug, name, currency, country, discoverable })
      .select("id, slug, name, currency, country, discoverable")
      .single();
    if (createErr) {
      console.log(bad(`org insert: ${createErr.message}`));
      process.exit(1);
    }
    org = created;
    console.log(ok(`Created org id=${org.id}`));
  } else {
    console.log(warn(`Org with slug='${slug}' already exists (id=${org.id}). Reusing it.`));
  }

  // 3. Insert (or upgrade) membership as admin.
  console.log(head(`3. Membership: ${email} as admin of ${slug}`));
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id, role, status")
    .eq("user_id", profile.id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!existingMembership) {
    const { error: memErr } = await supabase
      .from("memberships")
      .insert({ user_id: profile.id, org_id: org.id, role: "admin", status: "active" });
    if (memErr) {
      console.log(bad(`membership insert: ${memErr.message}`));
      process.exit(1);
    }
    console.log(ok("Inserted admin membership"));
  } else if (existingMembership.role !== "admin" || existingMembership.status !== "active") {
    const { error: upErr } = await supabase
      .from("memberships")
      .update({ role: "admin", status: "active" })
      .eq("id", existingMembership.id);
    if (upErr) {
      console.log(bad(`membership update: ${upErr.message}`));
      process.exit(1);
    }
    console.log(ok("Upgraded existing membership to active admin"));
  } else {
    console.log(warn("Already an active admin in this org"));
  }

  // 4. Set active_org_id.
  console.log(head(`4. Setting active_org_id`));
  if (profile.active_org_id !== org.id) {
    const { error: actErr } = await supabase
      .from("profiles")
      .update({ active_org_id: org.id })
      .eq("id", profile.id);
    if (actErr) {
      console.log(bad(`active_org_id update: ${actErr.message}`));
      process.exit(1);
    }
    console.log(ok(`active_org_id = ${org.id}`));
  } else {
    console.log(warn("active_org_id already pointed at this org"));
  }

  // 5. Verify create_default_subscription trigger fired.
  console.log(head(`5. Verifying org_subscriptions trigger`));
  const { data: sub, error: subErr } = await supabase
    .from("org_subscriptions")
    .select("status, billing_interval, plan:pricing_plans(slug, name)")
    .eq("org_id", org.id)
    .maybeSingle();
  if (subErr) {
    console.log(bad(`org_subscriptions fetch: ${subErr.message}`));
  } else if (!sub) {
    console.log(warn("No org_subscriptions row for this org. Trigger may not be installed; falling back to manual insert."));
    const { data: freePlan } = await supabase
      .from("pricing_plans")
      .select("id")
      .eq("slug", "free")
      .single();
    if (freePlan) {
      const { error: insErr } = await supabase
        .from("org_subscriptions")
        .insert({ org_id: org.id, plan_id: freePlan.id, status: "free", billing_interval: "free" });
      if (insErr) {
        console.log(bad(`manual subscription insert: ${insErr.message}`));
      } else {
        console.log(ok("Manually inserted Free subscription"));
      }
    }
  } else {
    console.log(ok(`Subscription auto-created: plan=${sub.plan?.slug ?? "?"}, status=${sub.status}, interval=${sub.billing_interval}`));
  }

  // 6. Final state print.
  console.log(head("Final state"));
  const { data: finalProfile } = await supabase
    .from("profiles")
    .select("id, email, active_org_id, is_platform_admin")
    .eq("id", profile.id)
    .single();
  const { data: finalMemberships } = await supabase
    .from("memberships")
    .select("org_id, role, status, organizations(slug, name)")
    .eq("user_id", profile.id);
  console.log(`  active_org_id      = ${finalProfile.active_org_id}`);
  console.log(`  is_platform_admin  = ${finalProfile.is_platform_admin}`);
  for (const m of finalMemberships ?? []) {
    const tag = m.org_id === finalProfile.active_org_id ? " [ACTIVE]" : "";
    console.log(`  membership: ${m.role} (${m.status}) in ${m.organizations.slug}${tag}`);
  }
  console.log("\nDone. You should now see the Admin button in nav and have access to /admin and /admin/super.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
