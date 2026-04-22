# Boulders Creators

Invite-only content creator platform for Boulders climbing gyms.

## Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4 (dark-first, magenta #ff00ff accent)
- Supabase (Auth + Postgres + RLS)
- Fonts: DM Sans + DM Mono

## Development

```bash
npm run dev    # Start dev server
npm run build  # Production build
npm run lint   # ESLint
```

## Database

Types are generated from Supabase:

```bash
npx supabase gen types typescript --project-id PROJECT_ID > src/types/database.ts
```

Migrations are in `supabase/migrations/`. Run them via Supabase Dashboard SQL Editor.

## Project Structure

- `src/app/` - Next.js app router pages
- `src/app/admin/` - Admin dashboard (role-gated)
- `src/components/` - Shared components
- `src/lib/supabase/` - Supabase client helpers
- `src/types/` - TypeScript types
- `supabase/migrations/` - Database migrations
- `supabase/functions/` - Edge Functions for email notifications

## Key Patterns

- Server components fetch data, client components handle interactions
- RLS policies enforce access control at database level
- `is_admin()` function checks user role for admin operations

## Email Notifications

Edge Functions in `supabase/functions/` send emails via Resend:

- `notify-submission` - Notifies admins when creators submit work
- `notify-new-brief` - Notifies creators when new briefs are published

See `supabase/functions/README.md` for setup instructions.
