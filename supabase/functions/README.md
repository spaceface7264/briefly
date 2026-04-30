# Email Notifications Setup

This project includes Supabase Edge Functions for email notifications via Resend.

## Functions

1. **notify-submission** - Legacy webhook notifier for submission events
2. **notify-new-brief** - Legacy webhook notifier for newly published briefs
3. **process-notification-outbox** - Processes queued notification emails from `notification_outbox`

## Setup Instructions

### 1. Install Supabase CLI (if not already)

```bash
npm install -g supabase
```

### 2. Link your project

```bash
npx supabase link --project-ref bncuqifjcsrjkohxkwez
```

### 3. Deploy the functions

```bash
npx supabase functions deploy notify-submission
npx supabase functions deploy notify-new-brief
npx supabase functions deploy process-notification-outbox
### 3b. Configure outbox processing

Set up a Supabase Function schedule (or external cron) to run every minute:

```bash
curl -X POST https://bncuqifjcsrjkohxkwez.supabase.co/functions/v1/process-notification-outbox \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

This worker consumes pending records in `notification_outbox`, applies profile preferences, retries with exponential backoff, and marks sends as delivered.

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
| URL | `https://bncuqifjcsrjkohxkwez.supabase.co/functions/v1/notify-submission` |

Add header:
- `Authorization`: `Bearer YOUR_ANON_KEY`

#### Webhook 2: New Brief Notifications

| Field | Value |
|-------|-------|
| Name | notify-new-brief |
| Table | briefs |
| Events | INSERT |
| Method | POST |
| URL | `https://bncuqifjcsrjkohxkwez.supabase.co/functions/v1/notify-new-brief` |

Add header:
- `Authorization`: `Bearer YOUR_ANON_KEY`

### 6. Configure Resend Domain (Production)

For production, add and verify your domain in [Resend Dashboard](https://resend.com/domains):
- Set `PLATFORM_SENDER_EMAIL` and `PLATFORM_SENDER_NAME` env vars in Supabase
- The `from` address in all functions is now env-driven

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
