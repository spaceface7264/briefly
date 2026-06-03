import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { renderEmail } from "../_shared/email-layout.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FUNCTIONS_INVOKE_SECRET = Deno.env.get("FUNCTIONS_INVOKE_SECRET");
const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "Briefly";
const SENDER_NAME = Deno.env.get("PLATFORM_SENDER_NAME") || "Briefly";
const SENDER_EMAIL =
  Deno.env.get("PLATFORM_SENDER_EMAIL") || "notifications@example.com";

// Invoked server-side from the createOrg action. Gate on a dedicated
// FUNCTIONS_INVOKE_SECRET bearer so a logged-in user can't drive it to send
// arbitrary invite emails. This function is deployed with --no-verify-jwt:
// the project uses the new sb_secret_* API keys, which the JWT gateway
// rejects, so this secret is the real auth boundary.
function authorized(req: Request): boolean {
  if (!FUNCTIONS_INVOKE_SECRET) return false;
  return (
    req.headers.get("authorization") === `Bearer ${FUNCTIONS_INVOKE_SECRET}`
  );
}

interface InvitePayload {
  to: string;
  orgName: string;
  role: string;
  inviteUrl: string;
  expiresAt?: string;
}

serve(async (req) => {
  if (!authorized(req)) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const { to, orgName, role, inviteUrl, expiresAt }: InvitePayload =
      await req.json();

    if (!to || !orgName || !inviteUrl) {
      return new Response(
        JSON.stringify({ error: "Missing to, orgName, or inviteUrl" }),
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
        status: 500,
      });
    }

    const roleLabel = role === "admin" ? "Admin" : role || "Admin";
    const meta = [
      { label: "Organisation", value: orgName },
      { label: "Role", value: roleLabel },
    ];
    if (expiresAt) {
      meta.push({
        label: "Expires",
        value: new Date(expiresAt).toLocaleDateString("en-GB"),
      });
    }

    const { html, text } = renderEmail({
      heading: `You're invited to run ${orgName}`,
      paragraphs: [
        `A ${PLATFORM_NAME} admin set up the organisation "${orgName}" and invited you to be its admin.`,
        "Accept the invite to create your account. You don't need an existing account, the link sets everything up.",
      ],
      meta,
      cta: { label: "Accept invite & set up your account", href: inviteUrl },
      footerNote: `If you weren't expecting this, you can ignore this email. The invite expires on its own.`,
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to: [to],
        subject: `You're invited to run ${orgName} on ${PLATFORM_NAME}`,
        html,
        text,
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

    return new Response(JSON.stringify({ success: true, resend: resendData }), {
      status: 200,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
    });
  }
});
