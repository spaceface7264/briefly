import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccountType, landingPathForAccountType } from "@/lib/account";
import type { OrgRotatorOrg } from "@/components/org-rotator-pill";
import { AdminPreview } from "../_landing/admin-preview";
import { LandingNav } from "../_landing/landing-nav";
import { LandingTopCallout } from "../_landing/landing-top-callout";
import { LandingTrustStrip } from "../_landing/trust-strip";
import { PhotoFrame } from "../_landing/photo-frame";

const platformName = process.env.NEXT_PUBLIC_PLATFORM_NAME || "Briefly";
const contactMailto =
  "mailto:hello@briefly.dk?subject=Run%20paid%20briefs%20on%20Briefly";

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
    title: "Onboard your roster",
    body: "We help you import your existing fans, customers, and email list, then send them an invite. Most rosters are ready inside a week.",
  },
  {
    n: "02",
    title: "Publish a brief, fund the slot",
    body: "Title, deliverable, deadline, payout in DKK. The full budget moves into Stripe escrow the moment the brief goes live, so creators see real money, not a maybe.",
  },
  {
    n: "03",
    title: "Approve, release, repeat",
    body: "Your roster claims slots, submits work, and waits on your call. One click approves, releases the payout, and files the self-billed invoice. No spreadsheets cross your desk.",
  },
];

const rails = [
  {
    label: "Budget at risk",
    value: "Zero",
    sub: "escrow, not goodwill",
  },
  {
    label: "Per-creator admin",
    value: "None",
    sub: "single platform invoice",
  },
  {
    label: "Time to first brief",
    value: "≤ 7 days",
    sub: "from sign-on",
  },
  {
    label: "Currency",
    value: "DKK",
    sub: "VAT and self-billing handled",
  },
];

