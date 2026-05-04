# Briefly

Generic, multi-business content creator platform (working title: Briefly). Branding is env-driven via `NEXT_PUBLIC_PLATFORM_NAME`, `NEXT_PUBLIC_LOGO_URL`, etc.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS 4 (dark-first, lime #C8FF00 accent)
- Supabase (Auth + Postgres + RLS + Storage)
- Stripe Connect (Express, Marketplace mode) for brief escrow + creator payouts
- Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) for production deploys
- Fonts: Plus Jakarta Sans + JetBrains Mono

## Development

```bash
npm run dev      # Start dev server (Next 16)
npm run build    # Production build (Next)
npm run build:cf # OpenNext build for Cloudflare Workers
npm run deploy   # Build + deploy to Workers
npm run lint     # ESLint
```

## Database

Types are generated from Supabase:

```bash
npx supabase gen types typescript --project-id PROJECT_ID > src/types/database.ts
```

Migrations are in `supabase/migrations/` (currently at 0037). Run via Supabase Dashboard SQL Editor.

## Project Structure

- `src/app/` - Next.js app router pages
- `src/app/admin/` - Org dashboard (org-account-gated, role-gated for admin actions)
- `src/components/` - Shared components
- `src/lib/account.ts` - Account-type guards (`requireCreatorAccount`, `requireOrgAccount`)
- `src/lib/org.ts` - Active-org context (`getActiveOrg`, `requireActiveOrg`, `requireOrgAdmin`)
- `src/lib/stripe/` - Stripe client + Customer helper for escrow/payouts
- `src/lib/supabase/` - Supabase client helpers (RLS-bound + service-role admin)
- `src/types/` - TypeScript types (`database.ts` is generated)
- `supabase/migrations/` - Database migrations
- `supabase/functions/` - Edge Functions for email notifications

## Auth & Roles

- Two account types on `profiles.account_type`: `creator` and `org`. Creators browse/claim; org users live in `/admin`.
- Org users belong to one or more `organizations` via `memberships` (roles: `owner`, `admin`, `member`). `profiles.active_org_id` selects the active org.
- RLS enforces all access. Key helpers: `is_admin()` (platform admin), `is_org_member(org_id)`, `is_org_admin(org_id)`.

## Money Flow (Stripe Connect)

- Orgs save a payment method via Stripe-hosted Checkout (setup mode) → stored on `organizations.default_payment_method_id`.
- Publishing a brief charges a PaymentIntent off-session for `price_dkk × claim_limit`. Funds sit in escrow tracked on `briefs.escrow_held_dkk` / `funded_status`.
- Approving a claim transfers the slot's gross to the creator's connected account (Express, `transfers: { requested: true }`).
- Archiving an unfilled brief refunds the held remainder via `refunds.create` with idempotency key.
- DKK is stored in whole units everywhere; convert to øre (×100) only at the Stripe boundary.

## Key Patterns

- Server components fetch data; client components handle interactions. Server actions use `redirect()` instead of returning a value when a navigation is needed (avoids client router races).
- File uploads go **direct from browser to Supabase Storage** via signed URLs. Never carry bytes through server actions (Cloudflare Workers caps requests at 100 MB / 500 MB).
- Use the RLS-bound client (`createClient`) for user-scoped reads/writes. Use the service-role client (`createAdminClient`) only when crossing trust boundaries (Stripe webhooks, escrow mutations), and re-check authorization in code.

## Don'ts

- No em-dashes in any output, ever (user-facing copy, code comments, commit messages, PR bodies)
- Don't add new npm dependencies without asking
- Don't use the service-role client outside server-only trust-boundary code (Stripe webhooks, escrow mutations, cross-tenant ops)
- Don't return values from server actions that navigate; use `redirect()`
- Don't store DKK as øre anywhere except at the Stripe boundary
- Don't treat client-side `disabled` / hidden fields as a security boundary; re-check in the server action and rely on RLS
- Don't omit idempotency keys on Stripe mutations (PaymentIntents, Refunds, Transfers); retries will double-charge
- Don't use `requireActiveOrg` for money-moving or destructive admin actions; use `requireOrgAdmin`
- Don't call `revalidatePath` during render (Next 16 throws); only from actions / route handlers
- Don't trust client-supplied IDs in server actions; re-fetch the row and verify org/ownership before mutating
- Don't write `SECURITY DEFINER` functions/triggers without `ALTER ... OWNER TO postgres`; they won't bypass RLS otherwise
- Don't reach for `as any` to silence a type error on a DB row; regenerate `src/types/database.ts` instead
- Don't `await supabase.from(...).update/insert/upsert/delete(...)` without destructuring `{ error }` and handling it; Supabase JS swallows errors silently, which has caused real production drift when triggers or RLS blocked the write

## Email Notifications

Edge Functions in `supabase/functions/` send emails via Resend:

- `notify-submission` - Notifies admins when creators submit work
- `notify-new-brief` - Notifies creators when new briefs are published

See `supabase/functions/README.md` for setup instructions.
