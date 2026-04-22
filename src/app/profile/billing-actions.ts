"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { EU_COUNTRIES } from "@/lib/invoicing/vat";
import { SELF_BILLING_AGREEMENT_VERSION } from "@/lib/invoicing/platform";

export interface BillingDetailsInput {
  country: string;
  billingAddressLine1: string;
  billingAddressLine2: string;
  billingPostalCode: string;
  billingCity: string;
  vatRegistered: boolean;
  vatNumber: string;
  cvrNumber: string;
  acceptSelfBillingAgreement: boolean;
}

type Result = { ok: true } | { ok: false; error: string };

export async function saveBillingDetails(
  input: BillingDetailsInput
): Promise<Result> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const country = input.country.trim().toUpperCase();
  if (!country) return { ok: false, error: "Country is required" };
  if (country.length !== 2) return { ok: false, error: "Country must be a 2-letter code" };

  if (input.vatRegistered && country !== "DK" && !EU_COUNTRIES.has(country)) {
    return { ok: false, error: "VAT registration is only supported for EU countries" };
  }

  if (input.vatRegistered && !input.vatNumber.trim()) {
    return { ok: false, error: "VAT number is required when VAT-registered" };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("self_billing_agreement_accepted_at, self_billing_agreement_version")
    .eq("id", user.id)
    .single();

  const agreementCurrent =
    existing?.self_billing_agreement_version === SELF_BILLING_AGREEMENT_VERSION &&
    Boolean(existing?.self_billing_agreement_accepted_at);

  let agreementVersion = existing?.self_billing_agreement_version ?? null;
  let agreementAcceptedAt = existing?.self_billing_agreement_accepted_at ?? null;

  if (input.acceptSelfBillingAgreement && !agreementCurrent) {
    agreementVersion = SELF_BILLING_AGREEMENT_VERSION;
    agreementAcceptedAt = new Date().toISOString();
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      country,
      billing_address_line1: input.billingAddressLine1.trim() || null,
      billing_address_line2: input.billingAddressLine2.trim() || null,
      billing_postal_code: input.billingPostalCode.trim() || null,
      billing_city: input.billingCity.trim() || null,
      vat_registered: input.vatRegistered,
      vat_number: input.vatRegistered ? input.vatNumber.trim() : null,
      cvr_number: input.cvrNumber.trim() || null,
      self_billing_agreement_version: agreementVersion,
      self_billing_agreement_accepted_at: agreementAcceptedAt,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}