export default async function ForBrands() {
  // Logged-in users go to their shell. The brand pitch is logged-out only.
  let accountType: Awaited<ReturnType<typeof getAccountType>> | null = null;
  try {
    const supabase = await createClient();
    accountType = await getAccountType(supabase);
  } catch {
    // Supabase unavailable, fall through to marketing.
  }
  if (accountType) {
    redirect(landingPathForAccountType(accountType));
  }

  const orgs = await loadDiscoverableOrgs();

  return (
    <main className="flex-1 relative overflow-hidden bg-background">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-brand/8 blur-[160px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 -left-32 w-[420px] h-[420px] rounded-full bg-brand/6 blur-[140px]"
      />

      <LandingTopCallout audience="brand" />
      <LandingNav audience="brand" />

      {/* HERO */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-32 pb-16 sm:pb-24">
          <div className="flex flex-wrap items-center gap-3 mb-10 sm:mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-mono uppercase tracking-[0.18em] text-muted">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />
                <span className="relative size-1.5 rounded-full bg-success" />
              </span>
              Onboarding new brands
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/40 px-3 py-1 text-xs font-mono uppercase tracking-[0.18em] text-muted">
              <ShieldCheck className="size-3 text-brand-ink" />
              Stripe Connect, escrow-backed
            </span>
          </div>

          <h1
            className="
              font-display font-extrabold tracking-tight text-foreground
              text-[clamp(2.75rem,8vw,7rem)] leading-[0.92]
              max-w-[15ch]
            "
          >
            The creators you need are{" "}
            <span className="italic font-normal text-text-secondary">
              already
            </span>{" "}
            <span className="text-brand-ink">your customers.</span>
          </h1>

          <div className="mt-10 sm:mt-12 grid gap-10 sm:gap-12 sm:grid-cols-[1.3fr_1fr] sm:items-end">
            <p className="text-lg sm:text-xl leading-relaxed text-text-secondary max-w-[44ch]">
              The people most likely to make great content for your brand
              already use it. {platformName}{" "}turns your patrons into a paid
              roster you can brief: you write the spec, fund it in DKK, and
              they claim the work. The legal and money rails are ours; the
              creative call is yours.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
              <a
                href={contactMailto}
                className="
                  group inline-flex h-12 items-center justify-center gap-2.5
                  rounded-full bg-brand hover:bg-brand-hover
                  px-6 text-sm font-semibold text-on-brand
                  transition-colors active:translate-y-px
                "
              >
                Talk to us
                <span
                  className="
                    flex size-5 items-center justify-center rounded-full bg-background/15
                    transition-transform group-hover:translate-x-0.5
                  "
                  aria-hidden="true"
                >
                  <ArrowRight className="size-3" />
                </span>
              </a>
              <Link
                href="/"
                className="
                  inline-flex h-12 items-center justify-center
                  rounded-full border border-border-strong/70 bg-surface/40
                  px-5 text-sm font-medium text-foreground
                  hover:bg-surface hover:border-border-strong
                  transition-colors
                "
              >
                See the creator side
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

      {/* TRUST STRIP */}
      {orgs.length >= 2 && (
        <LandingTrustStrip orgs={orgs} leadLabel="running-briefs" />
      )}

      {/* INSIDE THE ADMIN — preview + supporting photo */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end mb-12 sm:mb-16">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
                Inside the admin
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[18ch]">
                Every brief, every payout,{" "}
                <span className="italic font-normal text-text-secondary">
                  one screen.
                </span>
              </h2>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
              The admin is built around the daily decisions: publish a brief,
              approve a submission, refund an unfilled slot. No spreadsheets,
              no contractor portal, no third tool to learn. Your finance team
              gets one invoice a month.
            </p>
          </div>

          <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] items-center">
            <AdminPreview />

            <div className="space-y-6">
              <PhotoFrame
                src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1400&q=80"
                alt="A small Danish café interior, warm light, a barista behind the counter, the kind of brand whose customers already post about it."
                caption="Vesterbro Cycles, Copenhagen — onboarded May 2026"
                aspect="4/5"
                credit="Unsplash"
              />
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[
                  { v: "1", l: "Monthly invoice" },
                  { v: "0", l: "Contractors filed" },
                  { v: "DKK", l: "Whole units" },
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

      {/* THE PITCH — three concrete reasons */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end mb-12 sm:mb-16">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
                Why patrons, not agencies
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[18ch]">
                The taggers in your DMs already get{" "}
                <span className="italic font-normal text-text-secondary">
                  the brand.
                </span>
              </h2>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
              Agencies cost more, take longer, and don&rsquo;t use the product.
              Influencer rosters optimise for reach you don&rsquo;t need. The
              middle option, paying the people who already post for free,
              didn&rsquo;t exist as a workflow. So we built it.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border">
            {[
              {
                kicker: "Patron-affinity",
                title: "Tone, language, references, all on by default.",
                body: "Customers know the product, the customer base, and the in-jokes. Briefs feel native, not commissioned.",
              },
              {
                kicker: "Right-sized cost",
                title: "Per-brief, set by you, in DKK.",
                body: "No retainer. No agency markup. No surprise scope. You decide the budget per brief, the platform fee is a transparent line, payouts are exact.",
              },
              {
                kicker: "No contractor admin",
                title: "One platform invoice, ever.",
                body: "Briefly issues self-billed invoices to each creator on your behalf. You receive a single monthly statement. Your finance team sleeps.",
              },
            ].map((row) => (
              <div
                key={row.kicker}
                className="bg-background/80 px-6 sm:px-10 py-8 sm:py-10 grid gap-4 sm:gap-10 sm:grid-cols-[14ch_minmax(0,22ch)_1fr] sm:items-start"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-ink pt-1.5">
                  {row.kicker}
                </p>
                <h3 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-tight">
                  {row.title}
                </h3>
                <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-[60ch]">
                  {row.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="grid gap-10 sm:grid-cols-[0.9fr_1fr] sm:items-end mb-12 sm:mb-16">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
                How it works
              </p>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[16ch]">
                Onboard.{" "}
                <span className="italic font-normal text-text-secondary">
                  Publish.
                </span>{" "}
                Approve.
              </h2>
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
              Three steps from a Stripe handshake to a delivered reel. Most
              brands run their first brief inside the first week.
            </p>
          </div>

          <ol className="border-y border-border divide-y divide-border">
            {steps.map((step) => (
              <li
                key={step.n}
                className="
                  grid gap-4 sm:gap-8 sm:grid-cols-[88px_minmax(0,18ch)_1fr]
                  py-8 sm:py-10
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

      {/* MONEY RAIL — protect the org */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="relative overflow-hidden rounded-3xl border border-brand/25 bg-gradient-to-bl from-brand/10 via-brand/5 to-transparent p-8 sm:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -left-24 size-[320px] rounded-full bg-brand/15 blur-3xl"
            />
            <div className="relative grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
                {[
                  ["Budget", "Locked at publish"],
                  ["Per-creator invoices", "Zero"],
                  ["Refunds on unfilled slots", "Automated"],
                  ["VAT and self-billing", "Handled"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="bg-background/80 px-5 py-6 sm:py-7"
                  >
                    <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted mb-1.5">
                      {k}
                    </dt>
                    <dd className="value-text text-xl sm:text-2xl font-bold text-foreground leading-tight">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-5">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  Money is precise
                </p>
                <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.96] text-foreground max-w-[14ch]">
                  Budget in,{" "}
                  <span className="text-brand-ink">work out.</span>
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-text-secondary max-w-[44ch]">
                  Your budget sits in Stripe escrow the moment a brief goes
                  live. Slots that get claimed and approved release; slots
                  that don&rsquo;t refund automatically. You see every DKK in
                  motion, before, during, and after.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TWO-AUDIENCE PILLARS — flipped: brand drenched, creator quiet */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20 sm:pb-28">
          <div className="mb-12 sm:mb-16">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-brand-ink mb-4">
              Same table, two seats
            </p>
            <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[0.95] text-foreground max-w-[18ch]">
              Built so the{" "}
              <span className="italic font-normal text-text-secondary">
                brand
              </span>{" "}
              wins, not the platform.
            </h2>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <article className="relative flex flex-col rounded-2xl bg-brand p-8 sm:p-10 text-on-brand min-h-[460px] overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-24 -right-16 size-[260px] rounded-full bg-white/10 blur-2xl"
              />
              <span className="self-start inline-flex items-center gap-2 rounded-full border border-on-brand/25 bg-on-brand/5 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-on-brand/80">
                <span className="size-1 rounded-full bg-on-brand" />
                For your team
              </span>
              <h3 className="mt-8 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[0.98] text-on-brand">
                Brief once.
                <br />
                <span className="italic font-normal text-on-brand/75">
                  Pay once.
                </span>
              </h3>
              <ul className="mt-8 space-y-3 text-sm text-on-brand/85">
                {[
                  "Publish briefs to your own roster of customers, fans, and patrons",
                  "Fund up-front in DKK; escrow releases on approval only",
                  "Approve, request a revision, or archive in one click",
                  "Single monthly platform invoice, never per-creator admin",
                  "Track every claim, submission, and payout in one place",
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
                    Onboarding new brands each month
                  </p>
                </div>
                <a
                  href={contactMailto}
                  className="
                    inline-flex h-10 items-center gap-2 rounded-full
                    bg-on-brand px-4
                    text-sm font-semibold text-brand-ink
                    hover:bg-foreground transition-colors
                  "
                >
                  Talk to us
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </article>

            <article className="flex flex-col rounded-2xl border border-border bg-surface/60 p-8 sm:p-10 min-h-[460px]">
              <span className="self-start inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted">
                <span className="size-1 rounded-full bg-foreground/60" />
                For your roster
              </span>
              <h3 className="mt-8 font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[0.98] text-foreground">
                Real briefs.
                <br />
                <span className="text-text-secondary italic font-normal">
                  Real DKK.
                </span>
              </h3>
              <ul className="mt-8 space-y-3 text-sm text-text-secondary">
                {[
                  "Your patrons see a feed of paid briefs from brands they already follow",
                  "Fixed payouts set by you, no bidding, no race to the bottom",
                  "Seven-day claim window and a clear deadline on every slot",
                  "Self-billed invoices issued for them, so neither side files paper",
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
                    8% platform fee on payouts, transparent
                  </p>
                </div>
                <Link
                  href="/"
                  className="
                    inline-flex h-10 items-center gap-2 rounded-full
                    border border-border-strong bg-background/40 px-4
                    text-sm font-semibold text-foreground
                    hover:bg-surface hover:border-border-strong
                    transition-colors
                  "
                >
                  See the creator pitch
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* CLOSING CTA */}
      <section className="relative border-t border-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[640px] rounded-full bg-brand/8 blur-[160px]"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-12 text-center">
          <h2 className="font-display font-extrabold tracking-tight text-foreground text-[clamp(2.75rem,9vw,7.5rem)] leading-[0.92] max-w-[16ch] mx-auto">
            Skip the{" "}
            <span className="italic font-normal text-text-secondary">
              agency.
            </span>
            <br />
            Brief your <span className="text-brand-ink">fans.</span>
          </h2>
          <p className="mt-8 mx-auto max-w-[46ch] text-base sm:text-lg text-text-secondary leading-relaxed">
            Ten minutes on a call, one brief in the queue, and you&rsquo;ll
            know whether {platformName} fits the way you already work. We
            don&rsquo;t do retainers, decks, or trial mode.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href={contactMailto}
              className="
                group inline-flex h-12 items-center gap-2.5
                rounded-full bg-brand hover:bg-brand-hover
                px-6 text-sm font-semibold text-on-brand
                transition-colors active:translate-y-px
              "
            >
              Talk to us
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/"
              className="
                inline-flex h-12 items-center rounded-full
                border border-border-strong/70 bg-surface/40
                px-5 text-sm font-medium text-foreground
                hover:bg-surface hover:border-border-strong
                transition-colors
              "
            >
              See the creator side
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
