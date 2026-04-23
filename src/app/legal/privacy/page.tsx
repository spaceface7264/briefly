// NOTE: Starter content pending legal review. Specific items to verify
// before launch: full list of sub-processors, retention periods for claims
// and invoices, DPA arrangements with Supabase/Stripe/Resend, lawful basis
// for each processing purpose, DPO appointment, EU-US data transfer basis.

import { LegalPage, LegalSection } from "@/components/legal-page";
import { platformDetails } from "@/lib/invoicing/platform";

export default function PrivacyPage() {
  const platform = platformDetails();

  return (
    <LegalPage title="Privacy Policy" lastUpdated="23 April 2026">
      <p className="text-muted">
        This page explains what personal data {platform.name} collects when
        you use the creator platform, why we need it, who we share it with,
        and what rights you have under the EU General Data Protection
        Regulation (GDPR).
      </p>

      <LegalSection title="Who is the controller">
        <p>
          {platform.name} is the data controller for personal data processed
          through the creator platform. You can reach us at the contact
          address in the footer.
        </p>
      </LegalSection>

      <LegalSection title="What data we collect">
        <p>When you use the platform we process the following categories:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-foreground">Account:</span> email address,
            password (stored hashed by our auth provider), display name, role
            (creator or admin).
          </li>
          <li>
            <span className="text-foreground">Profile:</span> Instagram
            handle, content tags, country, invoicing address, VAT number, CVR
            number, self-billing agreement acceptance.
          </li>
          <li>
            <span className="text-foreground">Payouts:</span> Stripe Connect
            account identifier and payout status. Your bank details are held
            by Stripe, not by us.
          </li>
          <li>
            <span className="text-foreground">Briefs and claims:</span> which
            briefs you claim, when, your submission URL and notes, approval
            status, invoice metadata.
          </li>
          <li>
            <span className="text-foreground">Technical:</span> session
            cookies and standard server logs (IP, user agent, timestamps)
            used for security and diagnostics.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we process it (legal basis)">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-foreground">Contract</span> (GDPR Art. 6(1)
            (b)) — to run your account, manage claims, pay you, and issue
            invoices under the self-billing agreement.
          </li>
          <li>
            <span className="text-foreground">Legal obligation</span> (Art.
            6(1)(c)) — to keep invoicing and tax records for the retention
            periods set by Danish law.
          </li>
          <li>
            <span className="text-foreground">Legitimate interests</span>{" "}
            (Art. 6(1)(f)) — to secure the platform, prevent abuse, and
            communicate operationally (for example, notifying admins when
            you submit a brief).
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share it with (sub-processors)">
        <p>
          We rely on a small number of third-party services. Each one
          processes data on our behalf under a data processing agreement:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <span className="text-foreground">Supabase</span> — authentication
            and database hosting.
          </li>
          <li>
            <span className="text-foreground">Stripe</span> — Connect
            onboarding and payouts.
          </li>
          <li>
            <span className="text-foreground">Resend</span> — transactional
            email (brief notifications, account emails).
          </li>
          <li>
            <span className="text-foreground">Cloudflare</span> — content
            delivery and infrastructure.
          </li>
        </ul>
        <p>
          Where a provider processes data outside the EEA, transfers rely on
          the European Commission&apos;s Standard Contractual Clauses and
          additional safeguards where required.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          Account and profile data is kept while your account is active.
          Invoices and related accounting records are retained for five years
          after the end of the financial year, as required by Danish
          bookkeeping rules. Submission metadata is kept while it remains
          relevant to a claim.
        </p>
        <p>
          When you delete your account, we delete or anonymise personal data
          that is not subject to a retention obligation.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under GDPR you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>access the data we hold about you;</li>
          <li>have inaccurate data corrected;</li>
          <li>
            have data erased where there is no ongoing legal basis to keep
            it;
          </li>
          <li>
            restrict or object to processing based on legitimate interests;
          </li>
          <li>receive your data in a portable format;</li>
          <li>
            lodge a complaint with the Danish Data Protection Agency
            (Datatilsynet) if you believe your rights have been violated.
          </li>
        </ul>
        <p>
          To exercise any of these rights, write to us at the contact
          address in the footer.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy as the platform evolves. Material changes
          will be communicated by email or through the platform before they
          take effect.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
