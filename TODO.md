# TODO

Operational and pre-launch tasks that live outside the codebase. Items are
tracked by feature area, not by branch — each section has its own
preconditions. Work top to bottom within a section.

---

## 1. Apply database migrations

Apply any unapplied migration in `supabase/migrations/` via the Supabase
Dashboard → SQL Editor (copy/paste each file, run in numerical order).
Order matters — later migrations reference structures created by earlier
ones.

The latest two were added with the multi-tenancy and creator discovery
work and may not be live yet:

- [ ] `0022_creator_discovery.sql` — adds `organizations.discoverable`,
  the `org_applications` table + RLS, and the `approve_application` RPC
- [ ] `0023_no_default_org_on_signup.sql` — replaces `handle_new_user()`
  so new auth users no longer auto-join the default org. Users now join
  via invite code (`use_invite_code` from 0020) or approved discovery
  application (`approve_application` from 0022)
- [ ] `0024_application_notifications.sql` — extends the
  `notification_event_type` enum (`application_received`,
  `application_approved`, `application_rejected`), adds
  `profiles.notify_applications` (default TRUE), and installs an
  AFTER INSERT/UPDATE trigger on `org_applications` that fans out via
  `notify_admins` and `create_notification_for_user`
- [ ] `0025_remove_legacy_default_org.sql` — drops the legacy
  `00000000-…-0001` "Briefly" org seeded in 0015 and everything still
  attached to it (briefs, claims, payments, invite_codes,
  notifications, notification_outbox, invoice_counters; clears
  profiles.active_org_id; cascades memberships and org_applications).
  Confirmed safe by the project owner — the data was test data, no
  real customer rows are attached.
- [ ] `0026_pricing_phase1.sql` — Phase 1 of platform monetisation.
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

`src/types/database.ts` is auto-generated. After applying migrations:

```bash
npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
```

- [ ] Regenerate types
- [ ] Re-run `npm run build` to confirm nothing drifted

The `org_applications` table, `discoverable` column, the new
`notify_applications` column, and the three `application_*` enum values
were hand-patched into `database.ts` so the build passes — the canonical
generator output may differ in ordering or formatting.

---

## 3. Redeploy edge functions

The Deno functions under `supabase/functions/` were updated when the
platform was genericized (sender name/email now env-driven, recipient
filters use the per-type notification columns). Redeploy if the
deployed copies pre-date that work.

- [ ] Redeploy `supabase/functions/notify-submission`
- [ ] Redeploy `supabase/functions/notify-new-brief`
- [ ] Redeploy `supabase/functions/process-notification-outbox` — required
  for the application-notification routing added in 0024 to take effect.
  Without the redeploy, `application_*` events still queue and create
  in-app rows but the worker won't recognise them, will fall through to
  `notify_claim_updates` for opt-out, and link to `/my-briefs` instead
  of `/admin/applications` or `/profile`

Setup, secrets, and webhook wiring are documented in
`supabase/functions/README.md`.

---

## 4. Configure environment variables

Set these in the production deploy target (Cloudflare Workers, Vercel,
or wherever Next runs). `/admin/settings` shows a yellow "Default" badge
next to any platform variable that is unset, so you can spot gaps in the
running app.

Branding (public — exposed to the browser):

- [ ] `NEXT_PUBLIC_PLATFORM_NAME` — appears in nav, footer, emails,
  invoices (defaults to "Briefly")
- [ ] `NEXT_PUBLIC_LOGO_URL` — used by `<PlatformLogo>` and emails
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` — shown in the footer and referenced
  from legal pages (defaults to `hello@example.com`)

Legal entity (server-only — used on self-billed invoices and the
settings page):

- [ ] `PLATFORM_ADDRESS` — multi-line, use `\n` for line breaks
- [ ] `PLATFORM_CVR` — Danish business registration number
- [ ] `PLATFORM_VAT_NUMBER` — platform VAT number

Email sender (Supabase secrets — used by edge functions, not Next):

- [ ] `PLATFORM_SENDER_NAME` — `From` display name on outgoing emails
- [ ] `PLATFORM_SENDER_EMAIL` — must be on a Resend-verified domain in
  production; `onboarding@resend.dev` is fine for testing
- [ ] `RESEND_API_KEY` — set via `npx supabase secrets set …`

---

## 5. Legal content review

Three of the four legal pages still default `draft={true}` (the
`<LegalPage>` prop defaults to true; only `self-billing` explicitly
passes `false`). The visible "Working draft" banner stays up until each
page sets `draft={false}` explicitly.

- [ ] Have a lawyer review `/legal/terms` — flagged clauses are noted in
  top-of-file `// NOTE:` comments
- [ ] Have a lawyer review `/legal/privacy` — same pattern
- [ ] Have a lawyer review `/legal/cookies` — confirm exact Supabase and
  Stripe cookie names listed
- [ ] After each review, add `draft={false}` to the `<LegalPage>` call
  to remove the banner

`/legal/self-billing` renders the canonical `selfBillingAgreementText()`
that creators accept on their profile, so it doesn't need separate
review unless that text changes.

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

### Decided

- **Default notification opt-in stays `TRUE`** (resolved 2026-04-26).
  Every `notify_*` column except `notify_new_briefs` covers
  transactional email — actions the user took or things needing their
  attention. Defaulting those off would suppress legitimate platform
  engagement and make creators wonder why they aren't being told their
  work was approved. No code change. If a GDPR-style consent concern
  surfaces later, the right answer is a "you'll get email about your
  activity" line on the signup form, not flipping defaults.
