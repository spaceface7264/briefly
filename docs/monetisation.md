# Monetisation

How the platform makes money, and how to operate the knobs that control
it. Read this once when you're onboarding to the pricing/billing code,
keep it open the first few times you grant an override or change a plan.

The system has three logical layers, each landing in its own phase:

| Phase | Lives at | What it does |
|---|---|---|
| 1 | migration `0026`, `src/lib/pricing.ts`, `pay-action.ts`, `pdf.ts` | A 5% take rate on every payout. Plans are seeded but only Free is consulted. |
| 2 | migration `0027`, additions to `src/lib/pricing.ts`, `/admin/super` | Per-org and per-creator overrides. Audit log of every grant. |
| 3 | (next) | Stripe Billing for Pro subscriptions. `org_subscriptions` table. Real plans selected per org. |

The piece that makes all three layers compose without rework is the
**pricing resolver**. Everything paid in the codebase — payouts,
feature gates, limit checks — calls `resolveOrgPricing` (or
`resolveUserPricing`) and reads the resolved shape. No code outside
`src/lib/pricing.ts` reads `pricing_plans` or `pricing_overrides`
directly. If you ever find yourself doing that elsewhere, stop and
ask why.

---

## Phase 1 — take rate (live)

### Schema

`pricing_plans` is the catalogue. Two rows seeded:

| slug | take rate | trial | limits | features |
|---|---|---|---|---|
| `free` | 5% (500 bp) | 0 days | 3 active briefs, 3 creators | none |
| `pro`  | 5% (500 bp) | 14 days | unlimited | analytics, custom branding, discovery boost |

`profiles.is_platform_admin` is a boolean — distinct from the per-org
`role = 'admin'`. Platform admins manage plans, grant overrides, view
revenue. There should typically be one or two of you.

`payments` gained three columns, all populated at payout time and
**frozen** thereafter:

