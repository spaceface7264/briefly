"use client";

import { useMemo } from "react";
import type { OrgRotatorOrg } from "@/components/org-rotator-pill";

interface LandingTrustStripProps {
  orgs: OrgRotatorOrg[];
  /**
   * Lead label on the left of the strip. Defaults to the creator-facing
   * framing ("live rosters"); brand-facing pages override it.
   */
  leadLabel?: "live-rosters" | "running-briefs";
}

/**
 * Logged-out home: thin marquee of organisation names that creators
 * can already join. Quietly proves the platform is not empty without
 * leaning on metric template clichés. Pauses on hover so a visitor
 * can read.
 *
 * If we have fewer than 2 orgs, the parent renders nothing.
 */
export function LandingTrustStrip({
  orgs,
  leadLabel = "live-rosters",
}: LandingTrustStripProps) {
  // Need enough entries that the loop reads as a stream, not a list.
  // Repeat the list a few times so the marquee animation doesn't show
  // a visible reset gap on small rosters.
  const loop = useMemo(() => {
    const target = Math.max(orgs.length * 2, 12);
    const out: OrgRotatorOrg[] = [];
    while (out.length < target) out.push(...orgs);
    return out;
  }, [orgs]);

  const orgCount = orgs.length;

  return (
    <section
      aria-label="Organisations currently running paid briefs"
      className="relative border-y border-border bg-surface/30"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-10 py-6">
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            <span className="text-brand-ink">{orgCount}</span>{" "}
            {leadLabel === "running-briefs"
              ? "brands running briefs"
              : "live rosters"}
          </p>

          <div className="relative flex-1 min-w-0 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
            <div className="flex w-max animate-trust-marquee gap-3 hover:[animation-play-state:paused]">
              {loop.map((org, idx) => {
                const accent = org.accentColor || "var(--color-brand)";
                const letter = org.name.charAt(0).toUpperCase();
                return (
                  <span
                    key={`${org.id}-${idx}`}
                    className="
                      inline-flex items-center gap-2.5
                      rounded-full border border-border bg-background/60
                      px-3.5 py-1.5
                      whitespace-nowrap
                    "
                  >
                    {org.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={org.logoUrl}
                        alt=""
                        className="size-4 rounded-full border border-border bg-background object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="
                          flex size-4 items-center justify-center rounded-full
                          text-[9px] font-bold text-on-brand
                        "
                        style={{ backgroundColor: accent }}
                      >
                        {letter}
                      </span>
                    )}
                    <span className="text-xs font-medium text-foreground tracking-tight">
                      {org.name}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
