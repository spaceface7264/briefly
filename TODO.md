# TODO

Operational and pre-launch tasks that live outside the codebase. Items are
tracked by feature area, not by branch — each section has its own
preconditions. Work top to bottom within a section.

**Status legend** (audit pass 2026-04-29):
- ✅ DONE — verified complete in code / repo
- 🟡 LIKELY DONE — dependent features ship in code, presumed applied; worth a manual confirm
- ❌ TODO — not started
- ➕ NEW — added in this audit (was missing from the original list)

---
 
## 1. Apply database migrations

Apply any unapplied migration in `supabase/migrations/` via the Supabase
Dashboard → SQL Editor (copy/paste each file, run in numerical order).
Order matters — later migrations reference structures created by earlier
ones.

All migrations 0022–0034 have been confirmed applied to the live
Briefly project (verified 2026-04-29 by signature-object check against
`information_schema` + `pg_catalog` + `pg_enum` + `storage.buckets`).
The list is preserved as a record of what each migration delivers —
useful when re-running on a fresh project (use `combined_fresh_install.sql`
for that) or onboarding a new dev environment.

- ✅ `0022_creator_discovery.sql` — adds `organizations.discoverable`,
  the `org_applications` table + RLS, and the `approve_application` RPC
- ✅ `0023_no_default_org_on_signup.sql` — replaces `handle_new_user()`
  so new auth users no longer auto-join the default org. Users now join
  via invite code (`use_invite_code` from 0020) or approved discovery
  application (`approve_application` from 0022)
- ✅ `0024_application_notifications.sql` — extends the
  `notification_event_type` enum (`application_received`,
  `application_approved`, `application_rejected`), adds
  `profiles.notify_applications` (default TRUE), and installs an
  AFTER INSERT/UPDATE trigger on `org_applications` that fans out via
  `notify_admins` and `create_notification_for_user`
- ✅ `0025_remove_legacy_default_org.sql` — drops the legacy
  `00000000-…-0001` "Briefly" org seeded in 0015 and everything still
  attached to it (briefs, claims, payments, invite_codes,
  notifications, notification_outbox, invoice_counters; clears
  profiles.active_org_id; cascades memberships and org_applications).
  Confirmed safe by the project owner — the data was test data, no
  real customer rows are attached.
- ✅ `0026_pricing_phase1.sql` — Phase 1 of platform monetisation.
  Adds the `pricing_plans` catalogue (seeded with Free + Pro at 5%
  take rate), `profiles.is_platform_admin` (the gate for Phase 2/3
  super-admin surfaces), an `is_platform_admin()` SQL helper, and
  three frozen-at-payout columns on `payments`
  (`gross_dkk`, `platform_fee_bp`, `platform_fee_dkk`). Backfills
  historical payments with `gross_dkk = COALESCE(subtotal_dkk,
  amount_dkk)` and `platform_fee_dkk = 0` so existing invoices keep
  rendering identically. Pro plan pricing is seeded at 0 DKK — set
  the actual numbers via `UPDATE pricing_plans SET monthly_price_dkk
  = …, annual_price_dkk = … WHERE slug = 'pro'` before charging
  anyone.

  After applying, grant yourself platform admin via
  `UPDATE profiles SET is_platform_admin = TRUE WHERE email = '…'`.
- ✅ `0027_pricing_overrides.sql` — Phase 2 of monetisation. Adds
  `pricing_overrides` (per-org or per-user fee/plan/feature/limit
  adjustments) and `pricing_audit_log` (append-only record of every
  grant and revoke). RLS gates both to platform admins. The resolver
  in `src/lib/pricing.ts` consults overrides on every pricing
  decision; nothing else should read these tables directly. The
  `/admin/super` surface (visible only to platform admins) lists
  every org with its effective pricing and lets you grant overrides
  with a required reason — see `docs/monetisation.md` for the full
  flow.
- ✅ `0028_org_subscriptions.sql` — Phase 3 of monetisation. Adds
  `org_subscriptions`, the live link to a Stripe Billing
  subscription. Auto-creates a Free row for every existing and new
  org (trigger `create_default_subscription` fires on insert). The
  resolver now reads this table before falling through to Free, so
  an org with `status IN ('trialing','active','past_due')` reads as
  their actual plan automatically.

  Operational follow-up after applying:
  1. Create Stripe Products + Prices for the Pro plan in the Stripe
     Dashboard. One Product, two Prices (monthly + annual).
  2. `UPDATE pricing_plans SET monthly_price_dkk = …,
     annual_price_dkk = …, stripe_monthly_price_id = 'price_…',
     stripe_annual_price_id = 'price_…' WHERE slug = 'pro';`
  3. Configure the Stripe webhook endpoint at
     `https://<your-domain>/api/stripe/webhook` to deliver these
     events: `customer.subscription.created`,
     `customer.subscription.updated`,
     `customer.subscription.deleted`,
     `customer.subscription.trial_will_end`,
     `customer.subscription.paused`,
     `customer.subscription.resumed`,
     `invoice.paid`, `invoice.payment_failed`. (The existing
     `account.updated` and `transfer.reversed` events stay enabled
     for the Stripe Connect side.)
  4. Open the Stripe Customer Portal configuration once and enable
     the features you want creators to self-serve (cancel, change
     plan, update payment method, view invoices).

  *(SQL migration ✅ confirmed applied. The four operational follow-ups
  above are external-system work — confirm individually:)*
  - ❓ Stripe Pro Product + monthly/annual Prices created
  - ❓ `pricing_plans` row updated with `monthly_price_dkk`,
    `annual_price_dkk`, and the two `stripe_*_price_id` values
  - ❓ Stripe webhook endpoint registered with all 8 subscription/
    invoice events plus the existing Connect events
  - ❓ Stripe Customer Portal features enabled
- ✅ `0029_pricing_limits.sql` — Phase 3b. Enforces `max_active_briefs`
  and `max_creators` at the database level via two BEFORE INSERT/
  UPDATE triggers. The triggers raise `PLAN_LIMIT_EXCEEDED:` errors
  with human-readable messages; UI handlers (brief form, brief
  reopen, application approve, invite redemption) detect the prefix
  and surface an upgrade prompt linking to `/admin/billing`. Includes
  the `effective_org_limit()` SQL function that mirrors the resolver
  precedence (overrides → subscription plan → Free) so trigger checks
  always see the same limits the TS resolver returns.

The following migrations were missing from this list — added in the
2026-04-29 audit and confirmed applied in the same pass.

- ➕ ✅ `0030_fix_recursive_membership_policies.sql` — fixes infinite-
  recursion in memberships/organizations RLS that blew up the moment
  the first real membership row landed. Bug fix; no schema change.
- ➕ ✅ `0031_org_logos_bucket.sql` — creates the public `org-logos`
  Storage bucket (2 MB cap), writes go through the
  service-role-backed `uploadOrgLogo` server action.
- ➕ ✅ `0032_add_member_role.sql` — `ALTER TYPE user_role ADD VALUE
  'member'`. Lives alone because Postgres can't reference a newly-
  added enum value in the same transaction. 0033 is the first
  consumer.