| column | meaning |
|---|---|
| `gross_dkk` | what the brief was advertised at (the org's headline cost) |
| `platform_fee_bp` | the take rate that was active when this payout ran |
| `platform_fee_dkk` | the kr amount the platform retained |

Frozen-at-payout matters. If you raise the take rate from 5% to 7%
next year, last year's payments still show 500 bp / their original
fee on the invoice — they're not retroactively rewritten.

### How a payout works after the fee

1. `requireOrgAdmin()` lets the admin in.
2. `resolveOrgPricing(supabase, orgId)` returns `{ fee_bp, … }`.
3. `computeFee(grossDkk, fee_bp)` returns `{ feeDkk, netDkk }`.
   `feeDkk` is floored — rounding errors on small amounts go to the
   creator, never the platform.
4. VAT is calculated on `netDkk` (the creator's actual receipts).
5. Stripe transfer = `netDkk + vat`, in øre. The `feeDkk` stays on
   the platform's Stripe balance — nothing else needed.
6. The new payments columns are written. Invoice PDF picks them up
   on next render.

### Operating it

**Set Pro pricing before charging anyone:**

```sql
UPDATE pricing_plans
SET monthly_price_dkk = 49900, annual_price_dkk = 499000
WHERE slug = 'pro';
```

(The numbers are placeholders. Pick whatever you want. Stripe Billing
in Phase 3 will read these.)

**Grant yourself platform admin** (one-time, after applying `0026`):

```sql
UPDATE profiles SET is_platform_admin = TRUE
WHERE email = 'you@example.com';
```

**Change the platform-wide take rate:**

```sql
UPDATE pricing_plans SET default_fee_bp = 700 WHERE slug = 'free';
-- repeat for 'pro' if you want them aligned, or set independently
```

Existing payments are unaffected (frozen). New payouts use the new
rate from the moment the UPDATE commits.

**See effective fee on a payment row:**

```sql
SELECT
  invoice_number,
  gross_dkk,
  platform_fee_bp / 100.0 AS fee_pct,
  platform_fee_dkk,
  subtotal_dkk AS creator_net,
  total_dkk AS transfer_amount
FROM payments
WHERE id = '…';
```

`gross = subtotal + platform_fee` always. `total = subtotal + vat`.
The Stripe transfer is `total`.

### What's not yet wired

- Subscriptions (`org_subscriptions`) — every org reads as Free.
- Per-org / per-user overrides — coming in Phase 2.
- Usage gates against `limits` (max briefs, max creators) — Phase 3
  feature work, easy once subscriptions exist to read.

---

## Phase 2 — overrides + audit log (live)

This is the freedom layer. Anything the standard plan model can't
express becomes a row in `pricing_overrides` with a required reason,
visible in the audit log forever.

### Schema

`pricing_overrides`:

| column | meaning |
|---|---|
| `scope_org_id` XOR `scope_user_id` | exactly one is set — org-wide or user-specific |
| `kind` | one of `fee_bp`, `plan`, `feature_flag`, `limit`, `trial_extension` |
| `value jsonb` | shape depends on `kind`, see below |
| `reason` | free text, required, min 3 chars — never empty |
| `granted_by`, `granted_at` | audit |
| `expires_at` | NULL = forever; resolver treats expired as inactive |
| `active` | soft-delete flag — revoke without losing the row |

`pricing_audit_log` is append-only. Every grant and revoke writes a
row with `before` / `after` JSON and the actor. RLS lets only
platform admins read it.

### Override `value` shapes

| kind | example `value` | what it does |
|---|---|---|
| `fee_bp` | `{ "fee_bp": 0 }` | replace the resolved take rate |
| `plan` | `{ "plan_slug": "pro" }` | switch the org onto a specific plan |
| `feature_flag` | `{ "key": "analytics", "enabled": true }` | toggle one feature |
| `limit` | `{ "key": "max_active_briefs", "value": 10 }` (or `null` for unlimited) | override one resource cap |
| `trial_extension` | `{ "days": 30 }` | recorded; consumed by Phase 3 subscriptions |

### Precedence

`resolveOrgPricing(supabase, orgId)` and `resolveUserPricing(supabase,
userId, orgId)` consult overrides in this order, **lower numbers
override higher**:

1. **User-level override** (only via `resolveUserPricing`)
2. **Org-level override**
3. **Org's subscription plan** (Phase 3 — currently always falls
   through to Free)
4. **Free plan**
5. **Hardcoded `PLATFORM_DEFAULT_FEE_BP`**

`pay-action.ts` calls `resolveUserPricing(creatorId, orgId)` so per-
creator waivers automatically apply to that creator's payouts only.

### Operating it

The platform-admin surface lives at **`/admin/super`** — it's only
visible if your profile has `is_platform_admin = TRUE`. Three pages:

- `/admin/super` — overview: org count, active overrides, last-30d
  take-rate revenue, plan catalogue.
- `/admin/super/orgs` — list of every org with its effective fee
  rate, plan, and override count.
- `/admin/super/orgs/[id]` — detail view. Shows current pricing,
  active overrides (with one-click revoke), the grant form, and the
  org-scoped audit log.
- `/admin/super/audit` — full audit log across the platform.

### Common operations

**Waive an org's fee for the next 6 months** (e.g. for a partner):

In `/admin/super/orgs/<that org>` → Grant override:
- Kind: Fee rate (bp)
- Fee in basis points: `0`
- Expires: 6 months from now
- Reason: `Partner deal — Q2 2026 launch promotion`

The resolver picks it up immediately. After expiry it stops applying
without anyone touching anything, and the audit log keeps the
history.

**Comp a creator at 0% take rate forever** (e.g. internal staff):

Currently no per-user UI lives in `/admin/super` — Phase 2 ships the
resolver layer, so you can grant a user override directly via SQL:

```sql
INSERT INTO pricing_overrides
  (scope_user_id, kind, value, reason, granted_by, expires_at, active)
VALUES
  ('<user-id>', 'fee_bp', '{"fee_bp": 0}'::jsonb,
   'Internal staff account', '<your-user-id>', NULL, TRUE);

INSERT INTO pricing_audit_log
  (actor_id, action, scope_user_id, before, after, reason)
VALUES
  ('<your-user-id>', 'override.granted', '<user-id>',
   NULL, '{"kind":"fee_bp","value":{"fee_bp":0}}'::jsonb,
   'Internal staff account');
```

A user-level UI is on the Phase 4 polish list. Until then, the SQL
path works and the resolver respects the row.

**Switch one specific org onto Pro without billing them:**

Grant a `plan` override with `value = {"plan_slug": "pro"}` and the
reason. The resolver will read Pro's plan row for that org. Stripe
Billing (Phase 3) will know to skip charging because the source is
`org_override` rather than `subscription`.

**Toggle a single feature on for one org:**

Grant a `feature_flag` override, e.g. `{"key": "analytics", "enabled":
true}`. Useful for beta-testers on the Free plan.

### Reading the resolver output

`ResolvedPricing` exposes:

```ts
{
  plan: PricingPlan | null,
  fee_bp: number,           // effective rate after all overrides
  limits: PlanLimits,       // merged
  features: PlanFeatures,   // merged
  source: "free_default" | "subscription" | "org_override" | "user_override" | "platform_default",
  applied_overrides: AppliedOverride[],  // every override that contributed
}
```

`source` tells you *why* the fee is what it is. `applied_overrides`
lists the actual rows. If you ever need to debug "why is this org's
fee different from the platform default", inspect those two fields.

### Things to watch for

- **Override conflicts.** If two `fee_bp` overrides exist on the same
  scope, the resolver applies them in `granted_at` order — the
  most recent wins. Revoke the stale one rather than letting two
  pile up.
- **Plan overrides need a real plan row.** If the slug doesn't
  exist, the resolver falls through to the Free plan. The override
  shows in `applied_overrides` so you can spot it.
- **Audit log RLS.** Inserts require `is_platform_admin()` at
  `WITH CHECK` time. The server actions already run under your auth
  context so this just works — but if you ever try to write from a
  cron/webhook with the service role, prefer using a platform-admin
  user's session or skip RLS by using the service role key.

---

## Phase 3 — Stripe Billing for Pro subscriptions (live)

Org admins can now upgrade themselves to Pro from `/admin/billing`,
flowing through Stripe-hosted Checkout for the purchase and Stripe-
hosted Customer Portal for everything afterwards (cancel, switch
interval, update card, download invoices). The platform never sees
a credit card.

### Schema

`org_subscriptions` — one row per org, representing the live link
between an org and its Stripe subscription:

| field | meaning |
|---|---|
| `org_id` (unique) | one active subscription per org |
| `plan_id` | which `pricing_plans` row they're on |
| `status` | `free`, `trialing`, `active`, `past_due`, `canceled`, `paused`, `incomplete`, `incomplete_expired`, `unpaid` |
| `billing_interval` | `monthly`, `annual`, `free` |
| `stripe_customer_id`, `stripe_subscription_id` | Stripe-side handles |
| `current_period_start`, `current_period_end` | latest billing window |
| `trial_end` | when the free trial ends |
| `canceled_at`, `paused_until`, `cancel_at_period_end` | lifecycle flags |

A trigger (`create_default_subscription`) auto-inserts a Free row
when a new org is created. The resolver's "live subscription" branch
treats statuses `free`, `trialing`, `active`, `past_due` as the org's
real plan; anything else falls through to Free.

### Resolver precedence (final)

1. **User-level override** (only via `resolveUserPricing`)
2. **Org-level override** (`pricing_overrides.scope_org_id`)
3. **Live Stripe subscription** (`org_subscriptions`, status in
   `free`/`trialing`/`active`/`past_due`)
4. **Free plan** (catalogue fallback)
5. **Hardcoded `PLATFORM_DEFAULT_FEE_BP`** (only if seed missing)

### Stripe configuration (one-time, before charging)

1. **Create the Stripe Products and Prices** in the Stripe Dashboard.
   For Pro: one Product, two recurring Prices (monthly + annual,
   currency DKK). Copy the price IDs.
2. **Populate `pricing_plans`** with real DKK amounts and the price
   IDs:
   ```sql
   UPDATE pricing_plans
   SET monthly_price_dkk = 49900,
       annual_price_dkk = 499000,
       stripe_monthly_price_id = 'price_…',
       stripe_annual_price_id = 'price_…'
   WHERE slug = 'pro';
   ```
3. **Wire the webhook**. Add an endpoint in the Stripe Dashboard at
   `https://<your-domain>/api/stripe/webhook` and enable these
   events on top of the existing `account.updated` /
   `transfer.reversed`:
   * `customer.subscription.created`
   * `customer.subscription.updated`
   * `customer.subscription.deleted`
   * `customer.subscription.trial_will_end`
   * `customer.subscription.paused`
   * `customer.subscription.resumed`
   * `invoice.paid`
   * `invoice.payment_failed`
4. **Configure the Customer Portal** at Stripe Dashboard → Settings →
   Billing → Customer portal. Enable "Cancel subscription",
   "Update payment method", "View invoice history". Disable plan
   switching at the portal level if you want changes to go through
   your own UI; otherwise leave it on so customers can self-serve.

### How the upgrade flow works

1. Org admin opens `/admin/billing` and sees the plan catalogue.
2. They click "Pick monthly" or "Pick annual" on the Pro card.
3. `createCheckoutSession` server action runs, creates (or reuses)
   the org's Stripe Customer, and generates a Checkout Session with
   `subscription_data.metadata = { org_id, plan_slug,
   billing_interval }`. Redirects the browser to the Stripe-hosted
   page.
4. Customer pays. Stripe redirects back to
   `/admin/billing?checkout=success`.
5. Stripe fires `customer.subscription.created` (and other events)
   to the webhook. `syncSubscriptionFromStripe` reads the metadata,
   matches the plan slug, and updates the `org_subscriptions` row
   (status, period dates, plan_id).
6. Resolver immediately sees the new plan on the next page load.

### How cancel / change works

The "Manage in Stripe" button on `/admin/billing` calls
`createPortalSession`, which generates a Customer Portal link and
redirects. Everything done there fires webhook events that update
`org_subscriptions` automatically — your code doesn't have to handle
the UI of cancelling or swapping cards.

### What `pay-action.ts` changes

Nothing. It still calls `resolveUserPricing(creatorId, orgId)`,
which now reads the org's live plan from `org_subscriptions`. If the
org is on Pro at 5%, payouts use 5%. If a per-creator override
sets the rate to 0% for one specific creator, that creator's payouts
ignore the org's plan rate.

### Operating it

**Watch the live state of every subscription:**

`/admin/super/orgs` shows each org with its effective fee and the
resolver's `source` field. `subscription` means it's reading the
live `org_subscriptions` row. `org_override` means a platform-admin
override is masking it.

**Manually move an org between plans without billing:**

Grant a `plan` override (Phase 2 surface). The resolver picks the
overridden plan; the live subscription stays untouched. Useful for
comp accounts where Stripe shouldn't bill them at all.

**Refund a customer:**

In the Stripe Dashboard. The webhook handler doesn't need to know —
refunds are about money movement, not subscription state.

**Apply a coupon at checkout:**

Already supported. `createCheckoutSession` sets
`allow_promotion_codes: true`, so the Checkout page exposes a coupon
input. Stripe coupons configured in the Dashboard work out of the
box.

### Status semantics

| `status` | resolver reads as | what it means |
|---|---|---|
| `free` | Free plan | org is on the no-charge default |
| `trialing` | their plan | inside trial, no charge yet |
| `active` | their plan | normal paid state |
| `past_due` | their plan | last payment failed; Stripe is retrying |
| `unpaid` | Free | retry exhausted; access lost (Stripe-configurable) |
| `canceled` | Free | sub ended; row reset to free plan by webhook |
| `incomplete`, `incomplete_expired` | Free | initial payment never completed |
| `paused` | Free | future Phase-4 state for seasonal pause |

### Things to watch for

- **Empty Stripe price IDs.** The upgrade button shows a clear
  error and refuses to start checkout. Populate `stripe_*_price_id`
  before charging.
- **Webhook signature verification.** The handler returns 400 if the
  signature is missing or invalid. Make sure `STRIPE_WEBHOOK_SECRET`
  is set in production.
- **Idempotency.** `syncSubscriptionFromStripe` is safe to re-run on
  the same event — it uses Stripe's subscription object as the source
  of truth. If a webhook is delivered twice, the second invocation
  is a no-op write of the same data.
- **Trial end without payment.** Stripe handles this for you —
  `customer.subscription.deleted` fires, the webhook sets status
  back to `free` and reverts plan_id to Free.
- **Missing org_id metadata.** If a subscription somehow gets
  created without `org_id` in metadata (manual creation in Stripe
  Dashboard, etc.), the webhook logs an error and does nothing.
  Always create subscriptions through the Checkout flow this code
  builds.

---

(Phase 4 / future polish — usage limits, MRR dashboard, promo codes
UI, dunning emails — lands below as it ships.)
