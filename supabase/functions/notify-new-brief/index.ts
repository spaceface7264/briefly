import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

interface WebhookPayload {
  type: "INSERT";
  table: "briefs";
  record: {
    id: string;
    title: string;
    description: string;
    category: string;
    format: string;
    payout_amount: number;
    gym_location: string | null;
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

    // Get all active creators — honour per-creator email notification preference
    const { data: creators } = await supabase
      .from("profiles")
      .select("email, name")
      .eq("role", "creator")
      .eq("email_notifications_enabled", true);

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
        from: "Boulders Creators <notifications@boulders.dk>",
        bcc: creatorEmails, // Use BCC for privacy
        subject: `New Brief: ${payload.record.title}`,
        html: `
          <h2>New Brief Available</h2>
          <h3>${payload.record.title}</h3>
          <p>${payload.record.description}</p>
          <p><strong>Category:</strong> ${payload.record.category}</p>
          <p><strong>Format:</strong> ${payload.record.format}</p>
          <p><strong>Payout:</strong> ${payout}</p>
          ${payload.record.gym_location ? `<p><strong>Location:</strong> ${payload.record.gym_location}</p>` : ""}
          <p style="margin-top: 20px;">
            <a href="https://creators.boulders.dk/briefs/${payload.record.id}"
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
