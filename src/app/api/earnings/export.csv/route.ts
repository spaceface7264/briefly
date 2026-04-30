import { createClient } from "@/lib/supabase/server";
import { requireCreatorAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

interface PaymentRow {
  id: string;
  status: string;
  amount_dkk: number | null;
  total_dkk: number | null;
  subtotal_dkk: number | null;
  vat_amount_dkk: number | null;
  vat_rate_bp: number | null;
  vat_scheme: string | null;
  gross_dkk: number | null;
  platform_fee_dkk: number | null;
  platform_fee_bp: number | null;
  invoice_number: string | null;
  invoice_issued_at: string | null;
  created_at: string;
  org: { name: string } | null;
  claim: { brief: { title: string } | null } | null;
}

const HEADERS = [
  "invoice_number",
  "invoice_date",
  "status",
  "org",
  "brief",
  "gross_dkk",
  "platform_fee_dkk",
  "platform_fee_bp",
  "subtotal_dkk",
  "vat_dkk",
  "vat_rate_bp",
  "vat_scheme",
  "total_received_dkk",
] as const;

/**
 * CSV export of every payment for the calling creator. Used by the
 * /profile/earnings dashboard "Download CSV" button. Carries enough
 * detail for tax filings — gross, platform fee, VAT split, total
 * received — frozen at payout time per the columns introduced in
 * migrations 0007 / 0026.
 *
 * Filename includes today's date so back-to-back downloads don't
 * overwrite each other in the user's Downloads folder.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Not signed in", { status: 401 });
  }

  await requireCreatorAccount(supabase);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("payments") as any)
    .select(
      "id, status, amount_dkk, total_dkk, subtotal_dkk, vat_amount_dkk, vat_rate_bp, vat_scheme, gross_dkk, platform_fee_dkk, platform_fee_bp, invoice_number, invoice_issued_at, created_at, org:organizations(name), claim:claims(brief:briefs(title))"
    )
    .eq("creator_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(`Failed to load payments: ${error.message}`, {
      status: 500,
    });
  }

  const rows = (data ?? []) as PaymentRow[];

  const lines: string[] = [HEADERS.join(",")];
  for (const p of rows) {
    lines.push(
      [
        csvField(p.invoice_number ?? ""),
        csvField(p.invoice_issued_at ?? p.created_at ?? ""),
        csvField(p.status),
        csvField(p.org?.name ?? ""),
        csvField(p.claim?.brief?.title ?? ""),
        numberField(p.gross_dkk),
        numberField(p.platform_fee_dkk),
        numberField(p.platform_fee_bp),
        numberField(p.subtotal_dkk),
        numberField(p.vat_amount_dkk),
        numberField(p.vat_rate_bp),
        csvField(p.vat_scheme ?? ""),
        numberField(p.total_dkk ?? p.amount_dkk),
      ].join(",")
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="earnings-${today}.csv"`,
    },
  });
}

function csvField(value: string): string {
  // Quote fields containing comma / newline / quote, doubling embedded
  // quotes per RFC 4180.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function numberField(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}
