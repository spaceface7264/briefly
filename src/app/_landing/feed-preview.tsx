import { ArrowRight } from "lucide-react";

/**
 * Marketing-only phone frame showing what the creator feed looks like
 * once a creator joins a roster. Mock data, deliberately decoupled from
 * the database types so the preview never breaks when the schema shifts.
 *
 * Visual language follows src/components/brief-card.tsx: category dot,
 * meta strip, price pill, deadline footer.
 */

interface SampleBrief {
  org: string;
  category: "Ad" | "Guide" | "Event" | "Community";
  duration: string;
  title: string;
  description: string;
  priceDkk: number;
  deadline: string;
  status: "Open" | "Claimed";
}

const sampleFeed: SampleBrief[] = [
  {
    org: "Nordbak Bakery",
    category: "Ad",
    duration: "Reel · 15–30s",
    title: "Sourdough launch — three vertical cuts",
    description:
      "Native audio, no voiceover. Shot in our Aarhus bakery; we provide the loaves and the morning light.",
    priceDkk: 1800,
    deadline: "Jun 04",
    status: "Open",
  },
  {
    org: "Frellsen Coffee",
    category: "Guide",
    duration: "Photo · 6 hero shots",
    title: "Single-origin Ethiopia, in your kitchen",
    description:
      "Six photos that show the bag, the pour, and a steady cup. Daylight only. Beans posted to you.",
    priceDkk: 1200,
    deadline: "May 27",
    status: "Claimed",
  },
  {
    org: "Bryggen Climbing",
    category: "Event",
    duration: "Reel · 30–60s",
    title: "Opening night at the new wall",
    description:
      "One evening of climbing, mood-led edit. Drinks and chalk on the house, climbers credited in caption.",
    priceDkk: 2400,
    deadline: "Jun 11",
    status: "Open",
  },
];

const categoryDot: Record<SampleBrief["category"], string> = {
  Ad: "bg-warning-ink",
  Guide: "bg-info-ink",
  Event: "bg-success-ink",
  Community: "bg-muted",
};

function formatDkk(n: number): string {
  return new Intl.NumberFormat("da-DK").format(n);
}

interface FeedPreviewProps {
  /**
   * "default" renders the full 3-card phone frame at hero scale.
   * "compact" renders a tighter 2-card variant for use as a secondary
   * preview inside a side column.
   */
  variant?: "default" | "compact";
}

export function FeedPreview({ variant = "default" }: FeedPreviewProps) {
  const items = variant === "compact" ? sampleFeed.slice(0, 2) : sampleFeed;
  const maxWidth = variant === "compact" ? "max-w-[260px]" : "max-w-[360px]";

  return (
    <div className={`relative mx-auto w-full ${maxWidth}`}>
      {/* subtle ground shadow */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 bottom-0 h-24 rounded-[50%] bg-brand/15 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="
          relative rounded-[2.75rem] border border-border-strong/80
          bg-surface/80 backdrop-blur
          p-3
          shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55),0_2px_0_0_rgba(255,255,255,0.04)_inset]
        "
      >
        {/* device "screen" */}
        <div className="relative overflow-hidden rounded-[2.15rem] border border-border bg-background">
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pt-4 pb-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted">
            <span>09:41</span>
            <span className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-muted" />
              <span className="size-1 rounded-full bg-muted" />
              <span className="size-1 rounded-full bg-muted" />
            </span>
          </div>

          {/* app header */}
          <div className="px-5 pt-3 pb-5 border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted mb-1.5">
              Today
            </p>
            <h4 className="font-display text-xl font-bold tracking-tight text-foreground leading-tight">
              3 briefs for you
            </h4>
          </div>

          {/* feed */}
          <ul className="px-3.5 py-4 space-y-2.5">
            {items.map((brief) => (
              <li
                key={brief.title}
                className={`
                  group/card rounded-xl border bg-surface/70 px-3.5 py-3
                  transition-colors
                  ${
                    brief.status === "Claimed"
                      ? "border-brand-ink/30 bg-brand-soft"
                      : "border-border hover:border-border-strong"
                  }
                `}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
                  <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                    <span
                      aria-hidden="true"
                      className={`size-1.5 rounded-full shrink-0 ${categoryDot[brief.category]}`}
                    />
                    <span className="truncate font-medium text-foreground/80">
                      {brief.org}
                    </span>
                    <span className="text-border select-none">/</span>
                    <span className="truncate">{brief.duration}</span>
                  </span>
                  <span className="value-text shrink-0 inline-flex items-center rounded-full border border-brand-ink/30 bg-brand/10 px-1.5 py-px text-[10.5px] font-semibold text-brand-ink whitespace-nowrap">
                    {formatDkk(brief.priceDkk)} kr
                  </span>
                </div>

                <h5 className="mt-1.5 font-display text-[13px] font-semibold tracking-tight text-foreground leading-snug">
                  {brief.title}
                </h5>
                <p className="mt-1 text-[11.5px] text-text-secondary leading-snug line-clamp-2">
                  {brief.description}
                </p>

                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10.5px]">
                  <span className="value-text font-mono text-muted">
                    Due {brief.deadline}
                  </span>
                  {brief.status === "Claimed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-ink/30 bg-brand/15 px-1.5 py-px font-mono uppercase tracking-[0.08em] text-[9px] text-brand-ink">
                      <span className="size-1 rounded-full bg-brand-ink" />
                      Claimed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted">
                      Claim
                      <ArrowRight className="size-2.5" />
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* fade-to-bg at the bottom so the list reads as continuing */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
          />
        </div>
      </div>
    </div>
  );
}
