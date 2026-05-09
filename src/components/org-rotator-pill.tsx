"use client";

import { useEffect, useState } from "react";

export interface OrgRotatorOrg {
  id: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
}

interface OrgRotatorPillProps {
  orgs: OrgRotatorOrg[];
  /** Time the expanded pill stays visible before contracting, in ms. */
  holdMs?: number;
  /** Duration of the contract/expand transition, in ms. */
  transitionMs?: number;
}

export function OrgRotatorPill({
  orgs,
  holdMs = 2600,
  transitionMs = 500,
}: OrgRotatorPillProps) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (orgs.length <= 1) return;

    let collapseTimer: ReturnType<typeof setTimeout> | undefined;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    let nextTimer: ReturnType<typeof setTimeout> | undefined;

    const cycle = () => {
      setExpanded(false);
      collapseTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % orgs.length);
        // Allow the new content to mount, then expand.
        swapTimer = setTimeout(() => {
          setExpanded(true);
          nextTimer = setTimeout(cycle, holdMs);
        }, 40);
      }, transitionMs);
    };

    nextTimer = setTimeout(cycle, holdMs);

    return () => {
      if (collapseTimer) clearTimeout(collapseTimer);
      if (swapTimer) clearTimeout(swapTimer);
      if (nextTimer) clearTimeout(nextTimer);
    };
  }, [orgs.length, holdMs, transitionMs]);

  if (orgs.length === 0) return null;

  const current = orgs[index];
  const fallbackLetter = current.name.charAt(0).toUpperCase();
  const accent = current.accentColor || "var(--color-accent)";

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface/40 px-3.5 py-1.5 backdrop-blur-sm shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]"
      style={{ transitionDuration: `${transitionMs}ms` }}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink shrink-0">
        Join
      </span>

      <div
        className="overflow-hidden ease-out"
        style={{
          maxWidth: expanded ? "320px" : "0px",
          opacity: expanded ? 1 : 0,
          transitionProperty: "max-width, opacity",
          transitionDuration: `${transitionMs}ms`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2 pr-0.5">
          {current.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.logoUrl}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover border border-border bg-background"
            />
          ) : (
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-on-brand"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            >
              {fallbackLetter}
            </span>
          )}
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground whitespace-nowrap">
            {current.name}
          </span>
        </div>
      </div>
    </div>
  );
}
