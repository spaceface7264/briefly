export const PLATFORM_COUNTRY = "DK";
export const SELF_BILLING_AGREEMENT_VERSION = "v1-2026-04";

export interface PlatformDetails {
  name: string;
  address: string;
  cvr: string;
  vatNumber: string;
  logoUrl: string;
  contactEmail: string;
}

export function platformDetails(): PlatformDetails {
  return {
    name:
      process.env.NEXT_PUBLIC_PLATFORM_NAME ||
      process.env.PLATFORM_NAME ||
      "Briefly",
    address: process.env.PLATFORM_ADDRESS || "",
    cvr: process.env.PLATFORM_CVR || "",
    vatNumber: process.env.PLATFORM_VAT_NUMBER || "",
    logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "/logo.png",
    contactEmail:
      process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@example.com",
  };
}

export function selfBillingAgreementText(platformName?: string): string {
  const name = platformName || platformDetails().name;
  return `Self-billing agreement (${SELF_BILLING_AGREEMENT_VERSION})

By accepting, you authorise ${name} (the platform) to issue invoices on your behalf for any approved and paid submission delivered through this platform. You agree:

  1. You will not issue your own invoices for services covered by this agreement.
  2. You will notify ${name} without delay if your VAT registration status, VAT number, CVR number, name, address, or country changes.
  3. You are responsible for declaring and paying any VAT due on the invoiced amounts to your tax authority, where applicable.
  4. ${name} will send each issued invoice to you at the contact email on your profile and/or make it available for download from your account.
  5. This agreement applies to invoices issued until withdrawn in writing. Withdrawal takes effect for invoices issued after ${name} has acknowledged the withdrawal.

This agreement is issued in accordance with applicable VAT self-billing legislation in the platform's jurisdiction and the corresponding provisions of the EU VAT Directive.`;
}

/** @deprecated Use selfBillingAgreementText() instead */
export const SELF_BILLING_AGREEMENT_TEXT = selfBillingAgreementText();
