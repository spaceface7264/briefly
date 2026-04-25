// NOTE: Starter content pending legal review. Specific clauses to verify
// before launch: payout timelines, content ownership transfer, dispute
// resolution venue, limitation of liability, takedown process.

import { LegalPage, LegalSection } from "@/components/legal-page";
import { platformDetails } from "@/lib/invoicing/platform";

export default function TermsPage() {
  const platform = platformDetails();

  return (
    <LegalPage title="Terms of Service" lastUpdated="23 April 2026">
      <p className="text-muted">
        These terms govern your use of {platform.name}&apos;s creator platform
        (the &ldquo;Platform&rdquo;). By creating an account you accept these
        terms. If you do not agree, do not use the Platform.
      </p>

      <LegalSection title="Who can use the Platform">
        <p>
          Access is invite-only. You must be at least 18 years old and legally
          able to enter into a binding contract in your country of residence.
          Accounts are personal and must not be shared.
        </p>
      </LegalSection>

      <LegalSection title="How briefs and claims work">
        <p>
          We publish content briefs. When you claim a brief, the slot is
          reserved for you for seven days. You agree to either submit the
          requested deliverable within that window or release the claim so
          another creator can take it.
        </p>
        <p>
          A claim is not a guarantee of payment. Payment is conditional on
          your submission being reviewed and approved under the criteria in
          the brief.
        </p>
      </LegalSection>

      <LegalSection title="Your submissions and licence">
        <p>
          You retain ownership of the work you create. By submitting a
          deliverable you grant {platform.name} a perpetual, worldwide,
          royalty-free licence to use, reproduce, edit, and display the work
          for marketing purposes, including on {platform.name}-owned channels and
          in paid promotion, subject to any usage rights stated in the specific
          brief.
        </p>
        <p>
          You warrant that the work is your original creation, that you have
          all necessary rights and releases (including from any individuals
          who appear in it), and that the work does not infringe any third
          party&apos;s rights.
        </p>
      </LegalSection>

      <LegalSection title="Payment and invoicing">
        <p>
          Approved submissions are paid at the fixed fee stated on the brief
          via Stripe payouts to the account you connect on your profile.
          Payouts are initiated after approval; settlement timing depends on
          Stripe.
        </p>
        <p>
          {platform.name} issues invoices on your behalf under the separate{" "}
          <a
            className="text-accent hover:underline"
            href="/legal/self-billing"
          >
            self-billing agreement
          </a>
          . You are responsible for declaring and paying any tax due on your
          earnings.
        </p>
      </LegalSection>

      <LegalSection title="Conduct">
        <p>
          You will not submit content that is defamatory, unlawful, hateful,
          misleading, sexually explicit, or that promotes dangerous behaviour.
          You will not attempt to gain unauthorised access to the Platform,
          interfere with other creators, or misuse invite codes.
        </p>
        <p>
          We may suspend or terminate accounts that breach these terms and
          remove content that violates them or third-party rights.
        </p>
      </LegalSection>

      <LegalSection title="Changes to the Platform">
        <p>
          We may change, suspend, or discontinue any part of the Platform at
          any time. We will give reasonable notice of material changes that
          affect active claims.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          The Platform is provided on an as-is basis. To the extent permitted
          by law, {platform.name} is not liable for indirect or consequential
          losses. Nothing in these terms limits liability that cannot be
          limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the law of the jurisdiction in which
          {platform.name} is registered. Disputes will be handled by the
          competent courts in that jurisdiction, without prejudice to any
          mandatory consumer rights you have in your country of residence.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms: write to the address in the footer.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
