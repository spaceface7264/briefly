import type { VatScheme } from "@/types/database";
import { PLATFORM_COUNTRY } from "./platform";

// ISO 3166-1 alpha-2 codes for EU member states as of 2026.
// Note: the UK (GB) is not included; Northern Ireland (XI) uses a separate
// VAT regime for goods only and is out of scope for services.
export const EU_COUNTRIES = new Set<string>([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]);

export const COUNTRY_LABELS: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", HR: "Croatia", CY: "Cyprus",
  CZ: "Czech Republic", DK: "Denmark", EE: "Estonia", FI: "Finland", FR: "France",
  DE: "Germany", GR: "Greece", HU: "Hungary", IE: "Ireland", IT: "Italy",
  LV: "Latvia", LT: "Lithuania", LU: "Luxembourg", MT: "Malta", NL: "Netherlands",
  PL: "Poland", PT: "Portugal", RO: "Romania", SK: "Slovakia", SI: "Slovenia",
  ES: "Spain", SE: "Sweden",
};

export const DK_STANDARD_VAT_RATE_BP = 2500; // 25.00% in basis points

export interface CreatorVatStatus {
  country: string | null;
  vatRegistered: boolean;
}

export interface VatCalculation {
  scheme: VatScheme;
  rateBp: number; // basis points, e.g. 2500 = 25%
  subtotalDkk: number;
  vatAmountDkk: number;
  totalDkk: number;
  note: string | null; // text to print on the invoice (e.g. reverse charge)
}

// Determine the VAT scheme that applies when the Danish platform self-bills a
// creator. The brief price is the creator's net fee; VAT is added on top when
// required by the scheme.
export function calculateVat(
  subtotalDkk: number,
  creator: CreatorVatStatus
): VatCalculation {
  const country = creator.country?.toUpperCase() ?? null;

  // Not VAT-registered: no VAT on the invoice.
  if (!creator.vatRegistered) {
    return {
      scheme: "none",
      rateBp: 0,
      subtotalDkk,
      vatAmountDkk: 0,
      totalDkk: subtotalDkk,
      note: null,
    };
  }

  // Creator in Denmark: standard DK VAT applies.
  if (country === PLATFORM_COUNTRY) {
    const vatAmountDkk = Math.round((subtotalDkk * DK_STANDARD_VAT_RATE_BP) / 10000);
    return {
      scheme: "standard",
      rateBp: DK_STANDARD_VAT_RATE_BP,
      subtotalDkk,
      vatAmountDkk,
      totalDkk: subtotalDkk + vatAmountDkk,
      note: null,
    };
  }

  // VAT-registered creator elsewhere in the EU: reverse charge.
  if (country && EU_COUNTRIES.has(country)) {
    return {
      scheme: "reverse_charge",
      rateBp: 0,
      subtotalDkk,
      vatAmountDkk: 0,
      totalDkk: subtotalDkk,
      note: "Reverse charge — VAT to be accounted for by the recipient (Article 196 of EU VAT Directive 2006/112/EC).",
    };
  }

  // Non-EU (treat as outside scope of VAT).
  return {
    scheme: "none",
    rateBp: 0,
    subtotalDkk,
    vatAmountDkk: 0,
    totalDkk: subtotalDkk,
    note: "Service supplied outside the scope of EU VAT.",
  };
}

export function formatInvoiceNumber(year: number, seq: number): string {
  return `${year}-${seq.toString().padStart(5, "0")}`;
}

export function formatDkk(amountDkk: number): string {
  return `${amountDkk.toLocaleString("da-DK")} DKK`;
}

export function formatVatRateBp(rateBp: number): string {
  return `${(rateBp / 100).toFixed(2)}%`;
}