- ➕ ✅ `0033_account_types.sql` — the dual-account-type fork. Adds
  `profiles.account_type` (`creator` | `org`), a memberships trigger
  enforcing creator users only hold creator memberships and org users
  hold one admin/member membership in exactly one org, plus
  `invite_codes` columns to carry three intents (creator-roster,
  org-admin, org-member) on one table.
- ➕ ✅ `0034_member_writes.sql` — broadens write policies on briefs +
  claims + read on profiles/org_applications from `is_org_admin()` to
  `is_org_member()` so members can do day-to-day brief/claim work
  (admins keep team/billing/discoverability gating).

After applying, sanity-check:

```sql
-- discoverable column exists, defaults false
SELECT column_default FROM information_schema.columns
WHERE table_name = 'organizations' AND column_name = 'discoverable';

-- handle_new_user trigger no longer references the default org id
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

The `expire-stale-claims` cron job (added in `0010`) should already be
registered. If you're unsure:

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'expire-stale-claims';
```

---

## 2. Regenerate database types

`src/types/database.ts` is auto-generated. Re-run when the schema
changes:

```bash
npx supabase gen types typescript --linked > /tmp/database.fresh.ts
# diff against current and merge the helper alias block manually
```

- ✅ Types in sync with live schema (verified 2026-04-29 by diffing
  fresh generator output against `src/types/database.ts` — the only
  diff is an additive `graphql_public` schema block plus the
  hand-maintained helper aliases at the bottom of the current file)
- ✅ `npm run build` clean (verified 2026-04-29 — TypeScript pass in
  4.7s, all 38 routes generated, only warning is the Next 15
  `middleware → proxy` filename deprecation noted in §7 Backlog)

⚠️ **Regen gotcha**: the bottom of `database.ts` carries a
hand-maintained helper-alias block (clearly marked with
`// ============================================================` /
`// Hand-maintained helper aliases.`). It exports
`Profile`, `Brief`, `Claim`, `Notification`, `NotificationOutbox`,
`Payment`, `Pricing*Row`, `OrgSubscriptionRow`, the `*Status` /
`*Category` / `*DurationClass` / `UserRole` / `VatScheme` /
`NotificationEventType` enum aliases, the literal `ClaimStatus` union,
and `BriefWithClaims`. These are imported across the codebase from
`"@/types/database"`. The generator strips them on every regen —
re-append them after every `gen types` invocation, or write a small
post-process script if it becomes annoying.

The original 2026-04-26 hand-patches (`org_applications` table,
`discoverable` column, `notify_applications` column, `application_*`
enum values) are no longer needed — they ship in the canonical
generator output now.

---

## 3. Redeploy edge functions

**State:** infrastructure deployed and idle. **Blocked on §8 (domain).**
No emails go out today, but no work is wasted — when the domain lands,
the only remaining steps are the 5 in the checklist below.

### What's already done (2026-04-29 audit pass)

- ✅ All 3 functions deployed and ACTIVE on the Briefly project:
  `notify-submission`, `notify-new-brief`,
  `process-notification-outbox` (all v2, deployed 2026-04-30 ~09:10 UTC)
- ✅ `PLATFORM_SENDER_NAME=Briefly` secret set
- ✅ `PLATFORM_SENDER_EMAIL` secret set *(placeholder value
  `notifications@example.com` — needs replacing once domain lands)*
- ✅ README project-ref bug fixed (was pointing at the old
  `hfepjqlbwcwhppbxxpkr` "boulders creators" project)

### What you need to do to finalize §3

Do these **in order** after §8 (domain) is done. Each step is
copy-pasteable.

- [ ] **1. Set the real sender email** (Supabase secret + `.env.local`):
  ```bash
  npx supabase secrets set --project-ref bncuqifjcsrjkohxkwez \
    PLATFORM_SENDER_EMAIL=notifications@<your-domain>
  ```
  Also update `PLATFORM_SENDER_EMAIL` in `.env.local` (Section 4) and
  in your production deploy target's env vars to the same value.

