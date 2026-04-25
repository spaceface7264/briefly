import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:3000";
const SENDER_NAME = Deno.env.get("PLATFORM_SENDER_NAME") || "Briefly";
const SENDER_EMAIL = Deno.env.get("PLATFORM_SENDER_EMAIL") || "notifications@example.com";

interface WebhookPayload {
  type: "INSERT";
  table: "briefs";
  record: {
    id: string;
    title: string;
    description: string;
    category: string;
    duration_class: string;
    payout_amount: number;
    location: string | null;
    org_id: string;
    status: string;
  };
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();

    // Only notify for published briefs
    if (payload.record.status !== "open") {
      return new Response(JSON.stringify({ message: "Brief not open" }), {
        status: 200,
      });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ message: "No API key" }), {
        status: 200,
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get creators for this brief's org — honour per-creator new-brief preference
    const briefOrgId = payload.record.org_id;
    const { data: creatorMemberships } = await supabase
      .from("memberships")
      .select("user_id, profile:profiles(email, name, notify_new_briefs)")
      .eq("org_id", briefOrgId)
      .eq("role", "creator")
      .eq("status", "active");

    const creators = (creatorMemberships || [])
      .filter((m: any) => m.profile?.notify_new_briefs !== false)
      .map((m: any) => ({ email: m.profile?.email, name: m.profile?.name }))
      .filter((c: any) => c.email);

    if (!creators || creators.length === 0) {
      return new Response(JSON.stringify({ message: "No creators" }), {
        status: 200,
      });
    }

    const creatorEmails = creators.map((c) => c.email).filter(Boolean);

    // Format payout
    const payout = new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      minimumFractionDigits: 0,
    }).format(payload.record.payout_amount);

    // Send email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        bcc: creatorEmails, // Use BCC for privacy
        subject: `New Brief: ${payload.record.title}`,
        html: `
          <h2>New Brief Available</h2>
          <h3>${payload.record.title}</h3>
          <p>${payload.record.description}</p>
          <p><strong>Category:</strong> ${payload.record.category}</p>
          <p><strong>Duration:</strong> ${payload.record.duration_class}</p>
          <p><strong>Payout:</strong> ${payout}</p>
          ${payload.record.location ? `<p><strong>Location:</strong> ${payload.record.location}</p>` : ""}
          <p style="margin-top: 20px;">
            <a href="${APP_URL}/briefs/${payload.record.id}"
               style="background: #ff00ff; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              View Brief
            </a>
          </p>
        `,
      }),
    });

    const resendData = await res.json();
    console.log("Resend response:", resendData);

    return new Response(JSON.stringify({ success: true, resend: resendData }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
});
