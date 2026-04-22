# Email Notifications Setup

This project includes two Supabase Edge Functions for email notifications via Resend.

## Functions

1. **notify-submission** - Notifies admins when a creator submits work
2. **notify-new-brief** - Notifies all creators when a new brief is published

## Setup Instructions

### 1. Install Supabase CLI (if not already)

```bash
npm install -g supabase
```

### 2. Link your project

```bash
npx supabase link --project-ref hfepjqlbwcwhppbxxpkr
```

### 3. Deploy the functions

```bash
npx supabase functions deploy notify-submission
npx supabase functions deploy notify-new-brief
```

### 4. Set the Resend API key

Get your API key from [resend.com/api-keys](https://resend.com/api-keys), then:

```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxx
```

### 5. Configure Database Webhooks

Go to Supabase Dashboard > Database > Webhooks > Create new webhook

#### Webhook 1: Submission Notifications

| Field | Value |
|-------|-------|
| Name | notify-submission |
| Table | claims |
| Events | UPDATE |
| Method | POST |
| URL | `https://hfepjqlbwcwhppbxxpkr.supabase.co/functions/v1/notify-submission` |

Add header:
- `Authorization`: `Bearer YOUR_ANON_KEY`

#### Webhook 2: New Brief Notifications

| Field | Value |
|-------|-------|
| Name | notify-new-brief |
| Table | briefs |
| Events | INSERT |
| Method | POST |
| URL | `https://hfepjqlbwcwhppbxxpkr.supabase.co/functions/v1/notify-new-brief` |

Add header:
- `Authorization`: `Bearer YOUR_ANON_KEY`

### 6. Configure Resend Domain (Production)

For production, add and verify your domain in [Resend Dashboard](https://resend.com/domains):
- Domain: `boulders.dk`
- Update the `from` address in both functions after verification

For testing, you can use `onboarding@resend.dev` as the from address.

## Testing

To test locally:

```bash
npx supabase functions serve notify-submission --env-file .env.local
```

Then send a test payload:

```bash
curl -X POST http://localhost:54321/functions/v1/notify-submission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"type":"UPDATE","table":"claims","record":{"id":"test","status":"submitted"},"old_record":{"status":"active"}}'
```
