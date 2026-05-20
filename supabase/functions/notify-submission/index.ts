import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const WEBHOOK_AUTH_SECRET = Deno.env.get("WEBHOOK_AUTH_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";
const SENDER_NAME = Deno.env.get("PLATFORM_SENDER_NAME") || "Briefly";
const SENDER_EMAIL = Deno.env.get("PLATFORM_SENDER_EMAIL") || "notifications@example.com";

function authorized(req: Request): boolean {
  if (!WEBHOOK_AUTH_SECRET) return false;
  return req.headers.get("authorization") === `Bearer ${WEBHOOK_AUTH_SECRET}`;
}

interface WebhookPayload {
  type: "UPDATE";
  table: "claims";
  record: {
    id: string;
    brief_id: string;
    creator_id: string;
    status: string;
    submission_url: string;
    submission_notes: string | null;
    submitted_at: string;
  };
  old_record: {
    status: string;
  };
}

serve(async (req) => {
  if (!authorized(req)) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const payload: WebhookPayload = await req.json();

    // Only proceed if status changed to "submitted"
    if (
      payload.old_record.status !== "submitted" &&
      payload.record.status === "submitted"
    ) {
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

      // Get brief details
      const { data: brief } = await supabase
        .from("briefs")
        .select("title")
        .eq("id", payload.record.brief_id)
        .single();

      // Get creator details
      const { data: creator } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", payload.record.creator_id)
        .single();

      // Get the claim's org_id
      const { data: claim } = await supabase
        .from("claims")
        .select("org_id")
        .eq("id", payload.record.id)
        .single();

      // Get admin emails for this org — honour per-admin submission-alert preference
      const { data: adminMemberships } = await supabase
        .from("memberships")
        .select("user_id, profile:profiles(email, notify_submissions)")
        .eq("org_id", claim?.org_id)
        .eq("role", "admin")
        .eq("status", "active");

      const admins = (adminMemberships || [])
        .filter((m: any) => m.profile?.notify_submissions !== false)
        .map((m: any) => ({ email: m.profile?.email }))
        .filter((a: any) => a.email);

      if (!admins || admins.length === 0 || !RESEND_API_KEY) {
        return new Response(JSON.stringify({ message: "No admins or API key" }), {
          status: 200,
        });
      }

      const adminEmails = admins.map((a) => a.email).filter(Boolean);

      // Send email via Resend
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
          to: adminEmails,
          subject: `New Submission: ${brief?.title || "Brief"}`,
          html: `
            <h2>New Content Submission</h2>
            <p><strong>Brief:</strong> ${brief?.title || "Unknown"}</p>
            <p><strong>Creator:</strong> ${creator?.name || creator?.email || "Unknown"}</p>
            <p><strong>Submission URL:</strong> <a href="${payload.record.submission_url}">${payload.record.submission_url}</a></p>
            ${payload.record.submission_notes ? `<p><strong>Notes:</strong> ${payload.record.submission_notes}</p>` : ""}
            <p><a href="${APP_URL}/admin/claims">Review in Admin</a></p>
          `,
        }),
      });

      const resendData = await res.json();

      if (!res.ok) {
        console.error("Resend rejected:", res.status, resendData);
        return new Response(
          JSON.stringify({ success: false, status: res.status, resend: resendData }),
          { status: 502 }
        );
      }

      console.log("Resend response:", resendData);
      return new Response(JSON.stringify({ success: true, resend: resendData }), {
        status: 200,
      });
    }

    return new Response(JSON.stringify({ message: "Not a submission event" }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
