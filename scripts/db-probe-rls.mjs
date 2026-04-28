// Reproduce the 500s the browser is seeing, with the actual error body
// PostgREST returns. We sign in as the named user (using their email +
// password if provided, else mint a session via service_role) and hit the
// same REST URLs the OrgSwitcher / Nav components fire.
//
// Usage:
//   node scripts/db-probe-rls.mjs <email>
//
// Reads SUPABASE_SERVICE_ROLE_KEY to mint a one-shot magic link / OTP
// or generate a sign-in link. Falls back to admin.generateLink for an
// access_token we can use as a Bearer JWT.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/db-probe-rls.mjs <email>");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Look up the user_id for the email.
const { data: profile } = await admin
  .from("profiles")
  .select("id")
  .eq("email", email)
  .single();
if (!profile) {
  console.error("No profile for that email");
  process.exit(1);
}
const userId = profile.id;

// Mint a JWT for that user via admin.generateLink (magic_link). This
// returns hashed_token + a URL containing access_token / refresh_token.
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (linkErr) {
  console.error("generateLink error:", linkErr);
  process.exit(1);
}

// Pull access_token out of the link's hash fragment if present;
// otherwise verify the token_hash directly to mint a session.
let accessToken = null;

const tokenHash = linkData?.properties?.hashed_token;
if (tokenHash) {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verify, error: vErr } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (vErr) {
    console.error("verifyOtp error:", vErr);
    process.exit(1);
  }
  accessToken = verify.session?.access_token;
}

if (!accessToken) {
  console.error("Could not mint access token");
  process.exit(1);
}

console.log(`Got access_token for user ${userId} (${email}). Probing the REST endpoints…\n`);

const probes = [
  {
    name: "GET profiles?select=active_org_id&id=eq.<me>",
    url: `${SUPABASE_URL}/rest/v1/profiles?select=active_org_id&id=eq.${userId}`,
  },
  {
    name: "GET memberships?select=…&user_id=eq.<me>&status=eq.active",
    url: `${SUPABASE_URL}/rest/v1/memberships?select=org_id,role,org:organizations(id,name)&user_id=eq.${userId}&status=eq.active`,
  },
  {
    name: "GET memberships?select=role&user_id=eq.<me>&org_id=eq.<active>",
    // Use the service role to discover active_org_id ourselves
    url: null,
  },
];

// Resolve active_org_id via service role for the third probe.
const { data: prof2 } = await admin
  .from("profiles")
  .select("active_org_id")
  .eq("id", userId)
  .single();
if (prof2?.active_org_id) {
  probes[2].url = `${SUPABASE_URL}/rest/v1/memberships?select=role&user_id=eq.${userId}&org_id=eq.${prof2.active_org_id}&status=eq.active`;
}

for (const p of probes) {
  if (!p.url) continue;
  const res = await fetch(p.url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const body = await res.text();
  console.log(`\n→ ${p.name}`);
  console.log(`  ${res.status} ${res.statusText}`);
  console.log(`  ${body.slice(0, 600)}`);
}
