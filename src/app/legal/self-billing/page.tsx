import { LegalPage } from "@/components/legal-page";
import {
  SELF_BILLING_AGREEMENT_TEXT,
  SELF_BILLING_AGREEMENT_VERSION,
} from "@/lib/invoicing/platform";

export default function SelfBillingPage() {
  return (
    <LegalPage
      title="Self-billing agreement"
      lastUpdated={SELF_BILLING_AGREEMENT_VERSION}
      draft={false}
    >
      <p className="text-muted">
        You accept this agreement on your profile before you can receive
        payouts. This page is the canonical reference for the current
        version.
      </p>

      <pre className="bg-surface border border-border rounded-lg p-5 text-sm whitespace-pre-wrap font-mono text-foreground leading-relaxed">
        {SELF_BILLING_AGREEMENT_TEXT}
      </pre>
    </LegalPage>
  );
}
