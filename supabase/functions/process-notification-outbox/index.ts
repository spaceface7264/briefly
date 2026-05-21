import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderEmail } from "../_shared/email-layout.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEBHOOK_AUTH_SECRET = Deno.env.get("WEBHOOK_AUTH_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";
const SENDER_NAME = Deno.env.get("PLATFORM_SENDER_NAME") || "Briefly";
const SENDER_EMAIL = Deno.env.get("PLATFORM_SENDER_EMAIL") || "notifications@example.com";
const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "Briefly";

function authorized(req: Request): boolean {
  if (!WEBHOOK_AUTH_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${WEBHOOK_AUTH_SECRET}`;
}

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 30;

type OutboxRow = {
  id: string;
  attempt_count: number;
  notification_id: string;
  notification: {
    id: string;
    event_type: string;
    title: string;
    body: string;
    entity_type: string;
    entity_id: string;
    recipient_id: string;
    metadata: Record<string, unknown> | null;
  } | null;
};

function preferenceColumnFor(eventType: string): string {
  if (eventType === "brief_published") return "notify_new_briefs";
  if (eventType === "claim_submitted" || eventType === "claim_created" || eventType === "claim_expired") {
    return "notify_claim_queue";
  }
  if (eventType === "claim_paid") return "notify_payments";
  if (
    eventType === "application_received" ||
    eventType === "application_approved" ||
    eventType === "application_rejected"
  ) {
    return "notify_applications";
  }
  return "notify_claim_updates";
}

function nextRetryAt(attemptCount: number): string {
  const backoffMinutes = Math.min(60, Math.max(1, 2 ** attemptCount));
  return new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();
}

async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error (${response.status}): ${body}`);
  }
}

serve(async (req) => {
  if (!authorized(req)) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing required env vars for outbox worker" }),
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: outboxRows, error: fetchError } = await supabase
      .from("notification_outbox")
      .select(
        "id, attempt_count, notification_id, notification:notifications(id, event_type, title, body, entity_type, entity_id, recipient_id, metadata)"
      )
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    const rows = (outboxRows ?? []) as OutboxRow[];
    let processed = 0;
    let sent = 0;

    for (const row of rows) {
      processed += 1;

      if (!row.notification) {
        await supabase
          .from("notification_outbox")
          .update({
            status: "failed",
            attempt_count: row.attempt_count + 1,
            last_error: "Missing notification relation",
            next_attempt_at: nextRetryAt(row.attempt_count + 1),
          })
          .eq("id", row.id);
        continue;
      }

      const prefColumn = preferenceColumnFor(row.notification.event_type);
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`email, ${prefColumn}`)
        .eq("id", row.notification.recipient_id)
        .single();

      if (profileError || !profile?.email) {
        await supabase
          .from("notification_outbox")
          .update({
            status: "failed",
            attempt_count: row.attempt_count + 1,
            last_error: profileError?.message ?? "Recipient email missing",
            next_attempt_at: nextRetryAt(row.attempt_count + 1),
          })
          .eq("id", row.id);
        continue;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((profile as any)[prefColumn] === false) {
        await supabase
          .from("notification_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: "Skipped due to user preference",
          })
          .eq("id", row.id);
        continue;
      }

      await supabase
        .from("notification_outbox")
        .update({ status: "processing" })
        .eq("id", row.id);

      const targetHref =
        row.notification.entity_type === "brief"
          ? `${APP_URL}/briefs/${row.notification.entity_id}`
          : row.notification.event_type === "application_received"
            ? `${APP_URL}/admin/applications`
            : row.notification.event_type === "application_approved" ||
                row.notification.event_type === "application_rejected"
              ? `${APP_URL}/profile`
              : row.notification.event_type === "claim_submitted" ||
                  row.notification.event_type === "claim_created"
                ? `${APP_URL}/admin/claims`
                : `${APP_URL}/my-briefs`;

      try {
        const { html, text } = renderEmail({
          heading: row.notification.title,
          paragraphs: [row.notification.body],
          cta: { label: `Open in ${PLATFORM_NAME}`, href: targetHref },
        });
        await sendEmail({
          to: profile.email,
          subject: row.notification.title,
          html,
          text,
        });

        await supabase
          .from("notification_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempt_count: row.attempt_count + 1,
            last_error: null,
          })
          .eq("id", row.id);
        sent += 1;
      } catch (error) {
        const attempts = row.attempt_count + 1;
        const terminal = attempts >= MAX_ATTEMPTS;
        await supabase
          .from("notification_outbox")
          .update({
            status: "failed",
            attempt_count: attempts,
            last_error: error instanceof Error ? error.message : "Unknown send error",
            next_attempt_at: terminal
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
              : nextRetryAt(attempts),
          })
          .eq("id", row.id);
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        sent,
      }),
      { status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
});
