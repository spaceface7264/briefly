# Briefly

A generic, multi-business content creator platform. Organizations publish creative briefs, fund them via Stripe escrow, and pay creators on approval. Branding is env-driven (`NEXT_PUBLIC_PLATFORM_NAME`, `NEXT_PUBLIC_LOGO_URL`, etc.) so the same codebase can serve different businesses.

## Stack

- Next.js 16 (App Router) + React 19
- TypeScript
- Tailwind CSS 4 (dark-first, cyan accent)
- shadcn/ui (`src/components/ui/`)
- Supabase (Auth + Postgres + RLS + Storage)
- Stripe Connect (Express, Marketplace mode) for brief escrow + creator payouts
- Resend for transactional email (via Supabase Edge Functions)
- Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`) for production

## Getting Started

Copy the example env file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

### Scripts

```bash
npm run dev      # Start dev server (Next 16)
npm run build    # Production build (Next)
npm run build:cf # OpenNext build for Cloudflare Workers
npm run deploy   # Build + deploy to Workers
npm run lint     # ESLint
```

## Project Structure

- `src/app/` — Next.js app router pages
- `src/app/admin/` — Org dashboard (org-account-gated, role-gated for admin actions)
- `src/components/` — Shared components (`ui/` holds shadcn primitives)
- `src/lib/` — Account guards, active-org context, Stripe + Supabase helpers
- `src/types/database.ts` — Generated Supabase types
- `supabase/migrations/` — Database migrations (run via Supabase Dashboard SQL Editor)
- `supabase/functions/` — Edge Functions for email notifications

## Database

Types are generated from Supabase:

```bash
npx supabase gen types typescript --project-id PROJECT_ID > src/types/database.ts
```

RLS enforces all access. Two account types live on `profiles.account_type`: `creator` (browse/claim) and `org` (manage briefs in `/admin`). Org users belong to one or more `organizations` via `memberships`.

## Companion Docs

- `CLAUDE.md` — architecture, conventions, and guardrails
- `TODO.md` — active task list and source of truth for what's next
- `DESIGN.md` — design system, tokens, component patterns, motion
- `PRODUCT.md` / `PREMORTEM.md` — product scope and launch criteria

## Cloudflare Deploy Workflow

This repo deploys to Cloudflare Workers through GitHub Actions:

- Pull requests to `main` build and deploy to a shared **preview** worker
  (`briefly-preview.<account>.workers.dev`). The deployed URL is posted as
  a sticky comment on the PR, updated on every push. Each PR overwrites
  the previous preview, so coordinate or close older PRs if you need
  isolation.
- Pushes to `main` auto-deploy to production.
- Manual runs of the deploy workflow can target `staging` or `production`.

### Required GitHub Secrets

Add these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Optional GitHub Environments

Create `production` and `staging` environments in GitHub if you want environment-level approvals and secret isolation.