- [ ] **2. Set the Resend API key** (Supabase secret only — not needed
  in `.env.local`, the Next side doesn't send mail directly):
  ```bash
  npx supabase secrets set --project-ref bncuqifjcsrjkohxkwez \
    RESEND_API_KEY=re_xxxxx
  ```
  Get the key at https://resend.com/api-keys.

- [ ] **3. Create database webhook for submissions.** Dashboard →
  Database → Webhooks → Create new:
  - **Name**: `notify-submission`
  - **Table**: `claims`
  - **Events**: `UPDATE`
  - **Method**: `POST`
  - **URL**: `https://bncuqifjcsrjkohxkwez.supabase.co/functions/v1/notify-submission`
  - **Header**: `Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>`

- [ ] **4. Create database webhook for new briefs.** Same Dashboard
  surface:
  - **Name**: `notify-new-brief`
  - **Table**: `briefs`
  - **Events**: `INSERT`
  - **Method**: `POST`
  - **URL**: `https://bncuqifjcsrjkohxkwez.supabase.co/functions/v1/notify-new-brief`
  - **Header**: `Authorization: Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY>`

- [ ] **5. Schedule the outbox processor (every minute).** Dashboard →
  Integrations → Cron (the easy path):
  - **Schedule**: `* * * * *` (every minute)
  - **Method**: `POST`
  - **URL**: `https://bncuqifjcsrjkohxkwez.supabase.co/functions/v1/process-notification-outbox`
  - **Header**: `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`
  *(Alternative: extend the existing `pg_cron` setup that runs
  `expire-stale-claims` — would need `pg_net.http_post`, see Supabase
  docs.)*

### Sanity check after finishing

After step 5, send a test from the Resend dashboard, then trigger a
real flow (publish a brief, submit a claim) and confirm:
- The two database webhooks show successful `2xx` responses in
  Dashboard → Database → Webhooks → (each) → Logs
- `notification_outbox` rows are created and then deleted within ~1
  minute (the worker drains them)
- The recipient email inbox actually receives the messages

### Why this is blocked on §8 today

Resend can only send via its test sender (`onboarding@resend.dev`)
to the email address that owns your Resend account. So without a
verified domain, no real user gets mail — even with everything wired
up. The deployed functions sit idle, costing nothing.

---

## 4. Configure environment variables

Two surfaces share most variable names, set independently:
- **`.env.local`** — local dev (Next + server actions reading them on
  your machine)
- **Production deploy target** (Cloudflare Workers / Vercel / etc) —
  the running app. **I cannot verify these from the repo** — you have
  to look in the host's dashboard.

`/admin/settings` shows a yellow "Default" badge next to any platform
variable that is unset in the running environment, so you can spot
gaps live.

### Local `.env.local` audit (2026-04-29)

Branding (public — exposed to the browser):

- ✅ `NEXT_PUBLIC_PLATFORM_NAME=Briefly` — real value
- ❌ `NEXT_PUBLIC_LOGO_URL` — **not set**. Falls back to whatever
  `<PlatformLogo>` defaults to. Set when logo asset is hosted.
- ⚠️ `NEXT_PUBLIC_CONTACT_EMAIL=hello@example.com` — placeholder
  default (footer + legal pages will display this address). **Blocked
  on §8** — wait for real domain.

Legal entity (server-only — used on self-billed invoices and
`/admin/settings`):

- ❌ `PLATFORM_ADDRESS` — set but empty
- ❌ `PLATFORM_CVR` — set but empty (Danish business registration
  number — required for self-billing invoices)
- ❌ `PLATFORM_VAT_NUMBER` — set but empty (platform VAT number —
  required for OSS reporting and reverse-charge invoice text)

⚠️ With these three empty, the self-billing invoice template will
render with blank legal-entity fields. Functional but not legally
valid for actual EU invoicing. **Real blocker if you start charging.**
Order of operations: register a CVR → get a VAT number → fill these
in.

Email sender (also Supabase secrets — see §3):

- ✅ `PLATFORM_SENDER_NAME=Briefly`
- ⚠️ `PLATFORM_SENDER_EMAIL=notifications@example.com` — placeholder,
  blocked on §8

App URL:

- ✅ `NEXT_PUBLIC_APP_URL=http://localhost:3001` — correct for local
  dev (note: port 3001, not the Next default 3000). Production needs
  the real domain — blocked on §8.

### Production deploy target — UNAUDITED

I have no visibility into what's set in your Cloudflare/Vercel/etc
environment. Verify each variable is also set there with the
production-appropriate value:

- [ ] `NEXT_PUBLIC_PLATFORM_NAME` — fine to mirror local (`Briefly`)
- [ ] `NEXT_PUBLIC_LOGO_URL` — needs hosted logo URL
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` — needs real address (blocked on §8)
- [ ] `NEXT_PUBLIC_APP_URL` — your production domain (blocked on §8)
- [ ] `PLATFORM_ADDRESS` — needs real legal-entity address
- [ ] `PLATFORM_CVR` — needs real CVR
- [ ] `PLATFORM_VAT_NUMBER` — needs real VAT number
- [ ] `PLATFORM_SENDER_NAME`
- [ ] `PLATFORM_SENDER_EMAIL` — needs real address (blocked on §8)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` +
  `SUPABASE_SERVICE_ROLE_KEY` — Supabase project credentials
- [ ] `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` — Stripe creds
  (the live ones, not test keys)

Quickest way to verify the running app: load `/admin/settings` in
production once it's deployed and look for yellow "Default" badges.

---

## 5. Legal content review

State verified 2026-04-29 — matches the original TODO description.

Code state:

- ✅ `/legal/self-billing` — `draft={false}`, banner hidden, content
  is the canonical `selfBillingAgreementText()` creators accept
- ❌ `/legal/terms` — relies on `LegalPage` default `draft={true}`,
  banner showing, top-of-file `// NOTE:` lists clauses to verify
- ❌ `/legal/privacy` — same state, top-of-file `// NOTE:` lists items
  to verify
- ❌ `/legal/cookies` — same state, top-of-file `// NOTE:` lists
  Supabase + Stripe cookie names to confirm

Steps to finalize:

- [ ] Have a lawyer review `/legal/terms` (clauses flagged in
  `src/app/legal/terms/page.tsx` top comment)
- [ ] Have a lawyer review `/legal/privacy` (same pattern)
- [ ] Have a lawyer review `/legal/cookies` (confirm exact Supabase
  and Stripe cookie names listed)
- [ ] After each review, pass `draft={false}` to the `<LegalPage>`
  call in that page

⚠️ **Cross-dependency on §4 and §8**: legal pages render platform
name and contact email from env vars
(`NEXT_PUBLIC_PLATFORM_NAME`, `NEXT_PUBLIC_CONTACT_EMAIL`). Today
the contact email is the placeholder `hello@example.com`. Don't flip
`draft={false}` until those env vars carry real production values —
otherwise the published terms will reference a placeholder address.

---

## 6. Manual browser testing

Automated checks (`npm run build`, ESLint) cover compile-time issues but
don't exercise the UI. Click through these flows on a staging or
production-mirror environment before the next launch:

- [ ] **Creator (invite path)**: land → sign up with invite code → log
  in → browse briefs → filter → claim → submit → release
- [ ] **Creator (discovery path)**: sign up *without* an invite code →
  confirm middleware lands you on `/discover` after login → apply to a
  discoverable org → confirm pending state → admin approves → confirm
  membership and `active_org_id` are now set
- [ ] **Admin**: dashboard → applications inbox (approve and reject one
  each) → claims → submission modal → approve → pay → invoice download
- [ ] **Admin settings**: toggle org discoverability and confirm the org
  appears/disappears on `/discover`. Promote and demote an admin and
  confirm the self-demote and last-admin guards. Toggle each
  notification type and verify the right DB column flips.
- [ ] **Email**: in a staging Resend project, trigger a submission,
  publish a brief, and (eventually — see §7) submit a discovery
  application. Verify recipients match `notify_*` preferences.
- [ ] **Modals**: open the invite generator, submission review, claim
  approve/reject, and payout confirm modals. Verify Esc closes them,
  backdrop click closes them, focus returns to the trigger, and Tab
  stays trapped. The native `<dialog>`-based modals use `showModal()`
  which is well-supported but worth confirming on Safari/Firefox/Chrome.
- [ ] **Footer**: renders on every route (landing, login, admin, legal)
  and the platform name/contact email reflect the env vars from §4.

---

## 7. Known gaps (future work, not blockers)

All items captured here while reviewing the multi-tenancy + discovery
work have been resolved or decided. Future items go below this line.

**Audit pass 2026-04-29**: every Backlog item below was re-checked
against current code. None have been resolved since being logged —
all still apply. Status markers added (`❌` = still pending; `➕` =
newly added in this audit; `🟡` = partial progress noted).

### Decided

- **Default notification opt-in stays `TRUE`** (resolved 2026-04-26).
  Every `notify_*` column except `notify_new_briefs` covers
  transactional email — actions the user took or things needing their
  attention. Defaulting those off would suppress legitimate platform
  engagement and make creators wonder why they aren't being told their
  work was approved. No code change. If a GDPR-style consent concern
  surfaces later, the right answer is a "you'll get email about your
  activity" line on the signup form, not flipping defaults.

- **`/admin/settings` split into Personal vs Org IA** (resolved
  2026-04-29). Originally logged as a Backlog item proposing tabs at
  `/admin/settings` (General + Team) plus pulling personal to a new
  `/admin/account`. Final landing went the other way: `/admin/settings`
  is now the personal-scoped surface (tabs: `Personal` / `Team` /
  `Notifications`, search-param state `?tab=…`), and a new
  `/admin/organization` route holds org identity, branding
  (`logo_url`, `accent_color`, `industry`), legal entity
  (`address`, `cvr`, `vat_number`), and the discoverability toggle.
  Members get a read-only `OrgDetailsView` on `/admin/organization`;
  admins get the editable `OrgDetailsForm`. Same separation as the
  original plan, opposite naming convention.

- **`/login` stays a single page** (resolved 2026-04-29). After the
  PR-C2 signup fork, the question came up whether to split `/login`
  into `/login/creator` and `/login/org`. We decided against it:
  sign-in is functionally identical for both audiences (same Supabase
  call), splitting the URL doubles the maintenance surface, and a
  shared `/login` removes the wrong-funnel risk of misshared links.
  The shells (`/briefs` + `/discover` vs `/admin/*`) carry the
  account-type identity post-login, which is where it belongs. See
  the Backlog entry below for the visual polish that came out of the
  same discussion.

### Backlog

- ✅ **Split `/admin/settings` into Personal vs Org IA** — moved to
  Decided above 2026-04-29 (shipped with opposite naming convention
  from the original plan: `/admin/settings` became personal,
  `/admin/organization` became org). After PR-C1 + PR-C2 the page mixes individual-scope
  concerns (your name, your password, your email notifications) with
  org-scope concerns (org name, branding, legal entity, team, invites,
  discoverability). Every comparable B2B SaaS — Slack, Linear, Notion,
  Figma, Stripe, GitHub, Canva — separates these into two surfaces:
  personal is reached via the avatar dropdown, org admin is reached
  via a workspace/settings nav item. Within the org surface they all
  further split with tabs (`General · Team · Billing · …`); the team
  tab is always its own thing.

  Plan for PR-D1 (~½ day):
  1. Tabs at `/admin/settings`: default `General`, second `Team`.
     One URL, search-param state (`?tab=team`) so links survive.
     - **General** keeps `OrgDetailsForm` + `DiscoverabilityToggle`.
     - **Team** holds `AdminTeam` + `TeamInvites`.
     - **Billing** stays at `/admin/billing` for now (or absorb later).
  2. Pull `PersonalAccountForm` + `NotificationsPanel` (audience=org)
     out of `/admin/settings` into a new `/admin/account` route.
     Notifications belong with personal — they're per-user prefs even
     though the audience is org-side.
  3. Restore an avatar dropdown for org users in the header (PR-B
     stripped this for cleanliness — bring back a minimal version
     with just `Personal account` + `Sign out`, no creator-flavoured
     links).
  4. Grep for `/admin/settings` links in the codebase and update any
     that point to sections now living elsewhere.

  What we're explicitly NOT doing: splitting org admin into two
  top-level routes (`/admin/org-settings` vs `/admin/team`). The
  unified one-URL-with-tabs pattern is what the comparables converge
  on; splitting routes adds nav noise without clarity gain.

- ❌ **Middleware leaves stale Supabase cookies un-scrubbed on public
  pages** (logged 2026-04-29; audit confirms `protectedPaths` array
  + short-circuit still in `src/lib/supabase/middleware.ts:5`). `src/lib/supabase/middleware.ts`
  short-circuits on any path that isn't in `protectedPaths` or
  `/login`, so it never calls `supabase.auth.getUser()` on `/`,
  `/discover`, `/how-it-works`, `/legal/*`, `/guide`. The `@supabase/ssr`
  client deletes invalid refresh tokens via its cookie writer — but
  only if `auth.getUser()` actually runs. When a user has a stale
  refresh token (DB reset, server-side sign-out, token rotation) and
  lands on a public page, `RootLayout` and the page itself both call
  `auth.getUser()` from inside server components, throwing
  `Invalid Refresh Token: Refresh Token Not Found`. Both call sites
  catch the error so the page still renders, but Next dev mode
  surfaces the throw in the console overlay and prod logs are noisy.

  Two clean fixes — pick one in a small PR:
  1. Always run `auth.getUser()` in middleware regardless of path.
     One extra auth roundtrip per anonymous page load; probably fine.
  2. Skip the middleware only when there's no `sb-*` cookie on the
     request. Best of both: free for true anonymous visitors,
     scrubs bad cookies for everyone else.

  Repro: clear the auth backend (or rotate tokens) without clearing
  the browser, navigate to `/`. The errors come from
  `src/app/layout.tsx` (`getActiveOrg → auth.getUser`) and
  `src/app/page.tsx` (`getAccountType → auth.getUser`), neither of
  which were touched by PR-A/B/C — this is pre-existing on `main`.
  Workaround for users today: visit `/login` (which is in the
  middleware allow-list and scrubs the cookie) or clear `sb-*`
  cookies manually.

- 🟡 **Audit remaining admin-only surfaces for member UI gating**
  (logged 2026-04-29; partial progress — `/admin/applications/page.tsx`
  now surfaces the copy `"Approval is admin only"`, but the underlying
  member-vs-admin RLS pass and the `/admin/creators` action gating
  haven't landed). The integration test pass on `cursor/pr-c-test-integration`
  caught a class of bugs where pages render full editable UI to org
  members, then fail server-side on submit. Fixed in this branch for
  `/admin/settings` (org details, admin team, discoverability,
  teammate invites) and locked the nav for `/admin/billing` and
  `/admin/invites`. Two surfaces deliberately left open for now:

  - `/admin/applications` — approving/rejecting creator applications
    is admin-only behavior. Likely needs the same treatment: lock from
    nav for members, server-redirect on direct URL, or render the inbox
    read-only for members. Confirm RLS gates the approve/reject RPC
    before deciding if read-only is acceptable.
  - `/admin/creators` — viewing the roster is fine for members; the
    promote/demote and "remove from org" actions inside are admin-only.
    Sub-action gating (hide buttons for members) is probably the right
    move rather than locking the whole page.

  When picking this up, also do the broader **RLS pass for member
  permissions** that's been deferred since PR-A: most write policies
  in `0017_org_scoped_rls.sql` and onward gate on `is_org_admin()`,
  meaning members can open admin pages but most mutations error out.
  The intended split (Admin = full; Member = day-to-day brief/claim
  ops, no team/billing/discoverability) needs RLS reflecting it.

- ➕ ❌ **Rename `src/middleware.ts` → `src/proxy.ts` for Next 15**
  (logged 2026-04-29 in this audit; `src/middleware.ts` still exists,
  no `src/proxy.ts`). The build emits
  `⚠ The "middleware" file convention is deprecated. Please use
  "proxy" instead.` Functionality is unchanged in Next 15 but the
  rename is required before whatever Next major drops the alias.
  Trivial PR — rename file, no API changes. Documented at
  https://nextjs.org/docs/messages/middleware-to-proxy.

- ❌ **Friendlier signup error for Supabase rate limits** (logged
  2026-04-29; audit confirms no error-mapping logic in
  `src/app/login/login-form.tsx`). The signup form surfaces raw Supabase strings like
  `email rate limit exceeded`. Map known error codes to human copy
  in `LoginForm` (e.g. *"Too many signup attempts. Try again in an
  hour."*). Easy ~10-min PR.

- ❌ **Show redeemed teammate invites in `/admin/settings`** (logged
  2026-04-29; audit confirms `.is("used_by", null)` filter still in
  `src/app/admin/settings/page.tsx:113` — redeemed invites still
  hidden). The active-invites table only renders rows where
  `used_by IS NULL`. Once redeemed, the row disappears entirely.
  That's intentional (active = actionable) but admins lose visibility
  into "who joined via which code". Add a collapsible "Redeemed"
  section underneath the active list, or push it into a small audit
  log surface. Quick win.

- 🟡 **Signup tile visual polish + deep-link entry** (logged
  2026-04-29; deep links *are* wired — `signup-creator` and
  `signup-invite` modes recognised in `LoginForm`. Visual polish and
  `?code=…` pre-fill still pending.) The `As a creator` / `With
  invite code` tiles in `LoginForm` are functional but visually thin. Worth doing as a small PR-D ticket:
  - Stronger tile treatment with a small illustration or icon per
    path, a one-line value prop, and a path-specific accent (creator
    = lime, invite = a cooler/org-flavoured tone).
  - Hero title + subtitle change to match the selected path
    ("Find paid briefs you love" vs "Join your team's workspace").
  - Marketing-friendly deep links: `/login?mode=signup-creator` and
    `/login?mode=signup-invite` already work via search params; make
    sure email templates and any future landing pages use them.
  - Auto-select the invite path and pre-fill the code field when the
    URL carries `?code=ABCD-EFGH` so an invite email is one click
    from a filled form.

  If a paid-org sales motion later wants its own landing page with
  trust signals and a "Book a demo" alt-CTA, that's a separate
  marketing surface (e.g. `/business`) that deep-links into
  `/login?mode=signup-invite` — not a forked auth page.

---

## 8. Acquire domain + Resend verification (blocker)

🚫 **Currently blocking §3 (email), the production deploy URL, and any
public-facing branding.** Logged in the 2026-04-29 audit when the
project owner confirmed no domain has been registered yet.

Without a domain:
- Resend can only send via `onboarding@resend.dev` to the Resend
  account owner's email — useless for real user notifications
- Production app lives at a default platform URL
  (`*.vercel.app` / `*.workers.dev`) which is fine for staging
  but not for trust signals, OG images, marketing
- Stripe receipts/emails reference whatever sender you've set —
  `notifications@example.com` is currently the placeholder
- Email links back to the app reference `NEXT_PUBLIC_APP_URL` —
  currently a default

Steps in order:

- [ ] **Pick + register domain.** Dual-purpose suggestion: short
  brand domain (e.g. `briefly.app`, `briefly.io`, `getbriefly.com`)
  works for both web + email. Cheap registrars: Namecheap, Porkbun,
  Cloudflare Registrar (sells at cost).
- [ ] **Add domain in Resend** at
  https://resend.com/domains. Resend prints the DNS records you
  need (SPF TXT, DKIM CNAMEs, optionally DMARC). Add them at the
  registrar; Resend verifies in minutes-to-hours.
- [ ] **Pick a sender address** on the verified domain
  (`notifications@`, `hello@`, `team@` — convention varies; pick
  one and stick with it).
- [ ] **Update `.env.local`** with the new
  `PLATFORM_SENDER_EMAIL` and `NEXT_PUBLIC_APP_URL`.
- [ ] **Update Supabase secrets** (see §3 commands above).
- [ ] **Update production env vars** in the deploy target
  (Cloudflare/Vercel) for the same two vars.
- [ ] **Point the domain at the deploy target.** Apex `A`/`AAAA` or
  `CNAME` per the host's docs. Cloudflare Workers and Vercel both
  give you a one-click custom-domain attach + auto-SSL.
- [ ] **Then unblock §3**: set `RESEND_API_KEY`, configure the two
  webhooks, schedule the outbox cron.
- [ ] **Update `/legal/*` pages** if the platform name or contact
  details change as part of this work (Section 5).

Optional but good-practice once domain lands:
- DMARC record (`_dmarc.<domain>`) starting at `p=none` for
  visibility, tightening to `p=quarantine` later
- BIMI record (logo in inbox) — needs a VMC, mostly nice-to-have

---

## 9. Roadmap

The post-genericization product expansion. Locked in 2026-04-29 — see
`memory/project_expansion_decisions.md` for the underlying decisions
on multi-org for creators, self-serve org signup, and the hybrid
roster + open-briefs marketplace model.

Phases are sequenced for dependency reasons (you can't open self-serve
signup before money mechanics are correct, can't add brand assets
without Storage, etc.). Items within a phase can be parallelised.

### Phase 0 — Close the loop & multi-org

Make today's flow actually work end-to-end. The data model supports
submission → approval → payment but there's no UI for any of those
steps; admins push state through SQL today. Multi-org goes here too
because it touches the same surfaces (claims pipeline, `/briefs`,
`/my-briefs`).

#### 0.1 Supabase Storage setup ✅

Shipped 2026-04-30 via migration
`0035_submissions_storage_bucket.sql`. Bucket for creator submissions.
Has to land first because 0.2 depends on it.

- ✅ Created `submissions` bucket (private — `public=false`)
- ✅ Access model: NO user-facing RLS policies on `storage.objects`
  for this bucket. Server actions (Phase 0.2) hold the service-role
  client and enforce permission before each read/write. Mirrors the
  org-logos pattern from migration 0031. Path convention enforced in
  the server action: `submissions/{user_id}/{claim_id}/{filename}`.
- ✅ File size cap: 250 MB
- ✅ Allowed MIME types: `video/mp4`, `video/quicktime`,
  `video/webm`, `image/png`, `image/jpeg`, `image/webp`,
  `image/heic`, `image/heif`, `application/pdf`
- ⏭️ Signed URLs for download (short TTL ~15 min) — wired in 0.2
  server action, not in this migration

Open question (still deferred): CDN/transcode layer (Mux, Cloudflare
Stream) for video previews vs. raw originals. Mux is the right answer
at scale; raw storage is fine to start. Decide before launch traffic.

#### 0.2 Submission UI

⚠️ **Discovered during implementation 2026-04-30**: a URL-only
submission flow already exists inline in
`src/app/briefs/[id]/brief-detail-client.tsx:381–439` — a client-side
direct Supabase write that updates `claims.status` to `submitted` with
`submission_url` + `submission_notes` + `submitted_at`. So this phase
is **augment, not build from scratch**: add file uploads, move the
write to a server action, surface the submitted assets back.

##### 0.2a — Schema + server actions ✅

Shipped 2026-04-30. **Architecture revised the same day** after
testing surfaced Next 15 / Cloudflare Workers body-size limits — the
original single `submitClaim` action that took files as FormData was
replaced with a two-step flow that uploads directly browser →
Storage. See "Why two steps" below.

- ✅ Migration `0036_claim_attachments.sql`: new `claim_attachments`
  table (`id`, `claim_id` FK CASCADE, `storage_path` UNIQUE,
  `filename`, `mime_type`, `file_size`, `created_at`). RLS allows
  SELECT for the claim's creator and any active org member of the
  claim's org. No INSERT/UPDATE/DELETE policies — those go through
  the server action with the service-role client, mirroring the
  org-logos pattern.
- ✅ Server actions at `src/app/briefs/[id]/actions.ts`:
  - `prepareSubmissionUploads(claimId, files[])` — validates
    ownership + active state + per-file MIME/size; returns one
    signed upload URL per file (Supabase
    `createSignedUploadUrl`). All paths namespaced
    `{user_id}/{claim_id}/…`.
  - `confirmSubmission(claimId, url, notes, attachments[])` — re-
    validates state + each attachment's path prefix, inserts
    attachment rows, flips claim to `submitted`. Existing Postgres
    trigger (migration 0018) fires `claim_submitted` notification
    automatically.
- ✅ Types regenerated, helper aliases re-appended, build clean
  (`ClaimAttachment` added to the helper-alias block).

**Why two steps:** the original single-action flow took files inside
FormData and uploaded them server-side. Hit the Next 15 default 1 MB
server-action body limit during testing. Bumping that limit doesn't
help in production because Cloudflare Workers (the deploy target,
via OpenNext) caps requests at 100 MB on Free / 500 MB on Paid. The
two-step flow streams bytes directly browser → Supabase Storage,
bypassing both layers entirely. Server actions only carry small
metadata payloads now.

**Tradeoff captured:** if the browser closes between
`prepareSubmissionUploads` and `confirmSubmission`, files are
orphaned in Storage. A future cleanup job should sweep
`storage.objects` under `submissions/` for paths whose claim_id has
no matching `claim_attachments` row, older than ~24 h. Logged as a
follow-up.

**Effective per-file cap is 50 MB** while on the Supabase Free
tier — the project-wide upload limit binds below the bucket's 250 MB
`file_size_limit`. When the project upgrades to Pro, change
`MAX_FILE_BYTES` in BOTH `src/app/briefs/[id]/actions.ts` and
`src/app/briefs/[id]/brief-detail-client.tsx` from `50 * 1024 * 1024`
to `250 * 1024 * 1024`, and update the form helper text + error
strings ("50 MB" → "250 MB"). Migration 0035 already targets
250 MB, so no SQL change is needed.

##### 0.2b — UI 🟡

Partial: form refactor + file upload landed 2026-04-30. The
post-submission "see what you sent" view is deferred to land alongside
the admin review UI in Phase 0.3 (both need the same signed-URL
infrastructure).

- ✅ Refactored `ClaimedState` in
  `src/app/briefs/[id]/brief-detail-client.tsx` — `handleSubmit` now
  runs the two-step flow:
  1. Calls `prepareSubmissionUploads()` with file metadata
  2. Uploads each file in parallel via
     `supabase.storage.uploadToSignedUrl()` directly from the browser
  3. Calls `confirmSubmission()` with the URL, notes, and attachment
     records to finalize
  Cancel flow untouched.
- ✅ Inline form now has a multi-file picker (drag-and-drop via
  `<input type="file" multiple>`, MIME-restricted via the same
  allowlist as the server action), client-side size + count
  validation for fast feedback, removable file chips with byte sizes.
  URL field is no longer `required` — `confirmSubmission` enforces
  "URL OR files".
- ⏭️ /my-briefs already routes claim cards to `/briefs/[id]` — no
  separate "Submit work" CTA needed. The brief detail page is the
  canonical surface.
- ⏭️ Showing submitted assets back to the creator → defers to **0.3**
  (the admin review surface needs the same
  `getClaimAttachmentSignedUrls` action, so we build it once and use
  it in both places).
- ⏭️ Per-file upload progress indicator → not implemented (the
  browser shows the request progress at the network layer; explicit
  in-UI progress bars per file would need wrapping
  `uploadToSignedUrl` with XHR. Defer until creators report bad
  feel on big uploads).
- ⏭️ Cleanup job for orphaned Storage objects (browser closed
  between prepare and confirm) — see 0.2a "Tradeoff captured."
  Defer.

#### 0.3 Review/approve UI

Admins need to see submissions and act on them.

- [ ] On `/admin/claims` row with status `submitted`: "Review" link →
  modal or detail page
- [ ] Surface: inline preview of attachments (video player, image
  thumbnails, PDF embed), notes, creator info, brief reference
- [ ] Three actions: **Approve** / **Request revision** / **Reject**
- [ ] Approve: `status=approved`, fire `claim_approved` notification
- [ ] Request revision: bounce to `active` with required feedback
  message stored on the claim (full revision history → 4.1)
- [ ] Reject: `status=cancelled` with required reason
- [ ] Same surface accessible from `/admin/briefs/[id]` Pending Review
  sidebar

#### 0.4 Pay action

Approval and payment are two data-model steps but should feel like one
in the UI.

- [ ] On approved claim row: "Pay" button (disabled if creator has no
  Stripe Connect account, with tooltip explaining)
- [ ] Confirm modal: amount, fee breakdown (placeholder until 1.2),
  creator's payout account, invoice number preview
- [ ] On confirm: server action creates `payments` row, calls Stripe
  transfer, generates invoice
- [ ] Existing webhook updates `payments.status` on transfer completion
- [ ] Bulk action: "Pay all approved" on the claims table

Open question: once escrow (1.1) lands, should approve + pay collapse
into one button for prefunded briefs? Yes — make approval the payment
trigger when funds are already held.

#### 0.5 Application decision UI ✅

Verified 2026-04-30 — already shipped. The TODO description above
was based on a stale audit snapshot.

- ✅ Approve / Reject buttons in
  `src/app/admin/applications/application-list.tsx` (`ApplicationRow`,
  lines 142–156)
- ✅ `reviewApplication(id, decision)` server action in
  `src/app/admin/applications/actions.ts`. Approve calls the
  `approve_application` RPC from migration 0022 (creates the
  membership + fires the notification via the 0024 trigger). Reject
  writes `status=rejected` + `reviewed_by` + `reviewed_at` (the
  trigger fires `application_rejected` automatically).
- ✅ Pending / Reviewed split (sections, not tabs — fine for the
  current volume).
- ✅ Empty state with a hint to enable org discoverability.
- ✅ Member-vs-admin gating: members see a "Pending review" badge
  instead of the action buttons. `requireOrgAdmin()` enforces it
  server-side too.
- ✅ Plan-limit errors surface with an upgrade prompt linking to
  `/admin/billing` (uses the `PLAN_LIMIT_EXCEEDED:` prefix from the
  triggers in migration 0029).

Optional follow-ups (not blockers):
- ⏭️ Required reason on rejection (would need a small reason modal —
  pair with the same on claim rejection in 0.3).
- ⏭️ Tabs at the top with counts (Pending | Approved | Rejected),
  matching the `/admin/claims` filter style.

#### 0.6 Multi-org creator UI ✅

Verified 2026-04-30 — most of this was already in place; only the
notification org context needed adding.

- ✅ Org switcher in creator nav: `<OrgSwitcher>` already renders for
  any non-org logged-in user (`src/components/nav.tsx:148`). The
  component itself hides when there's ≤1 active membership.
  `switchOrg` server action is generic and used for both audiences.
- ✅ `/briefs` and `/my-briefs` queries scoped by `active_org_id` via
  `requireActiveOrg(supabase)` — same mechanism the admin shell uses.
- ✅ `/profile/applications` is the canonical "manage my org
  relationships" surface (already multi-org aware).
- ✅ Sign-in redirect prefers last-active implicitly: `switchOrg`
  writes `profiles.active_org_id`, which is sticky across sessions.
  New creators with no `active_org_id` fall through to first
  membership — acceptable, rare edge case.
- ✅ Notification cards now show org name (added 2026-04-30): the
  notifications query in `nav.tsx` joins `organizations(name,
  logo_url)`, and the meta line in `NotificationCenter` renders the
  org name after the timestamp ("just now · Acme Corp"). Costs
  almost nothing visually for single-org creators / org admins;
  unblocks multi-org creators who'd otherwise see ambiguous
  notifications.

What we're explicitly NOT doing: separate inboxes per org. One
unified `/my-briefs`, filterable by org via the switcher. Fewer
surfaces.

Optional follow-ups (not blockers):
- ⏭️ Org logo in notification cards (data is fetched, just not
  rendered yet — small avatar would be nice once we settle on a UI
  for it).
- ⏭️ /my-briefs claim card org badge — only useful if we ever add an
  "all orgs" view to /my-briefs, which contradicts the switcher
  model. Defer indefinitely.

---

### Phase 1 — Money mechanics & compliance

Get this right before opening self-serve signup. The right time to
design escrow and VAT is *before* there are 1000 transactions to
migrate.

#### 1.1 Escrow & money flow

Defines the trust model. Decision needed and recommended:
**charge org on brief publish, hold funds, release on approval,
refund on cancel/expire/archive.**

- [ ] Stripe PaymentIntent on brief publish (amount =
  `price_dkk × claim_limit`, plus VAT if applicable)
- [ ] Schema: `briefs.funded_status` enum
  (`unfunded` | `funded` | `partially_released` | `released` |
  `refunded`), `briefs.stripe_payment_intent_id`
- [ ] Reserve / release accounting on the `claims` row (or a
  `claim_holds` table if it gets more complex than one slot per claim)
- [ ] On approval: `transfers.create` from platform balance →
  creator's connected account (refactor current direct-charge flow)
- [ ] On cancel/reject/expire: return slot's worth to org's available
  balance — usable on the next brief, no refund unless org explicitly
  withdraws
- [ ] Brief publish form shows total upfront cost prominently
- [ ] Admin sees "Funded ✓" badge on brief list and detail
- [ ] Settle-up flow on org account closure / brief archive

Open question: do we hold funds for unclaimed slots until the brief
deadline passes, or release them sooner if the org archives early?
Cleanest UX: release on archive OR deadline, whichever first.

What we're explicitly NOT doing: net-30 settlement period. Pay creator
on approval, immediate Stripe transfer.

#### 1.2 EU VAT & self-billing

Regulatory must-have for EU launch. The `/legal/self-billing` page
exists; the actual flow doesn't.

- [ ] Adopt **Stripe Tax** for VAT calculation rather than rolling our
  own (handles cross-border B2B reverse charge, OSS, country-specific
  rates; ~0.5% of transaction; integrates with existing Stripe stack)
- [ ] Creator profile fields: `vat_number` (optional),
  `business_status` (`sole_trader` | `company` | `private`), `country`
- [ ] Org profile: country (env vars cover platform's own VAT)
- [ ] Self-billing consent: creator ticks box on first payout setup
  authorising platform to issue invoices on their behalf; store
  `consented_at` + agreement version
- [ ] Invoice template: both parties' VAT numbers, reverse-charge note
  where applicable, sequential numbering (already exists via
  `invoice_counters`)
- [ ] Annual income summary (PDF) downloadable from `/profile/invoices`
  — required for tax filing in most EU countries (feeds 1.3)
- [ ] OSS reporting export: one CSV per quarter for platform's own
  filing

E-invoicing (mandatory in IT, PL, FR coming): defer until we have an
org in one of those countries. Add as a known-deferred item.

#### 1.3 Creator earnings dashboard

New surface at `/profile/earnings`. Reads existing `payments` and
`invoices`.

- [ ] Total earned: lifetime, this year, this month
- [ ] Breakdown by org
- [ ] Breakdown by month (chart)
- [ ] Pending earnings (approved but not yet paid)
- [ ] Annual summary download (PDF) — same artefact as 1.2's tax doc
- [ ] CSV export of all payments

---

### Phase 2 — Self-serve & open marketplace

Money mechanics are now correct. Open the doors.

#### 2.1 Self-serve org signup

Replace platform-admin-only `/admin/super/orgs/new`.

- [ ] On `/login?mode=signup`: third path "Create an organisation"
  alongside the two creator paths
- [ ] Org creation form: name, slug, country, contact email, business
  type
- [ ] Email verification before org row created (Supabase auth)
- [ ] On create: org row + membership(role=`admin`) for the user,
  default to lowest pricing plan (Free → `org_subscriptions` trigger
  from migration 0028 already handles)
- [ ] `discoverable=false` by default
- [ ] Onboarding wizard post-creation: brand basics (logo, colors),
  invite teammates, create first brief — skippable
- [ ] Empty state on `/admin` dashboard with onboarding checklist
- [ ] Cannot publish first paid brief until Stripe Billing setup
  complete (1.1 escrow needs it)
- [ ] Cannot toggle `discoverable=true` until ≥1 brief published
  (anti-spam)

Abuse mitigation: rate-limit org creation per email/IP. The
membership-wall (curated roster model) provides the deeper protection
— fake orgs can't farm creators because applications are gated.

#### 2.2 Brief visibility (open briefs)

Hybrid marketplace per `memory/project_expansion_decisions.md`.

- [ ] Schema: `briefs.visibility` enum (`roster` | `public`),
  default `roster`
- [ ] BriefForm: visibility selector with explanation copy
- [ ] RLS update: `briefs` SELECT policy allows `visibility='public'`
  to anyone (currently roster-scoped)
- [ ] RLS update: `claims` INSERT policy allows non-members to claim
  if brief is `public`
- [ ] On a creator's `/briefs`: union of (roster briefs from their
  orgs) + (public briefs from any org), with a clear "Public" badge
- [ ] On `/discover` org cards: split brief count into "Roster (X)"
  vs "Open (Y)" so creators see what they get now vs. if accepted
- [ ] Notification: `brief_published_public` event for some discovery
  surface — likely an opt-in email digest, not per-brief push
- [ ] Pricing implication: public briefs may carry higher platform fee
  (more discovery work) — wire into pricing resolver if so

What we're explicitly NOT doing: per-creator brief targeting (private
to one creator). That's "invite to brief" — defer indefinitely.

Open question: deferred. Should completing a public brief well
auto-suggest a roster invite to the org admin? Worth picking up after
2.2 is in production for a few weeks.

#### 2.3 Public SEO surfaces

Once public briefs and discoverable orgs exist, make them indexable.

- [ ] Public org pages at `/o/[slug]` — name, logo, description, list
  of public briefs, "Join roster" CTA
- [ ] Public brief pages at `/b/[id]` (or `/o/[slug]/briefs/[id]`) for
  `visibility='public'` only
- [ ] OG images auto-generated (Vercel OG / @vercel/og)
- [ ] Sitemap.xml including all discoverable orgs and public briefs
- [ ] Structured data: `JobPosting` schema fits brief shape closely
- [ ] Canonical URLs, robots.txt directives
- [ ] `/discover` itself indexable

Don't index: anything roster-scoped, individual creator profiles
(4.3 decides on those separately).

---

### Phase 3 — Org leverage

Make orgs more productive once they're on the platform.

#### 3.1 Brand asset library

Per-org space for logos, brand kit, style guide, references.
**Lives inside `/admin/organization`** (decided 2026-04-29 with the
Settings/Organization IA split — see §7 Decided). The org route
already holds `logo_url`, `accent_color`, `industry`, contact and
legal-entity fields; Brand Kit extends the same surface.

- [ ] On `/admin/organization`: convert to a tabbed layout
  (`Identity · Brand kit · Legal`), or stack Brand Kit as the next
  section below the existing form. Tabs scale better as the brand
  kit grows.
- [ ] **Brand kit sections**: logos (multiple, with usage notes —
  the existing `logo_url` is the primary; this adds variants like
  monochrome / stacked / favicon), full colour palette (multiple
  hex values, the existing `accent_color` becomes one entry), fonts
  (Google Fonts URL or uploaded file references), tone of voice
  (rich text), do's & don'ts (rich text), reference assets
  (file uploads to Storage).
- [ ] Default usage rights template — auto-populated on new briefs,
  editable per brief.
- [ ] Surface to creators: collapsible "Brand context" panel on every
  brief detail page for one of their roster orgs.
- [ ] Toggle per asset: include for public-brief claimants too?
- [ ] RLS / member gating: members can VIEW (mirror current
  `OrgDetailsView` pattern), admins can EDIT.

Schema additions:
- `org_brand_assets` table — polymorphic on `asset_type`
  (`logo` | `font` | `reference`), `org_id`, `storage_path` /
  `external_url`, `label`, `notes`, `usage_context`, `created_at`.
- `organizations.tone_of_voice` (text or jsonb), `organizations.dos_donts`
  (text or jsonb), `organizations.brand_colors` (jsonb array of hex
  strings — preserves order, room for `name`/`role` per colour).
- Reuse the existing `org-logos` Storage bucket (migration 0031) or
  create a sibling `org-brand-assets` bucket if file types diverge.

#### 3.2 Campaigns (brief grouping)

Multiple briefs as one logical unit.

- [ ] New `campaigns` table: `id`, `org_id`, `name`, `description`,
  `goal`, `start_date`, `end_date`, `status`
- [ ] `briefs.campaign_id` FK (nullable — most briefs stay standalone)
- [ ] `/admin/campaigns` list + `/admin/campaigns/[id]` detail with
  rolled-up stats (briefs, claims, total spent, completion rate)
- [ ] BriefForm: optional campaign selector when creating
- [ ] Filter `/admin/briefs` and `/admin/claims` by campaign

What we're explicitly NOT doing: enforced workflows ("brief 2 only
opens when brief 1 paid"). Just grouping for now.

#### 3.3 Org-side audit log

`/admin/super/audit` exists for platform admins; orgs need their own
slice.

- [ ] Reuse the audit log pattern (extend the existing table with
  `org_id` if it makes sense, or new `org_audit_log`)
- [ ] Log: brief published / archived / edited, claim approved /
  rejected / paid, member promoted / demoted, application approved /
  rejected, settings changes, brand asset changes
- [ ] Surface at `/admin/audit` (admin role only)
- [ ] Filter by actor, entity type, date range
- [ ] Export CSV

---

### Phase 4 — Quality of work

Make the work itself better. These are about the product feeling good.

#### 4.1 Revisions

`claims.status` currently goes active → submitted → approved /
cancelled. Add a real revision loop.

- [ ] Schema: `claim_revisions` table — one row per round (`version`,
  `submitted_at`, `feedback`, `reviewer_id`)
- [ ] Admin "Request revision": creates revision row with feedback,
  claim back to `active` (or new `revision_requested` enum value)
- [ ] Creator resubmit: new revision row, claim back to `submitted`
- [ ] UI: revision history thread on claim detail (creator + admin
  both see it)
- [ ] Decide: max revisions before claim auto-closes? Suggest a
  configurable cap per brief, default 3
- [ ] Pricing: revisions free by default; orgs can optionally cap
  rounds in the brief

#### 4.2 In-claim messaging

Not generic DMs — scoped to one claim.

- [ ] `claim_messages` table: `id`, `claim_id`, `author_id`, `body`,
  `created_at`, `read_at`
- [ ] Thread shown on creator's claim detail and admin's review modal
- [ ] Notification on new message (respect `notify_*` prefs)
- [ ] Plain text + auto-link URLs is enough — no markdown, no rich
  text
- [ ] No file uploads in messages — use the submission flow for that
- [ ] Soft anti-disintermediation: detect emails/phone numbers and
  warn (don't block — feels paranoid). Real enforcement is escrow +
  ratings.

#### 4.3 Creator profiles

Beyond name/email. Build the surface that makes creators visible to
orgs and to themselves.

- [ ] `/c/[handle]` semi-public creator page (private toggle)
- [ ] Fields: bio, portfolio links, IG/TikTok handles, skills/tags,
  languages, country, past-work showcase (curated from approved
  claims, with org permission)
- [ ] Editable at `/profile`
- [ ] Visible on `/discover` org pages when orgs browse their roster
- [ ] Searchable by tags / country / language (feeds 5.3)

Permission: past-work showcase needs the org to opt in per claim
("allow this creator to showcase this work in their portfolio").
Default-allow with explicit opt-out is probably right; revisit if
brands push back.

#### 4.4 Ratings

Mutual, simultaneous-release model.

- [ ] After payment: both parties get "rate this collaboration" prompt
- [ ] 1-5 stars + optional comment
- [ ] Released simultaneously when both have rated, OR after 14 days
  (whichever first), to prevent retaliation
- [ ] Visible: avg rating + count on org `/discover` pages and creator
  profile pages
- [ ] Schema: `ratings` table (`claim_id`, `rater_id`, `ratee_id`,
  `score`, `comment`, `released_at`)

What we're explicitly NOT doing: prominent written reviews. Comments
stored but only shown after light moderation. Stars do the heavy
lifting.

---

### Phase 5 — Scale polish

Stuff that hurts at volume but is fine while small.

#### 5.1 Mobile audit + PWA

Creators are phone-first. Verify and improve.

- [ ] QA pass: every creator surface on iPhone Safari and Android
  Chrome at 375px viewport
- [ ] Fix obvious breaks (modals, tables, claim flow)
- [ ] Web manifest, install prompt, basic service worker (offline
  shell + push notification capability)
- [ ] Push notifications for the actually-urgent events:
  `claim_approved`, `claim_paid`, `application_approved`

What we're explicitly NOT doing: native iOS/Android apps. Not until
volume justifies it.

#### 5.2 Notification granularity

Current `notify_*` booleans are too coarse once a creator is in 5
orgs.

- [ ] Per-org notification preferences (mute org X without muting all)
- [ ] Per-event-type within org
- [ ] Digest mode: daily or weekly summary instead of per-event push
- [ ] Settings surface at `/profile/notifications` — table view
  org × event type, toggle each cell

Schema: `user_notification_prefs` table (`user_id`, `org_id` nullable,
`event_type` nullable, `enabled`); null `org_id` + null `event_type`
acts as the global default.

#### 5.3 Search beyond filters

Once orgs have 100+ briefs or creators are in 10 orgs.

- [ ] Postgres full-text search on briefs (title, description,
  deliverable_specs)
- [ ] Faceted: category, duration_class, price range, deadline window,
  org
- [ ] Search bar on `/briefs` (creator) and `/admin/briefs` (admin)
- [ ] Saved searches?
- [ ] Eventually: pgvector for semantic search ("looking for cooking
  content creators") — defer until search-by-keyword feels insufficient
