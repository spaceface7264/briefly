// Shared HTML/text rendering for transactional email.
//
// Every Edge Function that sends through Resend imports renderEmail()
// from here so all messages share one branded shell, one CTA style,
// and one escape-everything-user-supplied policy. Brief titles,
// creator names, comment bodies etc. are user-supplied; raw template
// interpolation in email HTML is an injection risk even where there
// is no JS execution (broken rendering, layout takeover, header
// tricks via unclosed tags).
//
// Rendering constraints honoured here:
//   1. Table-based layout. Outlook desktop ignores most modern CSS;
//      tables render predictably across every client.
//   2. Inline styles only. No <style> blocks (stripped by Gmail web).
//   3. System font stack. Web fonts are blocked by most clients.
//   4. Light surface by default. Dark-mode email handling is
//      incoherent across clients; the meta color-scheme tags below
//      keep us in light mode predictably.
//   5. Max-width 600px centred. The canonical safe width.
//
// Brand cyan (#09D7D7) matches the in-app accent in globals.css.
// We pair it with the on-brand ink (#0C1618) since cyan is luminous
// and white-on-cyan fails contrast.

const PLATFORM_NAME = Deno.env.get("PLATFORM_NAME") || "Briefly";
const PLATFORM_LOGO_URL = Deno.env.get("PLATFORM_LOGO_URL") || "";
const SUPPORT_EMAIL =
  Deno.env.get("PLATFORM_SUPPORT_EMAIL") ||
  Deno.env.get("PLATFORM_SENDER_EMAIL") ||
  "";
const APP_URL = Deno.env.get("APP_URL") || "https://briefly.dk";

const BRAND = "#09D7D7";
const ON_BRAND = "#0C1618";
const TEXT = "#0a0a0a";
const MUTED = "#6b6b6b";
const SURFACE = "#ffffff";
const PAGE_BG = "#f4f4f2";
const HAIRLINE = "#f0f0ee";
const BORDER = "#e8e8e6";

export type EmailMeta = { label: string; value: string };

export interface EmailContent {
  heading: string;
  // Each entry becomes its own <p> in HTML and is joined by a blank
  // line in the plain-text rendering.
  paragraphs: string[];
  // Optional small key/value list rendered between the body and the
  // CTA. Useful for notification context, e.g.
  //   [{ label: "Brief", value: "Lemon shoot" },
  //    { label: "Payout", value: "DKK 500" }]
  meta?: EmailMeta[];
  cta?: { label: string; href: string };
  // Optional override. If omitted, footer defaults to platform name
  // + support link.
  footerNote?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Conservative URL allowlist: only http / https survive. Anything
// else (javascript:, data:, file:) falls back to APP_URL so a
// malformed or hostile input cannot smuggle a dangerous URL into
// the CTA.
function safeHref(href: string): string {
  try {
    const url = new URL(href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    // Invalid URL; fall through.
  }
  return APP_URL;
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const heading = escapeHtml(content.heading);

  const paragraphsHtml = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${TEXT};">${escapeHtml(
          p
        )}</p>`
    )
    .join("");

  const metaHtml = content.meta?.length
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 24px;border-collapse:collapse;">
        ${content.meta
          .map(
            (m) => `
          <tr>
            <td style="padding:6px 0;font-size:14px;color:${MUTED};width:40%;vertical-align:top;">${escapeHtml(
              m.label
            )}</td>
            <td style="padding:6px 0;font-size:14px;color:${TEXT};font-weight:600;">${escapeHtml(
              m.value
            )}</td>
          </tr>`
          )
          .join("")}
      </table>`
    : "";

  const ctaHtml = content.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 0;">
        <tr>
          <td style="border-radius:8px;background-color:${BRAND};">
            <a href="${safeHref(content.cta.href)}"
               style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:${ON_BRAND};text-decoration:none;border-radius:8px;">
              ${escapeHtml(content.cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const logoHtml = PLATFORM_LOGO_URL
    ? `<img src="${escapeHtml(
        PLATFORM_LOGO_URL
      )}" alt="${escapeHtml(
        PLATFORM_NAME
      )}" height="32" style="display:block;height:32px;max-height:32px;border:0;" />`
    : `<strong style="font-size:18px;color:${TEXT};">${escapeHtml(
        PLATFORM_NAME
      )}</strong>`;

  const footerNote = content.footerNote
    ? escapeHtml(content.footerNote)
    : `You're receiving this from ${escapeHtml(PLATFORM_NAME)}. ` +
      (SUPPORT_EMAIL
        ? `Reply to <a href="mailto:${escapeHtml(
            SUPPORT_EMAIL
          )}" style="color:${MUTED};">${escapeHtml(SUPPORT_EMAIL)}</a> if anything looks wrong.`
        : "");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="width:100%;max-width:600px;background-color:${SURFACE};border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid ${HAIRLINE};">${logoHtml}</td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${TEXT};">${heading}</h1>
              ${paragraphsHtml}
              ${metaHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background-color:#fafaf9;border-top:1px solid ${HAIRLINE};font-size:12px;line-height:1.5;color:${MUTED};">${footerNote}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Plain-text fallback. Resend will derive one from HTML if we
  // omit it, but the auto-version tends to be noisy (button labels
  // duplicated, table dividers as long underscores). Shipping our
  // own keeps it readable and improves spam scoring.
  const textParts: string[] = [content.heading, ""];
  for (const p of content.paragraphs) textParts.push(p);
  if (content.meta?.length) {
    textParts.push("");
    for (const m of content.meta) textParts.push(`${m.label}: ${m.value}`);
  }
  if (content.cta) {
    textParts.push("", `${content.cta.label}: ${safeHref(content.cta.href)}`);
  }
  textParts.push(
    "",
    `${PLATFORM_NAME}${SUPPORT_EMAIL ? ` · ${SUPPORT_EMAIL}` : ""}`
  );

  return { html, text: textParts.join("\n") };
}
