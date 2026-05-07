// Create Stripe Products + monthly Prices for every pricing_plans row
// that has monthly_price_dkk > 0 and no stripe_monthly_price_id yet.
// Writes the resulting Stripe price IDs back to pricing_plans so the
// /admin/billing checkout flow can find them.
//
// Idempotent: re-runs are safe. Looks up existing products by
// metadata.plan_slug and existing prices by (product, currency=dkk,
// recurring.interval=month). If a price exists at the wrong amount it
// archives the old one and creates a fresh one so the row stays in
// sync with the DB.
//
// Usage:
//   node scripts/setup-stripe-products.mjs [--dry-run]
//
// Reads STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, and
// SUPABASE_SERVICE_ROLE_KEY from .env.local. Use the test key (sk_test_…)
// to populate the test-mode dashboard; swap to the live key when ready.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

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
const dryRun = process.argv.includes("--dry-run");

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  process.exit(1);
}
if (!env.STRIPE_SECRET_KEY) {
  console.error("STRIPE_SECRET_KEY missing in .env.local");
  process.exit(1);
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Node script. Default http client is fine here (no Workers runtime),
// so we don't need Stripe.createFetchHttpClient like server-side code.
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { typescript: false });

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m!\x1b[0m ${s}`;
const head = (s) => `\n\x1b[1m${s}\x1b[0m`;

const isTest = env.STRIPE_SECRET_KEY.startsWith("sk_test_");
const dashboardBase = isTest
  ? "https://dashboard.stripe.com/test"
  : "https://dashboard.stripe.com";

async function findProductBySlug(slug) {
  // products.search hits Stripe's search API. Filtering by metadata
  // is the cleanest way to keep this idempotent without polluting the
  // DB with a stripe_product_id column.
  const result = await stripe.products.search({
    query: `metadata['plan_slug']:'${slug}' AND active:'true'`,
    limit: 1,
  });
  return result.data[0] ?? null;
}

async function findMonthlyDkkPrice(productId) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    currency: "dkk",
    limit: 100,
  });
  return prices.data.find((p) => p.recurring?.interval === "month") ?? null;
}

async function syncPlan(plan) {
  console.log(head(`Plan: ${plan.slug} (${plan.monthly_price_dkk} DKK/mo)`));

  if (plan.stripe_monthly_price_id) {
    // Verify the cached id still resolves to a live, correctly-priced
    // Stripe price. If it does, skip; if not, fall through to recreate.
    try {
      const existing = await stripe.prices.retrieve(plan.stripe_monthly_price_id);
      const expectedØre = plan.monthly_price_dkk * 100;
      if (
        existing.active &&
        existing.currency === "dkk" &&
        existing.recurring?.interval === "month" &&
        existing.unit_amount === expectedØre
      ) {
        console.log(warn(`Already linked to ${existing.id}, no changes needed`));
        return;
      }
      console.log(warn(`Linked price ${existing.id} no longer matches plan; will recreate`));
    } catch (e) {
      console.log(warn(`Linked price ${plan.stripe_monthly_price_id} not retrievable (${e.message}); will recreate`));
    }
  }

  // 1. Product. Idempotent by metadata.plan_slug.
  let product = await findProductBySlug(plan.slug);
  if (product) {
    console.log(ok(`Product exists: ${product.id} (${product.name})`));
    // Keep name/description in sync with the DB so dashboard reads
    // match what's in pricing_plans.
    const expectedName = `Briefly ${plan.name}`;
    if (
      product.name !== expectedName ||
      (plan.description && product.description !== plan.description)
    ) {
      if (dryRun) {
        console.log(warn(`[dry-run] Would update product name/description`));
      } else {
        product = await stripe.products.update(product.id, {
          name: expectedName,
          description: plan.description ?? undefined,
        });
        console.log(ok(`Updated product name/description`));
      }
    }
  } else {
    if (dryRun) {
      console.log(warn(`[dry-run] Would create product for ${plan.slug}`));
      return;
    }
    product = await stripe.products.create({
      name: `Briefly ${plan.name}`,
      description: plan.description ?? undefined,
      metadata: { plan_slug: plan.slug },
    });
    console.log(ok(`Created product ${product.id}`));
  }

  // 2. Price. Idempotent on (product, dkk, monthly). Stripe prices
  //    are immutable, so a mismatched amount means archive + create.
  let price = await findMonthlyDkkPrice(product.id);
  const expectedØre = plan.monthly_price_dkk * 100;
  if (price && price.unit_amount !== expectedØre) {
    console.log(
      warn(
        `Existing price ${price.id} is ${(price.unit_amount ?? 0) / 100} DKK; plan expects ${plan.monthly_price_dkk}. Archiving and creating new.`
      )
    );
    if (!dryRun) {
      await stripe.prices.update(price.id, { active: false });
    }
    price = null;
  }

  if (!price) {
    if (dryRun) {
      console.log(warn(`[dry-run] Would create price ${plan.monthly_price_dkk} DKK/mo on ${product.id}`));
      return;
    }
    price = await stripe.prices.create({
      product: product.id,
      currency: "dkk",
      unit_amount: expectedØre,
      recurring: { interval: "month" },
      metadata: { plan_slug: plan.slug },
    });
    console.log(ok(`Created price ${price.id}`));
  } else {
    console.log(ok(`Price exists: ${price.id} (${plan.monthly_price_dkk} DKK/mo)`));
  }

  // 3. Write back to pricing_plans.
  if (plan.stripe_monthly_price_id === price.id) {
    console.log(ok(`pricing_plans.${plan.slug} already points at ${price.id}`));
    return;
  }
  if (dryRun) {
    console.log(warn(`[dry-run] Would set pricing_plans.${plan.slug}.stripe_monthly_price_id = ${price.id}`));
    return;
  }
  const { error: upErr } = await supabase
    .from("pricing_plans")
    .update({ stripe_monthly_price_id: price.id })
    .eq("id", plan.id);
  if (upErr) {
    console.log(bad(`pricing_plans update failed: ${upErr.message}`));
    process.exit(1);
  }
  console.log(ok(`Linked pricing_plans.${plan.slug} → ${price.id}`));
}

async function main() {
  console.log(head(`1. Stripe mode: ${isTest ? "TEST" : "LIVE"}${dryRun ? " (dry-run)" : ""}`));

  console.log(head("2. Reading pricing_plans"));
  const { data: plans, error } = await supabase
    .from("pricing_plans")
    .select("id, slug, name, description, monthly_price_dkk, stripe_monthly_price_id")
    .gt("monthly_price_dkk", 0)
    .order("monthly_price_dkk", { ascending: true });

  if (error) {
    console.log(bad(`pricing_plans fetch: ${error.message}`));
    process.exit(1);
  }
  if (!plans || plans.length === 0) {
    console.log(warn("No paid plans (monthly_price_dkk > 0) found."));
    console.log(warn("Run migration 0044 first to seed Studio and Pro, then re-run this script."));
    process.exit(0);
  }
  console.log(
    ok(
      `Found ${plans.length} paid plan(s): ${plans.map((p) => `${p.slug}@${p.monthly_price_dkk}`).join(", ")}`
    )
  );

  for (const plan of plans) {
    await syncPlan(plan);
  }

  console.log(head("Done"));
  console.log(`Inspect the results: ${dashboardBase}/products`);
  if (!isTest) {
    console.log(warn("You ran this against LIVE mode. Double-check the prices before you announce."));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
