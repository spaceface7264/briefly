import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderInvoicePdf } from "@/lib/invoicing/pdf";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS limits SELECT to the creator who owns the payment or an admin.
  const { data: payment, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!payment) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!payment.invoice_number) {
    return NextResponse.json(
      { error: "Invoice has not been issued for this payment" },
      { status: 404 }
    );
  }

  const bytes = await renderInvoicePdf(payment);
  const body = new Uint8Array(bytes);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${payment.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
