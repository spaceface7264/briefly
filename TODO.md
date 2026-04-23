# TODO

Operational tasks that need to happen outside of code changes to finish
what's been shipped on the `claude/creator-ui-improvements-hbymJ` branch.
Work top to bottom — each section has its own preconditions.

---

## 1. Apply database migrations

Run in order via the Supabase Dashboard → SQL Editor. Copy/paste each file's
contents into a new query and run it.

- [ ] `supabase/migrations/0008_notification_preferences.sql` — adds the
  initial `email_notifications_enabled` column on `profiles`
- [ ] `supabase/migrations/0009_notification_types.sql` — replaces the
  single column with per-type columns (`notify_submissions`,
  `notify_new_briefs`), copying any prior opt-outs into both
- [ ] `supabase/migrations/0010_claim_auto_expiry.sql` — enables pg_cron
  and schedules an hourly job that flips `active` claims past
  `expires_at` to `cancelled`, releasing the slot against `claim_limit`

**Order matters.** 0009 references the column added in 0008, so 0008 must
run first. If you skip 0008 and try 0009, it will fail on the `UPDATE …
SET … = email_notifications_enabled` line.

After `0010` applies, confirm the job is registered with:

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'expire-stale-claims';
```

Expect one row with schedule `0 * * * *`. pg_cron is pre-installed on
Supabase but not enabled by default — `CREATE EXTENSION IF NOT EXISTS
pg_cron` inside the migration handles that. If the extension fails to
create, enable it from Dashboard → Database → Extensions first.

---

## 2. Regenerate database types

`src/types/database.ts` is auto-generated. I hand-patched it so the new
columns compile, but the canonical generator output may differ in
ordering or formatting. After the migrations apply:

```bash
npx supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts
```

- [ ] Regenerate types
- [ ] Re-run `npm run build` to confirm nothing drifted

---

## 3. Redeploy edge functions

Both Deno functions under `supabase/functions/` had their recipient
filters updated to use the new per-type columns. They won't pick up the
change until redeployed.

- [ ] Redeploy `supabase/functions/notify-submission`
- [ ] Redeploy `supabase/functions/notify-new-brief`

Setup is documented in `supabase/functions/README.md`. If the database
webhooks that trigger these functions aren't configured yet, set them up
per the README's "Webhook setup" section.

---

## 4. Configure environment variables

These power the footer, invoice PDFs, and the admin settings page. Set
them in the deployment platform (Cloudflare Workers, Vercel, or wherever
Next runs in production).

- [ ] `PLATFORM_NAME` — company name on invoices and in the footer
  (defaults to "Boulders ApS" if unset)
- [ ] `PLATFORM_ADDRESS` — appears on invoices and in the footer (blank
  by default)
- [ ] `PLATFORM_CVR` — Danish business registration number
- [ ] `PLATFORM_VAT_NUMBER` — platform VAT number used on invoices
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` — shown in the footer and referenced
  from legal pages (defaults to `creators@boulders.dk`)

`/admin/settings` shows a yellow "Not set" / "Default" badge next to any
of these that haven't been configured, so you can spot gaps at a glance.

---

## 5. Legal content review

Three of the four legal pages ship with a visible "Working draft" banner.
The copy reflects the platform's real data flows (sub-processors,
retention, VAT context) but has **not** been reviewed by legal counsel.

- [ ] Have a lawyer review `/legal/terms` — specific clauses flagged in
  `src/app/legal/terms/page.tsx` top-of-file `// NOTE:` comment
- [ ] Have a lawyer review `/legal/privacy` — same pattern
- [ ] Have a lawyer review `/legal/cookies` — confirm the exact Supabase
  and Stripe cookie names listed
- [ ] After each review, flip `draft={false}` on the `<LegalPage>` call
  to remove the banner

`/legal/self-billing` already has `draft={false}` — it renders the
canonical `SELF_BILLING_AGREEMENT_TEXT` creators accept on their profile,
so it doesn't need legal review unless the text itself changes.

---

## 6. Manual browser testing

Everything on the branch passes `npm run build` and ESLint, but the
automated checks don't cover real UI behaviour. Before merging:

- [ ] Click through the creator journey end-to-end: land → redeem invite
  → log in → browse briefs → apply filters → claim → submit → release
- [ ] Click through the admin journey: dashboard → claims → view
  submission modal → approve → pay → check invoice download
- [ ] On `/admin/settings`, promote and demote an admin. Confirm the
  self-demote and last-admin guards block the button (tooltips explain
  why) and that the server action rejects the call if someone bypasses
  the UI
- [ ] Toggle each notification type on both `/admin/settings` and
  `/profile`. Confirm the right DB column flips. If you have a staging
  Resend project, trigger a submission or publish a brief and verify the
  right recipients are emailed
- [ ] Open the invite generator, submission review, claim approve/reject,
  and payout confirm modals. Verify Escape closes them, clicking the
  backdrop closes them, focus returns to the trigger button, and Tab
  stays trapped inside
- [ ] Eyeball the native `<dialog>`-based modals on Safari, Firefox, and
  Chrome — they use `showModal()` which is well-supported but worth
  confirming
- [ ] Verify the footer renders on every route (landing, login, admin,
  legal)

---

## 7. Optional pre-launch cleanup

Low-priority but worth considering before a public launch:

- [ ] Replace the hardcoded `"creators@boulders.dk"` fallback in
  `src/components/footer.tsx` and `src/app/admin/settings/page.tsx` if
  that isn't the right address
- [ ] Point the `Image` src in the nav and login page
  (`https://storage.googleapis.com/boulderscss/logo-flat-white.png`) at
  whatever CDN is canonical — it's fine today but worth knowing it's
  external
- [ ] Decide whether to leave creators' and admins' default notification
  state at `true` (current) or flip to opt-in. The column default is set
  in migration 0009; changing it after launch requires a backfill
