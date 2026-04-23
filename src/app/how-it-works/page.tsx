import Link from "next/link";
import { Nav } from "@/components/nav";

const steps = [
  {
    title: "Claim brief",
    body: "Claiming reserves one slot for 7 days so you can produce content.",
  },
  {
    title: "Submit work",
    body: "Submit your content URL from My Briefs before the claim expires.",
  },
  {
    title: "Review",
    body: "After submission, status moves to Under Review while admin checks the deliverable.",
  },
  {
    title: "Approved and paid",
    body: "If approved, your claim is ready for payout and is paid via Stripe when triggered by admin.",
  },
];

const statuses = [
  { label: "In Progress", detail: "Claim is active. You can submit work or release the claim." },
  { label: "Under Review", detail: "Submission was received and is waiting for admin decision." },
  { label: "Approved", detail: "Submission accepted and waiting for payout." },
  { label: "Paid", detail: "Payout sent and the claim is complete." },
  { label: "Cancelled", detail: "Claim was released, expired, or rejected." },
];

const faq = [
  {
    q: "What happens if my submission is not approved?",
    a: "The claim is cancelled. You can reclaim a slot and submit a new version if the brief still has open slots.",
  },
  {
    q: "Does Approved mean I get paid instantly?",
    a: "No. Approved means payout-ready. Payment is sent when admin triggers payout.",
  },
  {
    q: "Why can an approved claim still be unpaid?",
    a: "Payout can only be sent when your payout setup is complete and payouts are enabled in Stripe.",
  },
  {
    q: "What do I need to set up before payout?",
    a: "Complete billing details, accept the self-billing agreement, and connect your Stripe payout account.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">How it works</h1>
            <p className="text-text-secondary">
              End-to-end process from claiming a brief to getting paid.
            </p>
          </div>

          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Process</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-lg border border-border bg-surface-raised p-4">
                  <p className="text-xs uppercase tracking-wider text-muted mb-1">Step {index + 1}</p>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-sm text-text-secondary mt-1">{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Status meanings</h2>
            <div className="space-y-2">
              {statuses.map((status) => (
                <div key={status.label} className="rounded-lg border border-border bg-surface-raised p-4">
                  <p className="text-sm font-medium">{status.label}</p>
                  <p className="text-sm text-text-secondary mt-1">{status.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">FAQ</h2>
            <div className="space-y-3">
              {faq.map((item) => (
                <div key={item.q} className="rounded-lg border border-border bg-surface-raised p-4">
                  <p className="text-sm font-medium mb-1">{item.q}</p>
                  <p className="text-sm text-text-secondary">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-surface border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Payout setup</h2>
            <p className="text-sm text-text-secondary mb-3">
              To avoid payout delays, finish setup before your first approved claim.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile/payouts"
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-background text-sm font-semibold rounded-lg transition-colors"
              >
                Open Payout settings
              </Link>
              <Link
                href="/legal/self-billing"
                className="px-4 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
              >
                Read self-billing agreement
              </Link>
              <Link
                href="/guide"
                className="px-4 py-2 border border-border hover:bg-surface-hover text-sm font-medium rounded-lg transition-colors"
              >
                Open content guide
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
