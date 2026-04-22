export const PLATFORM_COUNTRY = "DK";
export const SELF_BILLING_AGREEMENT_VERSION = "v1-2026-04";

export interface PlatformDetails {
  name: string;
  address: string;
  cvr: string;
  vatNumber: string;
}

export function platformDetails(): PlatformDetails {
  return {
    name: process.env.PLATFORM_NAME || "Boulders ApS",
    address: process.env.PLATFORM_ADDRESS || "",
    cvr: process.env.PLATFORM_CVR || "",
    vatNumber: process.env.PLATFORM_VAT_NUMBER || "",
  };
}

export const SELF_BILLING_AGREEMENT_TEXT = `Self-billing agreement (${SELF_BILLING_AGREEMENT_VERSION})

By accepting, you authorise Boulders (the platform) to issue invoices on your behalf for any approved and paid submission delivered through this platform. You agree:

  1. You will not issue your own invoices for services covered by this agreement.
  2. You will notify Boulders without delay if your VAT registration status, VAT number, CVR number, name, address, or country changes.
  3. You are responsible for declaring and paying any VAT due on the invoiced amounts to your tax authority, where applicable.
  4. Boulders will send each issued invoice to you at the contact email on your profile and/or make it available for download from your account.
  5. This agreement applies to invoices issued until withdrawn in writing. Withdrawal takes effect for invoices issued after Boulders has acknowledged the withdrawal.

This agreement is issued in accordance with the self-billing rules under Danish VAT legislation (momsloven § 52a, stk. 5) and the corresponding provisions of the EU VAT Directive.`;
