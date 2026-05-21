import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface LandingTopCalloutProps {
  /**
   * Which audience the current page primarily addresses. The callout
   * always points the visitor to the OTHER page, so we read the prop
   * the same way as the nav does.
   */
  audience: "creator" | "brand";
}

/**
 * Slim banner that sits above the sticky nav on each marketing page and
 * sends visitors to the opposite-audience landing. Non-sticky on
 * purpose: it scrolls away once the visitor commits to the page.
 */
export function LandingTopCallout({ audience }: LandingTopCalloutProps) {
  const target =
    audience === "creator"
      ? {
          href: "/for-brands",
          eyebrow: "On the brand side?",
          cta: "See the org pitch",
        }
      : {
          href: "/",
          eyebrow: "Making content yourself?",
          cta: "See the creator pitch",
        };

  return (
    <div className="relative border-b border-border bg-surface/50">
      <Link
        href={target.href}
        className="
          group flex items-center justify-center gap-2 sm:gap-3
          px-4 py-2.5 text-center
          transition-colors hover:bg-surface
        "
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted">
          {target.eyebrow}
        </span>
        <span
          aria-hidden="true"
          className="hidden sm:inline-block size-1 rounded-full bg-border-strong"
        />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-ink">
          {target.cta}
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}
