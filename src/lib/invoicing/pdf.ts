import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Payment } from "@/types/database";
import { formatDkk, formatInvoiceNumber, formatVatRateBp } from "./vat";
import { platformDetails } from "./platform";

const MARGIN = 48;
const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const LINE = 14;

function toLatin1Safe(input: string | null | undefined): string {
  if (!input) return "";
  // Strip characters outside the WinAnsi range that StandardFonts can encode.
  return input.replace(/[^\x00-\xFF]/g, "?");
}

export async function renderInvoicePdf(payment: Payment): Promise<Uint8Array> {
  if (!payment.invoice_number || !payment.invoice_issued_at) {
    throw new Error("Payment has no invoice issued");
  }

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${payment.invoice_number}`);
  const platform = platformDetails();
  pdf.setCreator(platform.name);
  pdf.setProducer(platform.name);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx = { page, font, bold, y: PAGE_HEIGHT - MARGIN };

  drawHeader(ctx, payment);
  ctx.y -= LINE * 2;
  drawParties(ctx, payment);
  ctx.y -= LINE * 2;
  drawLineItems(ctx, payment);
  ctx.y -= LINE * 2;
  drawTotals(ctx, payment);
  ctx.y -= LINE * 2;
  drawFooter(ctx, payment);

  return pdf.save();
}

interface Ctx {
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
}

function text(ctx: Ctx, value: string, x: number, opts: { bold?: boolean; size?: number } = {}) {
  const size = opts.size ?? 10;
  const f = opts.bold ? ctx.bold : ctx.font;
  ctx.page.drawText(toLatin1Safe(value), { x, y: ctx.y, size, font: f, color: rgb(0, 0, 0) });
}

function line(ctx: Ctx, value: string, x = MARGIN, opts: { bold?: boolean; size?: number } = {}) {
  text(ctx, value, x, opts);
  ctx.y -= LINE;
}

function drawHeader(ctx: Ctx, payment: Payment) {
  const invoiceNumber = payment.invoice_number
    ?? formatInvoiceNumber(payment.invoice_year ?? 0, payment.invoice_seq ?? 0);
  const issued = new Date(payment.invoice_issued_at ?? payment.created_at);

  line(ctx, "INVOICE", MARGIN, { bold: true, size: 20 });
  ctx.y -= LINE;
  line(ctx, `Invoice number: ${invoiceNumber}`);
  line(ctx, `Issue date: ${issued.toLocaleDateString("en-GB")}`);
  line(ctx, `Issued under self-billing agreement ${payment.self_billing_agreement_version_snapshot ?? ""}`);
}

function drawParties(ctx: Ctx, payment: Payment) {
  const startY = ctx.y;
  const columnRight = PAGE_WIDTH / 2 + 10;

  line(ctx, "Supplier (creator)", MARGIN, { bold: true });
  for (const value of partyLines({
    name: payment.creator_name_snapshot,
    address: payment.creator_address_snapshot,
    country: payment.creator_country_snapshot,
    vatNumber: payment.creator_vat_number_snapshot,
    cvr: payment.creator_cvr_snapshot,
  })) {
    line(ctx, value);
  }

  const leftEndY = ctx.y;
  ctx.y = startY;
  line(ctx, "Customer (platform)", columnRight, { bold: true });
  for (const value of partyLines({
    name: payment.platform_name_snapshot,
    address: payment.platform_address_snapshot,
    country: "DK",
    vatNumber: payment.platform_vat_snapshot,
    cvr: payment.platform_cvr_snapshot,
  })) {
    line(ctx, value, columnRight);
  }

  ctx.y = Math.min(leftEndY, ctx.y);
}

function partyLines(party: {
  name: string | null;
  address: string | null;
  country: string | null;
  vatNumber: string | null;
  cvr: string | null;
}): string[] {
  const lines: string[] = [];
  if (party.name) lines.push(party.name);
  if (party.address) {
    for (const row of party.address.split("\n")) lines.push(row);
  }
  if (party.country) lines.push(`Country: ${party.country}`);
  if (party.cvr) lines.push(`CVR: ${party.cvr}`);
  if (party.vatNumber) lines.push(`VAT no: ${party.vatNumber}`);
  return lines;
}

function drawLineItems(ctx: Ctx, payment: Payment) {
  const col = { desc: MARGIN, amount: PAGE_WIDTH - MARGIN - 80 };

  line(ctx, "Description", col.desc, { bold: true });
  text(ctx, "Amount (DKK)", col.amount, { bold: true });
  ctx.y -= LINE;

  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: ctx.y + 4 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  ctx.y -= 2;

  const description = payment.brief_title_snapshot
    ? `Creator fee — ${payment.brief_title_snapshot}`
    : "Creator fee";
  text(ctx, description, col.desc);
  text(ctx, formatDkk(payment.subtotal_dkk ?? payment.amount_dkk), col.amount);
  ctx.y -= LINE;
}

function drawTotals(ctx: Ctx, payment: Payment) {
  const rightCol = PAGE_WIDTH - MARGIN - 80;
  const labelCol = PAGE_WIDTH - MARGIN - 220;
  const subtotal = payment.subtotal_dkk ?? payment.amount_dkk;
  const total = payment.total_dkk ?? payment.amount_dkk;

  text(ctx, "Subtotal", labelCol);
  text(ctx, formatDkk(subtotal), rightCol);
  ctx.y -= LINE;

  if (payment.vat_scheme === "standard") {
    text(ctx, `VAT (${formatVatRateBp(payment.vat_rate_bp)})`, labelCol);
    text(ctx, formatDkk(payment.vat_amount_dkk), rightCol);
    ctx.y -= LINE;
  } else if (payment.vat_scheme === "reverse_charge") {
    text(ctx, "VAT (reverse charge)", labelCol);
    text(ctx, "0 DKK", rightCol);
    ctx.y -= LINE;
  } else {
    text(ctx, "VAT", labelCol);
    text(ctx, "0 DKK", rightCol);
    ctx.y -= LINE;
  }

  text(ctx, "Total", labelCol, { bold: true });
  text(ctx, formatDkk(total), rightCol, { bold: true });
  ctx.y -= LINE;
}

function drawFooter(ctx: Ctx, payment: Payment) {
  if (payment.vat_scheme === "reverse_charge") {
    line(
      ctx,
      "Reverse charge — VAT to be accounted for by the recipient",
      MARGIN,
      { bold: true }
    );
    line(
      ctx,
      "(Article 196 of EU VAT Directive 2006/112/EC).",
      MARGIN
    );
    ctx.y -= LINE / 2;
  }

  const transferId = payment.stripe_transfer_id;
  if (transferId) {
    line(ctx, `Payment reference: ${transferId}`);
  }
  line(
    ctx,
    `This invoice has been issued by ${platformDetails().name} on behalf of the supplier under a self-billing agreement.`
  );
}
