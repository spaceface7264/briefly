import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Get invited",
    body: "The platform is invite-only. If you create content and want in, reach out to the Boulders marketing team for a code.",
  },
  {
    number: "02",
    title: "Claim a brief",
    body: "Browse open briefs across Boulders gyms. Pick one that fits your style and reserve the slot for 7 days.",
  },
  {
    number: "03",
    title: "Submit and get paid",
    body: "Deliver your reel, TikTok, or photo. Once approved, you get paid in DKK with a self-billed invoice.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 relative overflow-hidden">
      {/* Ambient magenta glow — brand presence without overloading */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/10 blur-[120px]"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center space-y-6">
          <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted px-3 py-1 rounded-full border border-border bg-surface">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-status-pulse" />
            Invite-only
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            Boulders <span className="text-accent">Creators</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mx-auto">
            Get paid to make content for Boulders climbing gyms. Reels, TikToks,
            photos, long-form — real briefs with real budgets.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Link
              href="/login"
              className="px-6 py-3 bg-accent hover:bg-accent-hover text-background font-semibold rounded-lg transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className="px-6 py-3 border border-border-strong hover:bg-surface-hover font-semibold rounded-lg transition-colors"
            >
              Redeem invite code
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative bg-surface border border-border rounded-xl p-6 hover:border-border-strong transition-colors"
            >
              <p className="font-mono text-accent text-sm mb-3">{step.number}</p>
              <h2 className="font-semibold mb-2">{step.title}</h2>
              <p className="text-muted text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
