/**
 * One-off helper to top up the platform's Stripe sandbox available
 * balance for testing.
 *
 * Usage:
 *   npx tsx scripts/topup-stripe-balance.ts [amountDkk]
 *
 * Defaults to 2000 DKK if no amount is given. Auto-loads
 * STRIPE_SECRET_KEY from .env.local — no need to export anything.
 * Safe to run repeatedly. Test-mode only.
 *
 * ⚠️ KNOWN LIMITATION: Stripe rejects Topups for DK + DKK accounts
 *    ("Top-up creation is not supported for country DK and currency
 *    DKK"). This script is kept for non-DK sandboxes where Topups
 *    work. For DK, the only paths to fund the platform balance are:
 *      1. Wait for Incoming charges to settle to Available (Stripe
 *         test mode usually clears within an hour or so).
 *      2. Use the dashboard "Add funds" wire-transfer flow.
 *      3. Stub the transfer in pay-action.ts during local QA.
 */
import Stripe from "stripe";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      // Strip surrounding quotes if present.
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) {
        process.env[k] = v;
      }
    }
  } catch {
    // .env.local missing is fine — caller may have exported the var
    // some other way.
  }
}

async function main() {
  loadEnvLocal();

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set in .env.local or env");
  }
  if (!key.startsWith("sk_test_")) {
    throw new Error("Refusing to run against a live key — test mode only");
  }

  const amountDkk = Number(process.argv[2] ?? 2000);
  if (!Number.isFinite(amountDkk) || amountDkk <= 0) {
    throw new Error(`Invalid amount: ${process.argv[2]}`);
  }

  const stripe = new Stripe(key);
  const topup = await stripe.topups.create({
    amount: amountDkk * 100, // DKK → øre
    currency: "dkk",
    description: `Test top-up for escrow flow QA (${amountDkk} DKK)`,
    source: "btok_bypassPending" as never, // test bank-token that bypasses settlement delay
    statement_descriptor: "Test topup",
  });

  console.log(`Topup created: ${topup.id}`);
  console.log(`  amount:  ${(topup.amount / 100).toFixed(2)} ${topup.currency.toUpperCase()}`);
  console.log(`  status:  ${topup.status}`);
  console.log(
    `  expected_availability_date: ${
      topup.expected_availability_date
        ? new Date(topup.expected_availability_date * 1000).toISOString()
        : "n/a"
    }`
  );
}

main().catch((err) => {
  console.error("Topup failed:", err.message ?? err);
  process.exitCode = 1;
});
