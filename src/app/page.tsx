import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountType, landingPathForAccountType } from "@/lib/account";
import { OrgRotatorPill, type OrgRotatorOrg } from "@/components/org-rotator-pill";

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

const steps = [
  {
    number: "01",
    title: "Get in",
    body: `Browse open organisations on /discover and apply, or redeem an invite code from a ${platformName} team.`,
  },
  {
    number: "02",
    title: "Claim a brief",
    body: "Browse open briefs. Pick one that fits your style and reserve the slot for 7 days.",
  },
  {
    number: "03",
    title: "Submit and get paid",
    body: "Deliver your reel, TikTok, or photo. Once approved, you get paid with a self-billed invoice.",
  },
];

async function loadDiscoverableOrgs(): Promise<OrgRotatorOrg[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("organizations")
      .select("id, name, logo_url, accent_color")
      .eq("discoverable", true)
      .order("name", { ascending: true });

    return (data || []).map((o) => ({
      id: o.id,
      name: o.name,
      logoUrl: o.logo_url,
      accentColor: o.accent_color,
    }));
  } catch {
    return [];
  }
}

export default async function Home() {
  // Logged-in users are sent to their shell — the marketing home is
  // a logged-out surface only.
  let accountType: Awaited<ReturnType<typeof getAccountType>> | null = null;
  try {
    const supabase = await createClient();
    accountType = await getAccountType(supabase);
  } catch {
    // Supabase unavailable — fall through to marketing.
  }
  if (accountType) {
    redirect(landingPathForAccountType(accountType));
  }

  const orgs = await loadDiscoverableOrgs();

  return (
    <main className="flex-1 relative overflow-hidden">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-accent/6 blur-[140px]"
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
        <div className="text-center space-y-6">
          {orgs.length > 0 && (
            <div className="flex justify-center">
              <OrgRotatorPill orgs={orgs} />
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            {platformName} <span className="text-brand-pure">Creators</span>
          </h1>
          <p className="text-lg text-muted max-w-lg mx-auto leading-relaxed">
            Get paid to create content for {platformName}. Reels, TikToks,
            photos, long-form — real briefs with real budgets.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-accent hover:bg-accent-hover text-background font-bold rounded-lg transition-colors text-sm"
            >
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className="px-6 py-3 border border-border-strong hover:border-foreground/30 hover:bg-surface-hover font-semibold rounded-lg transition-colors text-sm"
            >
              Redeem invite code
            </Link>
            <Link
              href="/discover"
              className="px-6 py-3 text-muted hover:text-foreground font-semibold rounded-lg transition-colors text-sm"
            >
              Browse organisations →
            </Link>
          </div>
        </div>

        <div className="mt-24 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative bg-surface border border-border rounded-xl p-6 hover:border-border-strong transition-colors"
            >
              <p className="font-mono text-accent text-xs mb-4 tracking-wider">{step.number}</p>
              <h2 className="font-semibold mb-2">{step.title}</h2>
              <p className="text-muted text-sm leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
