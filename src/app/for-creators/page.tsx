import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccountType, landingPathForAccountType } from "@/lib/account";
import {
  OrgRotatorPill,
  type OrgRotatorOrg,
} from "@/components/org-rotator-pill";
import { FeedPreview } from "../_landing/feed-preview";
import { LandingNav } from "../_landing/landing-nav";
import { LandingTopCallout } from "../_landing/landing-top-callout";
import { LandingTrustStrip } from "../_landing/trust-strip";
import { PhotoFrame } from "../_landing/photo-frame";

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";

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

const steps = [
  {
    n: "01",
    title: "Join an org you already use",
    body: "Browse open organisations or redeem an invite from a brand you back. You only ever see briefs from rosters you've joined.",
  },
  {
    n: "02",
    title: "Claim a brief that fits",
    body: "Each brief lists the deliverable, the deadline, and the exact payout in DKK. Reserve the slot for seven days; no bidding, no haggling.",
  },
  {
    n: "03",
    title: "Submit, get approved, get paid",
    body: "Upload your reel, TikTok, photo, or long-form. Once the org approves, the payout transfers from escrow. We issue the self-billed invoice for you.",
  },
];

const rails = [
  {
    label: "Time to payout",
    value: "≤ 7 days",
    sub: "from approval",
  },
  {
    label: "Platform fee",
    value: "8%",
    sub: "creator side, transparent",
  },
  {
    label: "Currency",
    value: "DKK",
    sub: "whole units, no surprise øre",
  },
  {
    label: "Self-billing",
    value: "On",
    sub: "we issue the invoice for you",
  },
];

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
  const orgCountCopy =
    orgs.length === 0
      ? "Coming soon to Denmark"
      : orgs.length === 1
        ? "1 organisation live"
        : `${orgs.length} organisations live`;

  return (
    <main className="flex-1 relative overflow-hidden bg-background">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-brand/8 blur-[160px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full bg-brand/6 blur-[140px]"
      />

      <LandingTopCallout audience="creator" />
      <LandingNav audience="creator" />

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-24">
          <div className="flex flex-wrap items-center gap-3 mb-10 sm:mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-mono uppercase tracking-[0.18em] text-muted">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />
                <span className="relative size-1.5 rounded-full bg-success" />
              </span>
              {orgCountCopy}
            </span>
            {orgs.length > 0 && <OrgRotatorPill orgs={orgs} />}
          </div>

          <h1
            className="
              font-display font-extrabold tracking-tight text-foreground
              text-[clamp(2.75rem,8vw,7rem)] leading-[0.92]
              max-w-[14ch]
            "
          >
            Get paid to make content for{" "}
            <span className="italic font-normal text-text-secondary">
              brands
            </span>{" "}
            <span className="text-brand-ink">you already use.</span>
          </h1>

          <div className="mt-10 sm:mt-12 grid gap-10 sm:gap-12 sm:grid-cols-[1.3fr_1fr] sm:items-end">
            <p className="text-lg sm:text-xl leading-relaxed text-text-secondary max-w-[42ch]">
              {platformName}{" "}turns an organisation&rsquo;s own patrons
              into its paid content team. Browse open briefs from rosters
              you&rsquo;ve joined, claim what fits, and get paid in DKK with
              self-billing handled. No bidding, no follower-count theatre, no
              chasing invoices.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <Link
                href="/login?mode=signup"
                className="
                  group inline-flex h-12 items-center justify-center gap-2.5
                  rounded-full bg-brand hover:bg-brand-hover
                  px-6 text-sm font-semibold text-on-brand
                  transition-colors active:translate-y-px
                "
              >
                Create your creator account
                <span
                  className="
                    flex size-5 items-center justify-center rounded-full bg-background/15
                    transition-transform group-hover:translate-x-0.5
                  "
                  aria-hidden="true"
                >
                  <ArrowRight className="size-3" />
                </span>
              </Link>
              <Link
                href="/discover"
                className="
                  inline-flex h-12 items-center justify-center
                  rounded-full border border-border-strong/70 bg-surface/40
                  px-5 text-sm font-medium text-foreground
                  hover:bg-surface hover:border-border-strong
                  transition-colors
                "
              >
                Browse organisations
              </Link>
            </div>
          </div>

          {/* Rails strip */}
          <div className="mt-16 sm:mt-24 border-y border-border grid grid-cols-2 lg:grid-cols-4">
            {rails.map((rail, i) => (
              <div
                key={rail.label}
                className={`
                  py-6 sm:py-7 px-1
                  ${i !== rails.length - 1 ? "lg:border-r border-border" : ""}
                  ${i % 2 === 0 ? "border-r lg:border-r border-border" : ""}
                  ${i < 2 ? "border-b lg:border-b-0 border-border" : ""}
                  ${i !== 0 ? "pl-5" : "pl-1"}
                `}
              >
                <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted mb-2">
                  {rail.label}
                </p>
                <p className="value-text text-2xl sm:text-3xl font-bold text-foreground leading-none">
                  {rail.value}
                </p>
                <p className="text-xs text-muted mt-2">{rail.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST STRIP — quiet horizontal marquee of org names */}
      {orgs.length >= 2 && <LandingTrustStrip orgs={orgs} />}

      {/* INSIDE THE FEED — preview + supporting photo */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end mb-12 sm:mb-16">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
                Inside the feed
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[18ch]">
                Your daily{" "}
                <span className="italic font-normal text-text-secondary">
                  three or four
                </span>{" "}
                briefs, ready to claim.
              </h2>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
              The feed is the whole product. Every brief lists exactly what
              the org wants, how much they&rsquo;ll pay, and when they need
              it by. You claim, you make, you ship.
            </p>
          </div>

          <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center">
            <FeedPreview />

            <div className="space-y-6">
              <PhotoFrame
                src="https://images.pexels.com/photos/9908656/pexels-photo-9908656.jpeg?auto=compress&cs=tinysrgb&w=1400"
                alt="A photographer at her desk reviewing shots on a camera, daylight from a window catching the back of the lens."
                caption="Maja, Aarhus — claimed brief #047"
                aspect="4/5"
                credit="Pexels"
              />
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { v: "≤ 7d", l: "From approval" },
                  { v: "DKK", l: "Self-billed" },
                  { v: "0", l: "Bids ever" },
                ].map((cell) => (
                  <div
                    key={cell.l}
                    className="rounded-xl border border-border bg-surface/40 px-3 py-3"
                  >
                    <p className="value-text text-lg sm:text-xl font-bold text-foreground leading-none">
                      {cell.v}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-2 leading-tight">
                      {cell.l}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end mb-12 sm:mb-16">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
                How it works
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[16ch]">
                Sign in.{" "}
                <span className="italic font-normal text-text-secondary">
                  Claim a brief.
                </span>{" "}
                Get paid.
              </h2>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
              Three steps. The platform handles escrow, payout, and the legal
              side, so you can focus on the part you actually showed up for.
            </p>
          </div>

          <ol className="border-y border-border divide-y divide-border">
            {steps.map((step) => (
              <li
                key={step.n}
                className="
                  group grid gap-4 sm:gap-8 sm:grid-cols-[88px_minmax(0,18ch)_1fr]
                  py-8 sm:py-10
                  transition-colors
                "
              >
                <span className="font-mono text-xs text-brand-ink tracking-[0.18em] pt-1.5">
                  / {step.n}
                </span>
                <h3 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-[58ch]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* MONEY RAIL panel */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-br from-brand/10 via-brand/5 to-transparent p-8 sm:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 size-[320px] rounded-full bg-brand/15 blur-3xl"
            />
            <div className="relative grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
              <div>
                <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-5">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Money is precise
                </p>
                <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.96] text-foreground max-w-[14ch]">
                  Escrow on{" "}
                  <span className="text-brand-ink">publish</span>. Payout on
                  approval.
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
                  Orgs fund the brief up-front; the money sits in Stripe escrow
                  until you deliver. On approval, it transfers to your
                  connected account within seven days. You never write an
                  invoice; we issue the self-billed one for you.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
                {[
                  ["Brief budget", "Locked"],
                  ["Hidden fees", "None"],
                  ["Invoices to file", "Zero"],
                  ["Currency", "DKK"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="bg-background/80 px-5 py-6 sm:py-7"
                  >
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted mb-1.5">
                      {k}
                    </dt>
                    <dd className="value-text text-2xl sm:text-3xl font-bold text-foreground leading-none">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* TWO-AUDIENCE PILLARS */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="mb-12 sm:mb-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
              Two sides, one table
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[18ch]">
              Designed for the people on{" "}
              <span className="italic font-normal text-text-secondary">
                both
              </span>{" "}
              ends of the brief.
            </h2>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <article className="flex flex-col rounded-2xl border border-border bg-surface/60 p-8 sm:p-10 min-h-[440px]">
              <span className="self-start inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
                <span className="size-1 rounded-full bg-foreground/60" />
                For creators
              </span>
              <h3 className="mt-8 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[0.98] text-foreground">
                Sign up.
                <br />
                <span className="text-text-secondary italic font-normal">
                  Browse briefs.
                </span>
              </h3>
              <ul className="mt-8 space-y-3 text-sm text-text-secondary">
                {[
                  "Briefs from organisations you join, no cold-pitching",
                  "Fixed payouts in DKK, set by the org before the brief goes live",
                  "Self-billed invoicing handled, no spreadsheets",
                  "No bidding, no star ratings, no race to the bottom",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-brand"
                    />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-10 flex items-center justify-between gap-4 border-t border-border">
                <div>
                  <p className="value-text text-2xl font-bold text-foreground leading-none">
                    Free to join
                  </p>
                  <p className="text-xs text-muted mt-1.5">
                    8% platform fee on payouts
                  </p>
                </div>
                <Link
                  href="/login?mode=signup"
                  className="
                    inline-flex h-10 items-center gap-2 rounded-full
                    border border-border-strong bg-background/40 px-4
                    text-sm font-semibold text-foreground
                    hover:bg-surface hover:border-border-strong
                    transition-colors
                  "
                >
                  Sign up
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>

            <article className="relative flex flex-col rounded-2xl bg-brand p-8 sm:p-10 text-on-brand min-h-[440px] overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-24 -right-16 size-[260px] rounded-full bg-white/10 blur-2xl"
              />
              <span className="self-start inline-flex items-center gap-2 rounded-full border border-on-brand/25 bg-on-brand/5 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-on-brand/80">
                <span className="size-1 rounded-full bg-on-brand" />
                For organisations
              </span>
              <h3 className="mt-8 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[0.98] text-on-brand">
                Brief your fans.
                <br />
                <span className="italic font-normal text-on-brand/75">
                  Skip the agency.
                </span>
              </h3>
              <ul className="mt-8 space-y-3 text-sm text-on-brand/85">
                {[
                  "Publish paid briefs to your own roster of customers and patrons",
                  "Fund up-front in DKK; escrow releases on approval",
                  "Review, approve, or request a revision in a single click",
                  "Single platform invoice, no per-creator contractor admin",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-on-brand"
                    />
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-10 flex items-center justify-between gap-4 border-t border-on-brand/15">
                <div>
                  <p className="value-text text-2xl font-bold text-on-brand leading-none">
                    By invitation
                  </p>
                  <p className="text-xs text-on-brand/70 mt-1.5">
                    Onboarding new orgs each month
                  </p>
                </div>
                <Link
                  href="/for-brands"
                  className="
                    inline-flex h-10 items-center gap-2 rounded-full
                    bg-on-brand px-4
                    text-sm font-semibold text-brand-ink
                    hover:bg-foreground transition-colors
                  "
                >
                  See the pitch
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* CLOSING CTA + giant ghost wordmark */}
      <section className="relative border-t border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[640px] rounded-full bg-brand/8 blur-[160px]"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-12 text-center">
          <h2 className="font-display font-extrabold tracking-tight text-foreground text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.92] max-w-[14ch] mx-auto">
            Less{" "}
            <span className="italic font-normal text-text-secondary">
              chasing.
            </span>
            <br />
            More <span className="text-brand-ink">making.</span>
          </h2>
          <p className="mt-8 mx-auto max-w-[44ch] text-base sm:text-lg text-text-secondary leading-relaxed">
            Join a roster, claim a brief, get paid. Three steps and most of the
            paperwork disappears.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login?mode=signup"
              className="
                group inline-flex h-12 items-center gap-2.5
                rounded-full bg-brand hover:bg-brand-hover
                px-6 text-sm font-semibold text-on-brand
                transition-colors active:translate-y-px
              "
            >
              Create your account
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="
                inline-flex h-12 items-center rounded-full
                border border-border-strong/70 bg-surface/40
                px-5 text-sm font-medium text-foreground
                hover:bg-surface hover:border-border-strong
                transition-colors
              "
            >
              Log in
            </Link>
          </div>

          <p
            aria-hidden="true"
            className="
              mt-20 sm:mt-28 select-none
              font-display font-extrabold tracking-[-0.06em] leading-[0.85]
              text-foreground
              text-[clamp(7rem,22vw,18rem)]
            "
          >
            {platformName.toLowerCase()}
            <span className="text-brand">.</span>
          </p>
        </div>
      </section>
    </main>
  );
}
