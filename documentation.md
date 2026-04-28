# Documentation

Short operator guide. Deep dives live in `docs/monetisation.md` and `TODO.md`.

## Roles

| Concept | Where | Controls |
|---|---|---|
| Org admin | `memberships.role = 'admin'` for active org | `Admin` button, `/admin/*` |
| Platform admin | `profiles.is_platform_admin = TRUE` | `/admin/super` only |

Setting one does **not** grant the other.

## Onboarding a new platform owner

1. Sign up via the app (creates `profiles` row).
2. `UPDATE profiles SET is_platform_admin = TRUE WHERE email = '…';`
3. Run `node scripts/onboard-create-org.mjs <email> <slug> <name>` to create your first org and admin membership.

## /admin/super — pricing overrides

Override grants live at `/admin/super/orgs/[id]`. Every grant requires a reason and is logged forever in `pricing_audit_log`. All support an optional expiry (blank = forever).

### 1. Fee rate (bp)
Replace the org's take rate. `0` waives, `500` = 5%, max `10000` = 100%.

Use for: partner deals, promos, comps, premium customers paying a higher rate.

Doesn't change: plan, limits, features.

### 2. Switch plan
Forces the resolver onto a specific plan slug. Plan-derived everything (fee, limits, features, trial) flips with it. Live `org_subscriptions` row stays untouched — Stripe is not billed.

Use for: comp accounts on Pro, demo orgs, temporary plan promotions.

Watch: invalid slug silently falls through to Free; visible in `applied_overrides`.

### 3. Feature flag
Toggle one feature on/off. Wired keys: `analytics`, `custom_branding`, `discovery_boost`.

Use for: beta-testing one feature on a Free org, disabling for a problem customer, grandfathering early adopters.

Note: the flags exist; UI enforcement of most is Phase-4 polish.

### 4. Limit
Override one resource cap. Wired keys: `max_active_briefs`, `max_creators`. Blank = unlimited.

Use for: Free orgs needing temporary headroom, pilot customers growing rosters, hard caps on suspicious orgs.

Doesn't auto-archive: lowering a limit blocks new writes only. Existing rows over the cap stay.

### 5. Trial extension
Records `{"days": N}`. Phase 3 checkout reads it as `trial_period_days` when starting a Pro subscription.

Use for: honoring custom trial promises, extending an expired trial.

Niche — most cases the plan's default trial is enough.

### Operational patterns

- **Stack intentionally**: `plan=pro` AND `fee_bp=0` together = full Pro features with waived rate.
- **Always set expiry on one-off concessions** so silent perks don't pile up.
- **Revoke ≠ delete**: revoke flips `active=false` and writes an audit row; the override stays for forensic history.
- **Per-creator overrides have no UI**: insert via SQL with `scope_user_id` (template in `docs/monetisation.md` §Phase 2).
- **Debug "why this fee"**: read `resolver.source` and `resolver.applied_overrides` — those tell you exactly which row produced the rate.

## Sanity scripts

- `node scripts/db-sanity.mjs <email>` — fingerprint applied migrations, check user/org state.
- `node scripts/db-probe-rls.mjs <email>` — reproduce REST queries as that user, surface RLS errors.
- `node scripts/onboard-create-org.mjs <email> <slug> <name> [currency] [country] [discoverable]` — create org + admin membership + active_org_id, idempotent.

## Known gotcha

Migration `0015` shipped two recursive RLS policies on `memberships` and `organizations` that error with `42P17 infinite recursion in policy` once any membership row exists. Migration `0030_fix_recursive_membership_policies.sql` rewrites them in terms of `is_org_member()` / `is_org_admin()` SECURITY DEFINER helpers. Apply it before adding the first membership.
