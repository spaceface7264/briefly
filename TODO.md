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

These were noted while updating this TODO — none block a launch but
each is worth scheduling:

- [ ] The default org row (`00000000-0000-0000-0000-000000000001`,
  seeded in `0015` with the name "Briefly") is still in the database
  and still referenced by the now-superseded `0021`. After `0023`
  applies, nothing new attaches to it. Audit what currently lives
  there before deciding keep/rename/remove:

  ```sql
  SELECT 'memberships' AS table, COUNT(*) FROM memberships WHERE org_id = '00000000-0000-0000-0000-000000000001'
  UNION ALL SELECT 'briefs',          COUNT(*) FROM briefs          WHERE org_id = '00000000-0000-0000-0000-000000000001'
  UNION ALL SELECT 'claims',          COUNT(*) FROM claims          WHERE org_id = '00000000-0000-0000-0000-000000000001'
  UNION ALL SELECT 'payments',        COUNT(*) FROM payments        WHERE org_id = '00000000-0000-0000-0000-000000000001'
  UNION ALL SELECT 'invite_codes',    COUNT(*) FROM invite_codes    WHERE org_id = '00000000-0000-0000-0000-000000000001'
  UNION ALL SELECT 'notifications',   COUNT(*) FROM notifications   WHERE org_id = '00000000-0000-0000-0000-000000000001'
  UNION ALL SELECT 'profiles_active', COUNT(*) FROM profiles        WHERE active_org_id = '00000000-0000-0000-0000-000000000001';
  ```

  Recommendation: if every count is zero (greenfield deploy), drop the
  row and the superseded `0021` migration file. If real data is
  attached (any pre-multi-tenancy production users / briefs / claims),
  keep the row but `UPDATE organizations SET name = 'Legacy data',
  discoverable = FALSE WHERE id = '00000000-…-0001'` so admins of
  newly-created orgs can't accidentally confuse it for theirs. Either
  way, retire `0021_default_org_on_signup.sql` from the migrations
  folder (or drop a `0025_remove_legacy_default_org.sql` that clearly
  supersedes it) so future readers don't think the auto-attach
  behaviour is still live.
- [ ] Decide whether to leave default notification opt-in at `true`
  (current) or flip to opt-in. The column default is set in `0009`;
  changing it post-launch requires a backfill.
