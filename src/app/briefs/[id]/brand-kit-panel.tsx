"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { BrandColor, BrandTypography } from "@/app/admin/(org)/brand/types";

export type BrandKitPanelData = {
  logos: {
    mark: { url: string; filename: string } | null;
    dark: { url: string; filename: string } | null;
    light: { url: string; filename: string } | null;
  };
  colors: BrandColor[];
  typography: BrandTypography[];
  guidelines: { url: string; isExternal: boolean } | null;
  notes: string | null;
};

const LOGO_DISPLAY: Array<{
  slot: keyof BrandKitPanelData["logos"];
  label: string;
  previewBg: string;
  textColor: string;
}> = [
  { slot: "mark", label: "Logo mark", previewBg: "bg-background", textColor: "text-muted" },
  { slot: "dark", label: "On dark", previewBg: "bg-[#0a0a0a]", textColor: "text-white/60" },
  { slot: "light", label: "On light", previewBg: "bg-white", textColor: "text-black/60" },
];

const ROLE_LABEL: Record<BrandTypography["role"], string> = {
  heading: "Heading",
  body: "Body",
  mono: "Mono",
  accent: "Accent",
};

interface Props {
  brandKit: BrandKitPanelData;
}

/**
 * Brand kit panel rendered on the brief detail page when the viewing
 * creator has an active claim. Server-side gate decides whether to
 * fetch + sign URLs in the first place, so by the time we get here we
 * just render. Empty kit shows a single helper line instead of a wall
 * of empty sections.
 */
export function BrandKitPanel({ brandKit }: Props) {
  const hasLogo =
    brandKit.logos.mark || brandKit.logos.dark || brandKit.logos.light;
  const hasColors = brandKit.colors.length > 0;
  const hasTypography = brandKit.typography.length > 0;
  const hasGuidelines = Boolean(brandKit.guidelines);
  const hasNotes = Boolean(brandKit.notes && brandKit.notes.trim());

  const isEmpty =
    !hasLogo && !hasColors && !hasTypography && !hasGuidelines && !hasNotes;

  return (
    <section>
      <h2 className="text-xs font-semibold text-muted uppercase tracking-[0.12em] mb-3">
        Brand kit
      </h2>
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        {isEmpty ? (
          <div className="px-5 py-6 text-sm text-muted">
            Brand kit not set up yet. The org will add logos, colors,
            and guidelines here.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {hasLogo && <LogosBlock logos={brandKit.logos} />}
            {hasColors && <ColorsBlock colors={brandKit.colors} />}
            {hasTypography && (
              <TypographyBlock typography={brandKit.typography} />
            )}
            {hasGuidelines && brandKit.guidelines && (
              <GuidelinesBlock guidelines={brandKit.guidelines} />
            )}
            {hasNotes && brandKit.notes && (
              <NotesBlock notes={brandKit.notes} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function BlockHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] font-semibold text-muted uppercase tracking-[0.18em] mb-3">
      {label}
    </h3>
  );
}

function LogosBlock({ logos }: { logos: BrandKitPanelData["logos"] }) {
  const present = LOGO_DISPLAY.filter((entry) => logos[entry.slot]);

  return (
    <div className="px-5 py-4">
      <BlockHeader label="Logos" />
      <div className="grid sm:grid-cols-3 gap-3">
        {present.map((entry) => {
          const logo = logos[entry.slot];
          if (!logo) return null;
          return (
            <div
              key={entry.slot}
              className="rounded-md border border-border overflow-hidden"
            >
              <div
                className={`flex items-center justify-center aspect-[4/3] ${entry.previewBg}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.url}
                  alt={entry.label}
                  className="max-h-[80%] max-w-[80%] object-contain"
                />
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-surface-raised">
                <span className="text-xs text-muted">{entry.label}</span>
                <a
                  href={logo.url}
                  download={logo.filename}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                >
                  Download
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ColorsBlock({ colors }: { colors: BrandColor[] }) {
  return (
    <div className="px-5 py-4">
      <BlockHeader label="Colors" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {colors.map((color, index) => (
          <ColorSwatch key={index} color={color} />
        ))}
      </div>
    </div>
  );
}

function ColorSwatch({ color }: { color: BrandColor }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(color.hex);
      setCopied(true);
      toast.success(`Copied ${color.hex}`);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy hex");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex items-center gap-2 rounded-md border border-border bg-surface-raised p-2 text-left hover:border-accent/40 transition-colors"
    >
      <span
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded border border-border"
        style={{ backgroundColor: color.hex }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium truncate">{color.name}</span>
        <span className="block text-[11px] font-mono text-muted truncate">
          {copied ? "Copied" : color.hex}
        </span>
      </span>
    </button>
  );
}

function TypographyBlock({ typography }: { typography: BrandTypography[] }) {
  return (
    <div className="px-5 py-4">
      <BlockHeader label="Typography" />
      <ul className="space-y-2">
        {typography.map((row, index) => (
          <li
            key={index}
            className="flex items-baseline gap-3 text-sm"
          >
            <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-muted font-semibold">
              {ROLE_LABEL[row.role]}
            </span>
            <span className="flex-1 truncate">{row.family}</span>
            {row.url && (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-accent hover:text-accent-hover transition-colors shrink-0"
              >
                View font
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuidelinesBlock({
  guidelines,
}: {
  guidelines: NonNullable<BrandKitPanelData["guidelines"]>;
}) {
  return (
    <div className="px-5 py-4">
      <BlockHeader label="Brand guidelines" />
      <a
        href={guidelines.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-background text-sm font-semibold rounded-lg hover:bg-accent-hover transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={
              guidelines.isExternal
                ? "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                : "M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            }
          />
        </svg>
        {guidelines.isExternal ? "Open guidelines" : "Download guidelines PDF"}
      </a>
    </div>
  );
}

function NotesBlock({ notes }: { notes: string }) {
  return (
    <div className="px-5 py-4">
      <BlockHeader label="Voice & tone" />
      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
        {notes}
      </p>
    </div>
  );
}
