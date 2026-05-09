"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";

type Theme = "dark" | "light";
type ToastTone = "default" | "success" | "error";
type SbToast = { id: number; tone: ToastTone; msg: string; leaving: boolean };

export default function SandboxPage() {
  // Sandbox shares theme state with the rest of the app via next-themes.
  // Toggling here flips the global data-theme; nav dropdowns stay in sync.
  const { resolvedTheme, setTheme: setNextTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Hydration gate for next-themes — see ThemeMenuItems for context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const theme: Theme =
    mounted && (resolvedTheme === "light" || resolvedTheme === "dark")
      ? resolvedTheme
      : "dark";

  const [toasts, setToasts] = useState<SbToast[]>([]);
  const idRef = useRef(0);

  const toggleTheme = (next: Theme) => {
    if (next === theme) return;
    if (
      typeof document !== "undefined" &&
      typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === "function"
    ) {
      (document as Document & {
        startViewTransition: (cb: () => void) => void;
      }).startViewTransition(() => {
        flushSync(() => setNextTheme(next));
      });
    } else {
      setNextTheme(next);
    }
  };

  const fire = (tone: ToastTone, msg: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, tone, msg, leaving: false }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    }, 3000);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3260);
  };

  return (
    <div
      data-sb
      data-theme={theme}
      className="min-h-screen w-full"
      style={{
        background: "var(--bg)",
        color: "var(--paper)",
        viewTransitionName: "sb-root",
      }}
    >
      <Toolbar theme={theme} onChange={toggleTheme} />

      <main className="mx-auto max-w-[1200px] px-6 sm:px-10 py-12 sm:py-16 space-y-20">
        <Hero />
        <NavSection />
        <Typography />
        <MonoComparison />
        <SpecStrip />
        <StatusBadges />
        <ListSection />
        <TabsSection />
        <BriefSample />
        <ClaimedBriefSection fire={fire} />
        <Pillars />
        <FormSection />
        <ModalsSection fire={fire} />
        <ToastSection fire={fire} />
        <SpinnerSection fire={fire} />
        <EmptyStateSection />
        <SkeletonSection />
        <ButtonsRow />
        <Swatches />
      </main>

      <ToastStack toasts={toasts} />
    </div>
  );
}

/* ────────────── Toolbar ────────────── */

function Toolbar({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <div
      className="sticky top-0 z-40 backdrop-blur-md"
      style={{
        background: "color-mix(in oklab, var(--bg) 80%, transparent)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 sm:px-10 h-14 flex items-center justify-between">
        <div
          className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "var(--paper-3)" }}
        >
          <span
            className="sb-live-dot w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--punch)" }}
          />
          Sandbox · token playground
        </div>

        <div
          className="sb-toggle relative inline-flex items-center text-[12px] font-medium"
          data-active={theme}
          style={{
            border: "1px solid var(--line)",
            borderRadius: "var(--r-md)",
            padding: "2px",
          }}
        >
          <span
            className="sb-toggle-thumb absolute"
            style={{
              top: "2px",
              bottom: "2px",
              left: "2px",
              width: "calc(50% - 2px)",
              background: "var(--paper)",
              borderRadius: "calc(var(--r-md) - 2px)",
            }}
            aria-hidden
          />
          {(["dark", "light"] as Theme[]).map((t) => {
            const active = theme === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange(t)}
                className="sb-toggle-btn relative z-10 px-3 py-1 capitalize"
                style={{
                  color: active ? "var(--bg)" : "var(--paper-2)",
                  width: "64px",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ────────────── Hero ────────────── */

function Hero() {
  return (
    <section>
      <div
        className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.12em] mb-8 sb-rise sb-rise-1"
        style={{ color: "var(--paper-3)" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="sb-live-dot w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--live)" }}
          />
          5 briefs live today
        </span>
        <span
          className="px-2.5 py-1"
          style={{ border: "1px solid var(--line)", borderRadius: "999px", color: "var(--paper-2)" }}
        >
          For working creators
        </span>
        <span
          className="px-2.5 py-1"
          style={{ border: "1px solid var(--line)", borderRadius: "999px", color: "var(--paper-2)" }}
        >
          DK · SE · NO
        </span>
      </div>

      <h1
        className="sb-display font-extrabold leading-[0.92] tracking-[-0.04em] sb-rise sb-rise-2"
        style={{ fontSize: "clamp(48px, 8vw, 116px)" }}
      >
        Five briefs.
        <br />
        Every <span className="sb-serif italic font-normal" style={{ color: "var(--paper-2)" }}>weekday.</span>
        <br />
        <span style={{ color: "var(--punch)" }}>Pick your work.</span>
      </h1>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-10 items-end sb-rise sb-rise-3">
        <p className="text-[18px] leading-[1.5] max-w-[42ch]" style={{ color: "var(--paper-2)" }}>
          A curated marketplace for vetted creators. New briefs publish daily at 09:00, paid in seven days, no bidding, no haggling, no chasing invoices.
        </p>
        <div className="flex gap-2 sm:justify-self-end">
          <Button variant="ghost">See today&apos;s briefs</Button>
          <Button variant="punch" trailingArrow>Apply to join</Button>
        </div>
      </div>
    </section>
  );
}

/* ────────────── Navigation ────────────── */

function NavSection() {
  return (
    <section>
      <SectionLabel>Navigation</SectionLabel>
      <p
        className="mt-2 mb-6 max-w-[60ch] text-[14px] leading-[1.55]"
        style={{ color: "var(--paper-2)" }}
      >
        Two surfaces, two patterns. Public uses a pill marketing nav for breathing room and CTA prominence. The logged-in creator surface uses a tighter functional bar with bg-pill active state, a live-feed pulse, notifications, and avatar.
      </p>

      <NavBlock label="Public · logged out" path="/">
        <PublicNav />
      </NavBlock>

      <NavBlock label="Creator · logged in" path="/creator">
        <CreatorNav />
      </NavBlock>
    </section>
  );
}

function NavBlock({
  label,
  path,
  children,
}: {
  label: string;
  path: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <div
        className="flex items-center gap-2 mb-3 font-mono text-[11px] uppercase tracking-[0.1em]"
        style={{ color: "var(--paper-3)" }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ color: "var(--paper-2)" }}>{path}</span>
      </div>
      <div
        className="p-5 sm:p-6"
        style={{
          background: "color-mix(in oklab, var(--bg-2) 50%, transparent)",
          border: "1px dashed var(--line)",
          borderRadius: "var(--r-lg)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const fontSize = size === "sm" ? 18 : 22;
  const dot = size === "sm" ? 5 : 6;
  return (
    <a
      href="#"
      className="sb-display inline-flex items-center gap-1.5 shrink-0"
      style={{
        fontSize,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: "var(--paper)",
        textDecoration: "none",
      }}
    >
      briefly
      <span
        className="rounded-full mt-1"
        style={{
          width: dot,
          height: dot,
          background: "var(--punch)",
        }}
        aria-hidden
      />
    </a>
  );
}

function PublicNav() {
  const links = [
    { label: "How it works", active: false },
    { label: "Briefs", active: true },
    { label: "For brands", active: false },
    { label: "Pricing", active: false },
  ];
  return (
    <nav
      className="grid items-center gap-4 sm:gap-8"
      style={{
        gridTemplateColumns: "auto 1fr auto",
        background: "color-mix(in oklab, var(--bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--line)",
        borderRadius: "999px",
        padding: "8px 10px 8px 22px",
      }}
    >
      <Wordmark />

      <ul className="hidden md:flex items-center justify-center gap-7 text-[13.5px] font-medium">
        {links.map((l) => (
          <li key={l.label}>
            <a href="#" className="sb-nav-link" data-active={l.active}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-1.5 sm:gap-2 justify-self-end">
        <Button variant="ghost">Log in</Button>
        <Button variant="punch" trailingArrow>
          Apply
        </Button>
      </div>
    </nav>
  );
}

function CreatorNav() {
  const tabs = [
    { id: "feed", label: "Feed", count: 5 },
    { id: "claims", label: "My briefs", count: 2 },
    { id: "earnings", label: "Earnings" },
    { id: "profile", label: "Profile" },
  ];
  const [active, setActive] = useState("feed");

  return (
    <nav
      className="flex items-center gap-3 sm:gap-5"
      style={{
        background: "var(--bg-2)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: "8px 10px 8px 16px",
      }}
    >
      <Wordmark size="sm" />

      <ul className="hidden md:flex items-center gap-0.5 ml-2">
        {tabs.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setActive(t.id)}
              className="sb-creator-nav-btn"
              data-active={active === t.id}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className="font-mono text-[10.5px] leading-none px-1.5 py-0.5"
                  style={{
                    background:
                      active === t.id
                        ? "color-mix(in oklab, var(--punch) 18%, transparent)"
                        : "var(--bg-3)",
                    color: active === t.id ? "var(--punch)" : "var(--paper-3)",
                    borderRadius: "999px",
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {t.count}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em]"
          style={{
            background: "color-mix(in oklab, var(--live) 10%, transparent)",
            color: "var(--live)",
            border: "1px solid color-mix(in oklab, var(--live) 22%, transparent)",
            borderRadius: "999px",
          }}
        >
          <span
            className="sb-live-dot rounded-full"
            style={{ width: 5, height: 5, background: "var(--live)" }}
          />
          5 today
        </span>
        <NotificationsBell hasNew />
        <button className="sb-avatar" aria-label="Account">
          MH
        </button>
      </div>
    </nav>
  );
}

function NotificationsBell({ hasNew }: { hasNew?: boolean }) {
  return (
    <button
      type="button"
      className="sb-icon-btn"
      aria-label={hasNew ? "Notifications · new" : "Notifications"}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M8 2v1" />
        <path d="M5 4a3 3 0 0 1 6 0v3.5l1.5 2.5h-9L5 7.5V4z" />
        <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
      </svg>
      {hasNew && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#F87171",
            border: "2px solid var(--bg-2)",
          }}
        />
      )}
    </button>
  );
}

/* ────────────── Typography ────────────── */

function Typography() {
  return (
    <section>
      <SectionLabel>Typography</SectionLabel>
      <div
        className="mt-5 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-x-10"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <TypeRow
          label={<>Display<br /><span className="opacity-60">Inter Tight</span></>}
        >
          <div
            className="sb-display font-extrabold leading-[0.95] tracking-[-0.04em]"
            style={{ fontSize: "clamp(40px, 5vw, 64px)" }}
          >
            Five briefs every <span className="sb-serif italic font-normal" style={{ color: "var(--paper-2)" }}>weekday.</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--paper-3)" }}>
            <span>Headlines · Hero · Section h2 · Pillar h3</span>
            <span>800 / 700 / 400 + italic</span>
          </div>
        </TypeRow>

        <TypeRow
          label={<>Body<br /><span className="opacity-60">Plus Jakarta Sans</span></>}
        >
          <p className="text-[18px] leading-[1.55] max-w-[60ch]">
            Briefly is a curated marketplace for vetted creators. New briefs publish daily at 09:00, paid in seven days, no bidding, no haggling, no chasing invoices.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--paper-3)" }}>
            <span>Paragraphs · Card body · UI text</span>
            <span>400 / 500 / 600 / 700</span>
          </div>
        </TypeRow>

        <TypeRow
          label={<>Label<br /><span className="opacity-60">Clear Sans</span></>}
        >
          <div className="font-mono uppercase tracking-[0.08em] flex flex-wrap gap-x-8 gap-y-2">
            <span style={{ color: "var(--paper)" }}>B-047 · 4 200 KR</span>
            <span style={{ color: "var(--paper-3)" }}>DUE 22 MAY</span>
            <span style={{ color: "var(--punch)" }}>EDITION №47</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--paper-3)" }}>
            <span>Labels · IDs · Metrics · Datestamps</span>
            <span>400 / 500 · sans-serif (replaces traditional mono)</span>
          </div>
        </TypeRow>

        <TypeRow
          label={<>Serif<br /><span className="opacity-60">Instrument Serif</span></>}
        >
          <div
            className="sb-serif italic font-normal leading-[1.05] tracking-[-0.01em]"
            style={{ fontSize: "clamp(28px, 3.4vw, 44px)", color: "var(--paper-2)" }}
          >
            for the editorial accents — &ldquo;every weekday,&rdquo; &ldquo;today&apos;s feed.&rdquo;
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--paper-3)" }}>
            <span>Italic accents · pull-quotes · rhythm words</span>
            <span>400 italic</span>
          </div>
        </TypeRow>

        <TypeRow label={<>Scale</>} last>
          <div className="space-y-2">
            <div className="sb-display font-extrabold tracking-[-0.04em]" style={{ fontSize: 56 }}>56 / Display XL</div>
            <div className="sb-display font-extrabold tracking-[-0.03em]" style={{ fontSize: 40 }}>40 / Display L</div>
            <div className="sb-display font-bold tracking-[-0.02em]" style={{ fontSize: 28 }}>28 / Display M</div>
            <div className="font-bold tracking-[-0.015em]" style={{ fontSize: 20 }}>20 / Heading</div>
            <div style={{ fontSize: 16 }}>16 / Body</div>
            <div style={{ fontSize: 14, color: "var(--paper-2)" }}>14 / Body S</div>
            <div className="font-mono uppercase tracking-[0.1em]" style={{ fontSize: 11, color: "var(--paper-3)" }}>11 / MONO LABEL</div>
          </div>
        </TypeRow>
      </div>
    </section>
  );
}

function TypeRow({
  label,
  children,
  last,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <>
      <div
        className="font-mono text-[11px] uppercase tracking-[0.1em] py-6 self-start"
        style={{
          color: "var(--paper-3)",
          borderBottom: last ? "none" : "1px solid var(--line)",
        }}
      >
        {label}
      </div>
      <div
        className="py-6"
        style={{ borderBottom: last ? "none" : "1px solid var(--line)" }}
      >
        {children}
      </div>
    </>
  );
}

/* ────────────── Mono comparison ────────────── */

function MonoComparison() {
  const fonts: { name: string; subtitle: string; family: string; current?: boolean }[] = [
    {
      name: "JetBrains Mono",
      subtitle: "technical, code-feel",
      family: "var(--font-jetbrains), ui-monospace, monospace",
    },
    {
      name: "Geist Mono",
      subtitle: "modern neutral · pairs natively with Inter Tight",
      family: "var(--font-geist-mono), ui-monospace, monospace",
    },
    {
      name: "IBM Plex Mono",
      subtitle: "humanist · slightly editorial",
      family: "var(--font-ibm-plex-mono), ui-monospace, monospace",
    },
    {
      name: "DM Mono",
      subtitle: "geometric · narrow, clean at small sizes",
      family: "var(--font-dm-mono), ui-monospace, monospace",
    },
    {
      name: "Space Mono",
      subtitle: "geometric · slightly retro, more character",
      family: "var(--font-space-mono), ui-monospace, monospace",
    },
    {
      name: "Lexend",
      subtitle: "sans-serif (not monospaced) · humanist, high reading fluency",
      family: "var(--font-lexend), system-ui, sans-serif",
    },
    {
      name: "Figtree",
      subtitle: "sans-serif (not monospaced) · friendly geometric, slightly playful",
      family: "var(--font-figtree), system-ui, sans-serif",
    },
    {
      name: "Clear Sans",
      subtitle: "current · Intel-designed, neutral, very legible at small sizes",
      family: "'Clear Sans', system-ui, sans-serif",
      current: true,
    },
  ];

  return (
    <section>
      <SectionLabel>Mono comparison</SectionLabel>
      <p
        className="mt-2 mb-6 max-w-[60ch] text-[14px] leading-[1.55]"
        style={{ color: "var(--paper-2)" }}
      >
        Same UI strings rendered in five candidate mono families at the sizes the platform actually uses (11–13px, uppercase, with tracking). Compare glyph shapes vertically — &ldquo;B-047&rdquo;, &ldquo;№&rdquo;, &ldquo;0&rdquo; vs &ldquo;O&rdquo;, &ldquo;1&rdquo; vs &ldquo;l&rdquo;, the dot separator.
      </p>

      <div
        className="overflow-hidden"
        style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}
      >
        {/* Header row */}
        <div
          className="grid items-center px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em]"
          style={{
            gridTemplateColumns: "minmax(220px, 1.2fr) minmax(0, 2fr) minmax(0, 1.4fr)",
            color: "var(--paper-3)",
            background: "var(--bg-2)",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span>Family</span>
          <span>Label sample · 11px uppercase</span>
          <span>Inline sample · 13px</span>
        </div>

        {fonts.map((f, i) => (
          <div
            key={f.name}
            className="grid items-center gap-6 px-5 py-5"
            style={{
              gridTemplateColumns: "minmax(220px, 1.2fr) minmax(0, 2fr) minmax(0, 1.4fr)",
              borderBottom: i < fonts.length - 1 ? "1px solid var(--line-soft)" : "none",
            }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[14px] truncate">{f.name}</span>
                {f.current && (
                  <span
                    className="px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                    style={{
                      background: "color-mix(in oklab, var(--punch) 14%, transparent)",
                      color: "var(--punch-ink)",
                      border: "1px solid color-mix(in oklab, var(--punch-ink) 30%, transparent)",
                      borderRadius: "999px",
                    }}
                  >
                    current
                  </span>
                )}
              </div>
              <div
                className="text-[12px] leading-[1.4] mt-0.5"
                style={{ color: "var(--paper-3)" }}
              >
                {f.subtitle}
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-[11px] uppercase tracking-[0.1em]"
                style={{ fontFamily: f.family, color: "var(--paper)" }}
              >
                <span>B-047</span>
                <span style={{ color: "var(--paper-3)" }}>·</span>
                <span>DUE 22 MAY</span>
                <span style={{ color: "var(--paper-3)" }}>·</span>
                <span>EDITION №47</span>
                <span style={{ color: "var(--paper-3)" }}>·</span>
                <span>08.05.2026</span>
              </div>
              <div
                className="mt-2 text-[11px] uppercase tracking-[0.08em]"
                style={{ fontFamily: f.family, color: "var(--paper-2)" }}
              >
                Average payout · 3 800 KR · 7 days · 340 creators
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="text-[13px] leading-[1.4]"
                style={{ fontFamily: f.family, color: "var(--paper)" }}
              >
                B-047 · 4 200 kr
              </div>
              <div
                className="mt-1 text-[13px] leading-[1.4]"
                style={{ fontFamily: f.family, color: "var(--paper-2)" }}
              >
                Illegal/legible: 0Oo · 1lI · ()[]{}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em]"
        style={{ color: "var(--paper-3)" }}
      >
        Tell me which to adopt and I&apos;ll swap <code style={{ fontFamily: "var(--sb-font-mono)" }}>--sb-font-mono</code> + update the typography row.
      </div>
    </section>
  );
}

/* ────────────── Spec strip ────────────── */

function SpecStrip() {
  const cells = [
    { label: "New briefs", value: "Daily", unit: "· 09:00" },
    { label: "Average payout", value: "3 800", unit: "kr", punch: true },
    { label: "Time to payment", value: "7 days", unit: "on delivery" },
    { label: "Roster", value: "340", unit: "creators" },
  ];
  return (
    <section
      className="grid grid-cols-2 sm:grid-cols-4 sb-rise sb-rise-4"
      style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}
    >
      {cells.map((c, i) => (
        <div
          key={c.label}
          className="py-6 px-5 first:pl-0 last:pr-0"
          style={{
            borderRight: i < cells.length - 1 ? "1px solid var(--line)" : "none",
          }}
        >
          <div
            className="font-mono text-[11px] uppercase tracking-[0.1em] mb-2"
            style={{ color: "var(--paper-3)" }}
          >
            {c.label}
          </div>
          <div className="text-[28px] font-bold leading-none tracking-[-0.02em]">
            <span style={{ color: c.punch ? "var(--punch)" : "var(--paper)" }}>{c.value}</span>
            <span
              className="font-mono text-[12px] font-medium ml-1"
              style={{ color: "var(--paper-3)" }}
            >
              {" "}
              {c.unit}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ────────────── Status badges ────────────── */

type StatusKind =
  | "live"
  | "claimed"
  | "review"
  | "approved"
  | "rejected"
  | "expired"
  | "paid"
  | "refunded";

const STATUS_CONFIG: Record<
  StatusKind,
  { label: string; ink: string; fill: string; pulse?: boolean }
> = {
  live: { label: "Live", ink: "var(--live-ink)", fill: "var(--live)", pulse: true },
  claimed: { label: "Claimed", ink: "var(--punch-ink)", fill: "var(--punch)" },
  review: { label: "Under review", ink: "var(--warning-ink)", fill: "var(--warning)" },
  approved: { label: "Approved", ink: "var(--live-ink)", fill: "var(--live)" },
  rejected: { label: "Rejected", ink: "var(--error-ink)", fill: "var(--error)" },
  expired: { label: "Expired", ink: "var(--paper-3)", fill: "var(--paper-3)" },
  paid: { label: "Paid", ink: "var(--punch-ink)", fill: "var(--punch)" },
  refunded: { label: "Refunded", ink: "var(--paper-2)", fill: "var(--paper-2)" },
};

function StatusBadge({ status }: { status: StatusKind }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium tracking-[-0.005em]"
      style={{
        background: `color-mix(in oklab, ${c.fill} 14%, transparent)`,
        color: c.ink,
        border: `1px solid color-mix(in oklab, ${c.ink} 30%, transparent)`,
        borderRadius: "999px",
      }}
    >
      <span
        className={c.pulse ? "sb-live-dot" : ""}
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.ink,
          flexShrink: 0,
        }}
      />
      {c.label}
    </span>
  );
}

function StatusBadges() {
  const all: StatusKind[] = [
    "live",
    "claimed",
    "review",
    "approved",
    "rejected",
    "expired",
    "paid",
    "refunded",
  ];
  return (
    <section>
      <SectionLabel>Status</SectionLabel>
      <div className="flex flex-wrap gap-2 mt-4">
        {all.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>
    </section>
  );
}

/* ────────────── List ────────────── */

function ListSection() {
  const items: { id: string; title: string; meta: string; status: StatusKind }[] = [
    { id: "B-047", title: "Bouldering gym launch — 3× short-form video", meta: "Video · Aarhus · 4 200 kr", status: "live" },
    { id: "B-046", title: "Coffee roaster, single-origin launch", meta: "Photo · CPH · 2 800 kr", status: "claimed" },
    { id: "B-045", title: "Restaurant opening — behind the scenes", meta: "Video · 6 800 kr", status: "review" },
    { id: "B-044", title: "Outdoor brand summer collection", meta: "Photo · 5 200 kr", status: "approved" },
    { id: "B-043", title: "App teaser motion piece", meta: "Motion · 8 400 kr", status: "expired" },
  ];
  return (
    <section>
      <SectionLabel>List</SectionLabel>
      <div className="mt-4 sb-list">
        {items.map((item) => (
          <button key={item.id} type="button" className="sb-list-row">
            <span
              className="font-mono text-[11.5px] tracking-[0.05em]"
              style={{ color: "var(--paper-3)" }}
            >
              {item.id}
            </span>
            <span className="font-medium text-[14px] truncate">{item.title}</span>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.06em] hidden md:inline"
              style={{ color: "var(--paper-3)" }}
            >
              {item.meta}
            </span>
            <StatusBadge status={item.status} />
            <span className="sb-list-arrow" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ────────────── Tabs ────────────── */

function TabsSection() {
  const tabs = [
    { id: "open", label: "Open", count: 5 },
    { id: "drafts", label: "Drafts", count: 2 },
    { id: "archived", label: "Archived", count: 23 },
  ];
  const [active, setActive] = useState(tabs[0].id);
  const idx = tabs.findIndex((t) => t.id === active);

  return (
    <section>
      <SectionLabel>Tabs</SectionLabel>
      <div className="mt-4 sb-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-active={active === t.id}
            onClick={() => setActive(t.id)}
            className="sb-tab"
          >
            {t.label}{" "}
            <span style={{ color: "var(--paper-3)" }} className="ml-1 font-mono text-[11px]">
              {t.count}
            </span>
          </button>
        ))}
        <span
          className="sb-tab-indicator"
          style={{
            width: `${100 / tabs.length}%`,
            transform: `translateX(${idx * 100}%)`,
          }}
          aria-hidden
        />
      </div>
      <div className="mt-6 text-[14px]" style={{ color: "var(--paper-2)" }}>
        Showing <strong style={{ color: "var(--paper)" }}>{active}</strong> briefs.
      </div>
    </section>
  );
}

/* ────────────── Brief sample cards ────────────── */

function BriefSample() {
  const cards = [
    {
      id: "B-047",
      type: "Video",
      title: "Bouldering gym launch — 3× short-form video",
      body: "Three vertical cuts, native sound, no voiceover. Aarhus.",
      pay: "4 200",
      due: "22 MAY",
    },
    {
      id: "B-046",
      type: "Photo",
      title: "Coffee roaster, single-origin launch",
      body: "Eight hero shots. Half-day, in-studio, props provided.",
      pay: "2 800",
      due: "18 MAY",
    },
    {
      id: "B-043",
      type: "Video · Doc",
      title: "Restaurant opening — behind the scenes",
      body: "One full evening of service. Two-minute edit plus selects.",
      pay: "6 800",
      due: "02 JUN",
    },
  ];
  return (
    <section>
      <div
        className="flex items-end justify-between pb-5 mb-6"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <h2 className="sb-display font-extrabold tracking-[-0.03em] text-[32px] sm:text-[40px] leading-none">
          A taste of <span className="sb-serif italic font-normal" style={{ color: "var(--paper-2)" }}>today&apos;s feed.</span>
        </h2>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.1em]"
          style={{ color: "var(--paper-3)" }}
        >
          5 live
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => (
          <article key={c.id} className="sb-card p-6 flex flex-col min-h-[220px] cursor-pointer">
            <div
              className="flex items-center justify-between mb-4 font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: "var(--paper-3)" }}
            >
              <span style={{ color: "var(--paper-2)" }}>{c.id}</span>
              <span
                className="px-2 py-0.5"
                style={{ border: "1px solid var(--line)", borderRadius: "999px" }}
              >
                {c.type}
              </span>
            </div>
            <h4 className="font-bold tracking-[-0.02em] leading-tight text-[18px] mb-2">{c.title}</h4>
            <p className="text-[13px] leading-[1.5] mb-auto" style={{ color: "var(--paper-2)" }}>
              {c.body}
            </p>
            <div
              className="flex items-center justify-between pt-5 mt-5"
              style={{ borderTop: "1px solid var(--line-soft)" }}
            >
              <span
                className="text-[20px] font-bold tracking-[-0.02em]"
                style={{ color: "var(--punch)" }}
              >
                {c.pay}
                <span className="font-mono text-[11px] font-medium ml-1" style={{ color: "var(--paper-3)" }}>
                  kr
                </span>
              </span>
              <span className="font-mono text-[11px] tracking-[0.05em]" style={{ color: "var(--paper-3)" }}>
                DUE {c.due}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ────────────── Claimed brief ────────────── */

type Urgency = "calm" | "warning" | "critical";

type ClaimedBrief = {
  id: string;
  type: string;
  title: string;
  body: string;
  pay: string;
  timeLeft: string;
  due: string;
  urgency: Urgency;
};

function urgencyColor(u: Urgency): string {
  if (u === "critical") return "var(--error)";
  if (u === "warning") return "var(--warning)";
  return "var(--punch)";
}

function ClaimedBriefSection({ fire }: { fire: (t: ToastTone, m: string) => void }) {
  const cards: ClaimedBrief[] = [
    {
      id: "B-047",
      type: "Video",
      title: "Bouldering gym launch — 3× short-form video",
      body: "Three vertical cuts, native sound, no voiceover. Aarhus.",
      pay: "4 200",
      timeLeft: "6d left",
      due: "22 MAY",
      urgency: "calm",
    },
    {
      id: "B-046",
      type: "Photo",
      title: "Coffee roaster, single-origin launch",
      body: "Eight hero shots. Half-day, in-studio, props provided.",
      pay: "2 800",
      timeLeft: "2d left",
      due: "18 MAY",
      urgency: "warning",
    },
    {
      id: "B-043",
      type: "Video · Doc",
      title: "Restaurant opening — behind the scenes",
      body: "One full evening of service. Two-minute edit plus selects.",
      pay: "6 800",
      timeLeft: "8h left",
      due: "TOMORROW",
      urgency: "critical",
    },
  ];

  return (
    <section>
      <SectionLabel>Claimed brief</SectionLabel>
      <p
        className="mt-2 mb-6 max-w-[60ch] text-[14px] leading-[1.55]"
        style={{ color: "var(--paper-2)" }}
      >
        Same shape as an open brief — just tinted, with a small Claimed pill and an inline countdown that goes amber under 3 days, red under 24 hours.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <ClaimedBriefCard key={c.id} brief={c} fire={fire} />
        ))}
      </div>
    </section>
  );
}

function ClaimedBriefCard({
  brief,
  fire,
}: {
  brief: ClaimedBrief;
  fire: (t: ToastTone, m: string) => void;
}) {
  const color = urgencyColor(brief.urgency);
  return (
    <article className="sb-card sb-card-claimed p-6 flex flex-col">
      {/* Header — id · type on left, small Claimed pill on right */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="font-mono text-[11px] uppercase tracking-[0.08em]"
          style={{ color: "var(--paper-3)" }}
        >
          <span style={{ color: "var(--paper-2)" }}>{brief.id}</span>
          <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span>
          <span>{brief.type}</span>
        </div>
        <ClaimedPill />
      </div>

      {/* Title */}
      <h4 className="sb-display text-[18px] font-bold tracking-[-0.02em] leading-tight mb-2">
        {brief.title}
      </h4>

      {/* Body */}
      <p
        className="text-[13px] leading-[1.5] mb-auto"
        style={{ color: "var(--paper-2)" }}
      >
        {brief.body}
      </p>

      {/* Footer — pay + countdown stacked on left, Submit on right */}
      <div
        className="flex items-end justify-between gap-3 pt-5 mt-5"
        style={{ borderTop: "1px solid var(--line-soft)" }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="sb-display text-[20px] font-bold tracking-[-0.02em] leading-none"
            style={{ color: "var(--punch)" }}
          >
            {brief.pay}
            <span
              className="font-mono text-[11px] font-medium ml-1"
              style={{ color: "var(--paper-3)" }}
            >
              kr
            </span>
          </span>
          <span className="font-mono text-[11px] tracking-[0.05em] truncate">
            <span style={{ color }}>{brief.timeLeft}</span>
            <span style={{ color: "var(--paper-3)", opacity: 0.5 }}> · </span>
            <span style={{ color: "var(--paper-3)" }}>DUE {brief.due}</span>
          </span>
        </div>
        <Button
          variant="punch"
          size="sm"
          trailingArrow
          onClick={() => fire("success", `Submission opened · ${brief.id}`)}
        >
          Submit
        </Button>
      </div>
    </article>
  );
}

function ClaimedPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono uppercase tracking-[0.08em]"
      style={{
        background: "color-mix(in oklab, var(--punch) 14%, transparent)",
        color: "var(--punch-ink)",
        border: "1px solid color-mix(in oklab, var(--punch-ink) 30%, transparent)",
        borderRadius: "999px",
        fontSize: 10,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "var(--punch-ink)",
        }}
      />
      Claimed
    </span>
  );
}

/* ────────────── Pillars ────────────── */

function Pillars() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PillarCard
        variant="punch"
        tag="For creators"
        title={
          <>
            Steady briefs.
            <br />
            Predictable pay.
          </>
        }
        body="A daily feed of vetted briefs, priced fairly, paid on time. Replace the feast-and-famine cycle with a flow you can plan around."
        items={[
          "5 new briefs every weekday at 09:00",
          "Self-billed invoices, no chasing",
          "Payment within 7 days of delivery",
          "No bidding, no race to the bottom",
        ]}
        priceLabel="0 kr"
        priceSub="free to apply · 8% platform fee"
        cta="Apply"
      />
      <PillarCard
        variant="surface"
        tag="For brands"
        title={
          <>
            Post a brief.
            <br />
            Get the work.
          </>
        }
        body="Skip the agency markup and the freelancer roulette. Post a brief, our top-tier creators claim it, you receive deliverables in days."
        items={[
          "Vetted creators across photo, video, motion, copy",
          "Average delivery: 5 days from post",
          "Single platform invoice, no contractor admin",
          "Direct chat with the creator on the work",
        ]}
        priceLabel="From 1 500 kr"
        priceSub="all-in pricing · no retainer"
        cta="Post a brief"
      />
    </section>
  );
}

function PillarCard({
  variant,
  tag,
  title,
  body,
  items,
  priceLabel,
  priceSub,
  cta,
}: {
  variant: "punch" | "surface";
  tag: string;
  title: React.ReactNode;
  body: string;
  items: string[];
  priceLabel: string;
  priceSub: string;
  cta: string;
}) {
  const isPunch = variant === "punch";
  return (
    <div
      className="p-9 flex flex-col min-h-[420px]"
      style={{
        background: isPunch ? "var(--punch)" : "var(--bg-2)",
        border: "1px solid",
        borderColor: isPunch ? "var(--punch)" : "var(--line)",
        borderRadius: "var(--r-lg)",
        color: isPunch ? "var(--on-punch)" : "var(--paper)",
      }}
    >
      <span
        className="self-start font-mono text-[11px] tracking-[0.05em] mb-8 px-2.5 py-1"
        style={{
          border: `1px solid ${
            isPunch ? "color-mix(in oklab, var(--on-punch) 25%, transparent)" : "var(--line)"
          }`,
          borderRadius: "999px",
          color: isPunch
            ? "color-mix(in oklab, var(--on-punch) 70%, transparent)"
            : "var(--paper-2)",
        }}
      >
        {tag}
      </span>
      <h3 className="sb-display font-extrabold tracking-[-0.03em] leading-[0.95] text-[34px] mb-4">{title}</h3>
      <p
        className="text-[15px] leading-[1.55] mb-7"
        style={{
          color: isPunch
            ? "color-mix(in oklab, var(--on-punch) 75%, transparent)"
            : "var(--paper-2)",
        }}
      >
        {body}
      </p>
      <ul className="mb-8">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start gap-3 py-2 text-[14px]"
            style={{
              borderBottom:
                i < items.length - 1
                  ? `1px solid ${
                      isPunch
                        ? "color-mix(in oklab, var(--on-punch) 12%, transparent)"
                        : "var(--line-soft)"
                    }`
                  : "none",
            }}
          >
            <span
              className="w-3.5 h-3.5 mt-1 grid place-items-center text-[9px] font-bold"
              style={{
                background: isPunch ? "var(--on-punch)" : "var(--punch)",
                color: isPunch ? "var(--punch)" : "var(--on-punch)",
              }}
            >
              ✓
            </span>
            {it}
          </li>
        ))}
      </ul>
      <div
        className="mt-auto flex items-center justify-between gap-4 pt-5"
        style={{
          borderTop: `1px solid ${
            isPunch ? "color-mix(in oklab, var(--on-punch) 14%, transparent)" : "var(--line-soft)"
          }`,
        }}
      >
        <div
          className="text-[13px]"
          style={{
            color: isPunch
              ? "color-mix(in oklab, var(--on-punch) 65%, transparent)"
              : "var(--paper-3)",
          }}
        >
          <strong
            className="block text-[17px] font-bold tracking-[-0.02em] mb-0.5"
            style={{ color: isPunch ? "var(--on-punch)" : "var(--paper)" }}
          >
            {priceLabel}
          </strong>
          {priceSub}
        </div>
        <Button variant={isPunch ? "inverse" : "punch"} trailingArrow>
          {cta}
        </Button>
      </div>
    </div>
  );
}

/* ────────────── Forms ────────────── */

function FormSection() {
  const [notify, setNotify] = useState(true);
  return (
    <section>
      <SectionLabel>Form fields</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-4">
        <Field label="Brief title">
          <input
            type="text"
            className="sb-input"
            placeholder="e.g. Coffee roaster launch"
            defaultValue="Bouldering gym launch"
          />
        </Field>
        <Field label="Brief type">
          <select className="sb-input" defaultValue="Video">
            <option>Photo</option>
            <option>Video</option>
            <option>Motion</option>
            <option>Copy</option>
          </select>
        </Field>
        <Field label="Description" full>
          <textarea
            className="sb-input"
            rows={3}
            placeholder="What needs to be made..."
            defaultValue="Three vertical cuts, native sound, no voiceover. Full creative trust."
          />
        </Field>
        <Field label="Payout (kr)">
          <input type="number" className="sb-input" defaultValue={4200} />
        </Field>
        <Field label="Due date">
          <input type="date" className="sb-input" defaultValue="2026-05-22" />
        </Field>
        <div className="sm:col-span-2 flex items-center justify-between gap-4 py-3 px-4" style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
          <div>
            <div className="text-[14px] font-medium">Notify roster on publish</div>
            <div className="text-[13px]" style={{ color: "var(--paper-2)" }}>
              Email creators that match this brief&apos;s skill tags.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notify}
            data-on={notify}
            onClick={() => setNotify((v) => !v)}
            className="sb-switch shrink-0"
          >
            <span className="sb-switch-thumb" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-2 ${full ? "sm:col-span-2" : ""}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--paper-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/* ────────────── Modals ────────────── */

function ModalsSection({ fire }: { fire: (t: ToastTone, m: string) => void }) {
  const confirmRef = useRef<HTMLDialogElement>(null);
  const headsUpRef = useRef<HTMLDialogElement>(null);
  const [publishing, setPublishing] = useState(false);

  return (
    <section>
      <SectionLabel>Modals</SectionLabel>
      <div className="flex flex-wrap gap-3 mt-4">
        <Button variant="outline" onClick={() => confirmRef.current?.showModal()}>
          Open confirm
        </Button>
        <Button variant="outline" onClick={() => headsUpRef.current?.showModal()}>
          Open heads-up
        </Button>
      </div>

      <dialog
        ref={confirmRef}
        className="sb-dialog"
        onClick={(e) => {
          if (e.target === confirmRef.current) confirmRef.current?.close();
        }}
      >
        <div className="sb-dialog-panel" onClick={(e) => e.stopPropagation()}>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--error)" }}>
            Destructive
          </div>
          <h3 className="sb-display text-[22px] font-bold tracking-[-0.02em] mb-2">Archive this brief?</h3>
          <p className="text-[14px] leading-[1.55] mb-7" style={{ color: "var(--paper-2)" }}>
            Any unfilled slots will be refunded. In-progress claims stay open until they expire. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => confirmRef.current?.close()}>
              Cancel
            </Button>
            <button
              type="button"
              className="sb-btn px-4 py-2.5 text-[14px] font-semibold"
              style={{
                background: "#F87171",
                color: "#0E0E10",
                border: "1px solid #F87171",
                borderRadius: "999px",
              }}
              onClick={() => {
                confirmRef.current?.close();
                fire("error", "Brief archived");
              }}
            >
              Archive brief
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={headsUpRef}
        className="sb-dialog"
        onClick={(e) => {
          if (e.target === headsUpRef.current) headsUpRef.current?.close();
        }}
      >
        <div className="sb-dialog-panel" onClick={(e) => e.stopPropagation()}>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--warning)" }}>
            Heads up
          </div>
          <h3 className="sb-display text-[22px] font-bold tracking-[-0.02em] mb-2">Publishing will charge escrow</h3>
          <p className="text-[14px] leading-[1.55] mb-7" style={{ color: "var(--paper-2)" }}>
            Publishing this brief charges <strong style={{ color: "var(--paper)" }}>4 200 kr × 3 slots = 12 600 kr</strong> from your saved card. Funds release to creators on approval.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={publishing}
              onClick={() => headsUpRef.current?.close()}
            >
              Not yet
            </Button>
            <Button
              variant="punch"
              trailingArrow={!publishing}
              disabled={publishing}
              onClick={() => {
                if (publishing) return;
                setPublishing(true);
                window.setTimeout(() => {
                  setPublishing(false);
                  headsUpRef.current?.close();
                  fire("success", "Brief published · 12 600 kr held in escrow");
                }, 1600);
              }}
            >
              {publishing && <Spinner size={14} data-icon="inline-start" />}
              {publishing ? "Processing payment…" : "Publish brief"}
            </Button>
          </div>
        </div>
      </dialog>
    </section>
  );
}

/* ────────────── Toasts (sandbox-native) ────────────── */

function ToastSection({ fire }: { fire: (t: ToastTone, m: string) => void }) {
  return (
    <section>
      <SectionLabel>Toasts</SectionLabel>
      <div className="flex flex-wrap gap-3 mt-4">
        <Button variant="outline" onClick={() => fire("default", "Brief saved as draft")}>
          Default toast
        </Button>
        <Button variant="outline" onClick={() => fire("success", "Payout released to creator")}>
          Success
        </Button>
        <Button variant="outline" onClick={() => fire("error", "Payment method declined")}>
          Error
        </Button>
      </div>
      <p className="mt-3 text-[12px]" style={{ color: "var(--paper-3)" }}>
        Toasts appear at bottom-right of the viewport. They themed with sandbox tokens, so they crossfade with the theme toggle.
      </p>
    </section>
  );
}

function ToastStack({ toasts }: { toasts: SbToast[] }) {
  return (
    <div className="sb-toast-stack" aria-live="polite">
      {toasts.map((t) => {
        const accent =
          t.tone === "success"
            ? "var(--live)"
            : t.tone === "error"
              ? "#F87171"
              : "var(--punch)";
        return (
          <div
            key={t.id}
            className="sb-toast"
            data-leaving={t.leaving}
            style={{ borderLeftColor: accent }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
              style={{ background: accent }}
            />
            <span
              className="text-[14px] leading-[1.4]"
              style={{ color: "var(--paper)" }}
            >
              {t.msg}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────── Spinners & loading ────────────── */

function SpinnerSection({ fire }: { fire: (t: ToastTone, m: string) => void }) {
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);

  const simulate = (
    setter: (v: boolean) => void,
    onDone?: () => void,
    duration = 1600,
  ) => {
    setter(true);
    window.setTimeout(() => {
      setter(false);
      onDone?.();
    }, duration);
  };

  return (
    <section>
      <SectionLabel>Spinners &amp; loading</SectionLabel>
      <p
        className="mt-2 mb-6 max-w-[60ch] text-[14px] leading-[1.55]"
        style={{ color: "var(--paper-2)" }}
      >
        8-leaf radial spinner, 0.85s linear cycle. A faster spinner perceptually = a faster app. Inherits <code style={{ fontFamily: "var(--sb-font-mono)" }}>currentColor</code> so it picks up whatever text color sits around it.
      </p>

      {/* Sizes */}
      <SubLabel>Size scale</SubLabel>
      <div
        className="flex flex-wrap items-end gap-8 px-5 py-5"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
        }}
      >
        {[12, 14, 16, 20, 24, 32, 40].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2.5">
            <Spinner size={s} />
            <span
              className="font-mono text-[10.5px]"
              style={{ color: "var(--paper-3)" }}
            >
              {s}px
            </span>
          </div>
        ))}
      </div>

      {/* In button */}
      <SubLabel className="mt-6">In button · click to simulate</SubLabel>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="punch"
          disabled={paying}
          onClick={() => {
            simulate(setPaying, () => fire("success", "Payment processed · 12 600 kr held in escrow"));
          }}
        >
          {paying && <Spinner size={14} data-icon="inline-start" />}
          {paying ? "Processing payment…" : "Pay 12 600 kr"}
        </Button>
        <Button
          variant="outline"
          disabled={saving}
          onClick={() => {
            simulate(setSaving, () => fire("default", "Draft saved"));
          }}
        >
          {saving && <Spinner size={14} data-icon="inline-start" />}
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button
          variant="ghost"
          disabled={refunding}
          onClick={() => {
            simulate(setRefunding, () => fire("success", "Refund issued"), 2000);
          }}
          trailingArrow={!refunding}
        >
          {refunding && <Spinner size={14} data-icon="inline-start" />}
          {refunding ? "Refunding…" : "Refund creator"}
        </Button>
      </div>

      {/* Inline */}
      <SubLabel className="mt-6">Inline · alongside text</SubLabel>
      <div
        className="flex items-center gap-2.5 px-4 py-3 text-[14px]"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          color: "var(--paper-2)",
        }}
      >
        <Spinner size={14} />
        <span>Fetching today&apos;s briefs…</span>
      </div>

      {/* Card overlay */}
      <SubLabel className="mt-6">Card · processing payment</SubLabel>
      <div
        className="relative px-6 py-7 overflow-hidden"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
        }}
      >
        <div
          className="transition-opacity duration-200"
          style={{ opacity: cardLoading ? 0.4 : 1 }}
        >
          <div
            className="font-mono text-[11px] uppercase tracking-[0.1em] mb-1.5"
            style={{ color: "var(--paper-3)" }}
          >
            Brief B-047 · publish
          </div>
          <h4 className="sb-display text-[20px] font-bold tracking-[-0.02em] mb-1">
            Charge 12 600 kr from Visa ··· 4242
          </h4>
          <p className="text-[13.5px] leading-[1.55] mb-5" style={{ color: "var(--paper-2)" }}>
            Funds release to creators on approval. Unfilled slots refund automatically when the brief expires.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={cardLoading}>
              Cancel
            </Button>
            <Button
              variant="punch"
              disabled={cardLoading}
              trailingArrow={!cardLoading}
              onClick={() => {
                simulate(setCardLoading, () => fire("success", "Brief published"), 1800);
              }}
            >
              {cardLoading && <Spinner size={14} data-icon="inline-start" />}
              {cardLoading ? "Processing payment…" : "Publish brief"}
            </Button>
          </div>
        </div>

        {cardLoading && (
          <div
            className="absolute inset-0 grid place-items-center"
            style={{
              background: "color-mix(in oklab, var(--bg-2) 75%, transparent)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-3">
              <Spinner size={28} />
              <div
                className="font-mono text-[11px] uppercase tracking-[0.12em]"
                style={{ color: "var(--paper-2)" }}
              >
                Processing payment…
              </div>
            </div>
          </div>
        )}
      </div>

      <p
        className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em]"
        style={{ color: "var(--paper-3)" }}
      >
        Tip · spinner color follows <code style={{ fontFamily: "var(--sb-font-mono)" }}>currentColor</code>. Punch buttons → on-punch dark; ghost buttons → paper.
      </p>
    </section>
  );
}

function SubLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`font-mono text-[11px] uppercase tracking-[0.1em] mb-3 ${className}`}
      style={{ color: "var(--paper-3)" }}
    >
      {children}
    </div>
  );
}

/* ────────────── Empty state ────────────── */

function EmptyStateSection() {
  return (
    <section>
      <SectionLabel>Empty state</SectionLabel>
      <div className="mt-4 sb-empty">
        <div
          className="mx-auto mb-5 grid place-items-center"
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--r-md)",
            border: "1px dashed var(--line)",
            color: "var(--paper-3)",
          }}
          aria-hidden
        >
          <span className="font-mono text-[18px]">∅</span>
        </div>
        <h3 className="text-[20px] font-bold tracking-[-0.02em] mb-2">No briefs yet</h3>
        <p className="text-[14px] leading-[1.55] max-w-[44ch] mx-auto mb-6" style={{ color: "var(--paper-2)" }}>
          New briefs publish at 09:00 every weekday. You can also browse past briefs while you wait.
        </p>
        <Button variant="punch" trailingArrow>
          Browse all briefs
        </Button>
      </div>
    </section>
  );
}

/* ────────────── Skeleton ────────────── */

function SkeletonSection() {
  return (
    <section>
      <SectionLabel>Skeleton (loading)</SectionLabel>
      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="grid items-center gap-4 px-4 py-3"
            style={{
              gridTemplateColumns: "60px 1fr 100px 80px",
              background: "var(--bg-2)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div className="sb-skel" style={{ height: 12 }} />
            <div className="sb-skel" style={{ height: 14 }} />
            <div className="sb-skel" style={{ height: 12 }} />
            <div className="sb-skel" style={{ height: 22, borderRadius: "999px" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────── Buttons row ────────────── */

function ButtonsRow() {
  return (
    <section className="space-y-4">
      <SectionLabel>Buttons</SectionLabel>
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="punch">Punch primary</Button>
        <Button variant="punch" trailingArrow>
          Punch with arrow
        </Button>
        <Button variant="inverse">Inverse</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </section>
  );
}

/* ────────────── Swatches ────────────── */

function Swatches() {
  const groups: { label: string; tokens: { name: string; value: string }[] }[] = [
    {
      label: "Surfaces",
      tokens: [
        { name: "--bg", value: "var(--bg)" },
        { name: "--bg-2", value: "var(--bg-2)" },
        { name: "--bg-3", value: "var(--bg-3)" },
        { name: "--line", value: "var(--line)" },
        { name: "--line-soft", value: "var(--line-soft)" },
      ],
    },
    {
      label: "Text",
      tokens: [
        { name: "--paper", value: "var(--paper)" },
        { name: "--paper-2", value: "var(--paper-2)" },
        { name: "--paper-3", value: "var(--paper-3)" },
      ],
    },
    {
      label: "Signal",
      tokens: [
        { name: "--punch", value: "var(--punch)" },
        { name: "--on-punch", value: "var(--on-punch)" },
        { name: "--live", value: "var(--live)" },
      ],
    },
  ];
  return (
    <section className="space-y-6 pb-16">
      <SectionLabel>Tokens</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] mb-3" style={{ color: "var(--paper-3)" }}>
              {g.label}
            </div>
            <div className="overflow-hidden" style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
              {g.tokens.map((t, i) => (
                <div
                  key={t.name}
                  className="flex items-center gap-3 px-3 py-2 text-[13px]"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--line-soft)" : "none",
                    background: "var(--bg-2)",
                  }}
                >
                  <span
                    className="w-7 h-7 shrink-0"
                    style={{
                      background: t.value,
                      border: "1px solid var(--line)",
                      borderRadius: "var(--r-sm)",
                    }}
                  />
                  <span className="font-mono" style={{ color: "var(--paper)" }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────── Primitives ────────────── */

function Button({
  children,
  variant = "punch",
  size = "default",
  trailingArrow = false,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "punch" | "inverse" | "ghost" | "outline";
  size?: "default" | "sm";
  trailingArrow?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const styles: React.CSSProperties =
    variant === "punch"
      ? { background: "var(--punch)", color: "var(--on-punch)", border: "1px solid var(--punch)" }
      : variant === "inverse"
        ? { background: "var(--paper)", color: "var(--bg)", border: "1px solid var(--paper)" }
        : variant === "outline"
          ? { background: "transparent", color: "var(--paper)", border: "1px solid var(--line)" }
          : { background: "transparent", color: "var(--paper)", border: "1px solid transparent" };
  const sizeCls =
    size === "sm"
      ? "px-3 py-1.5 text-[12.5px] gap-1.5"
      : "px-4 py-2.5 text-[14px] gap-2";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`sb-btn inline-flex items-center font-semibold tracking-[-0.005em] ${sizeCls}`}
      style={{
        ...styles,
        borderRadius: "999px",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
      {trailingArrow && (
        <span className="sb-arrow" aria-hidden>
          →
        </span>
      )}
    </button>
  );
}

/* ────────────── Spinner ────────────── */

function Spinner({
  size = 16,
  className = "",
  ...props
}: {
  size?: number;
  className?: string;
} & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`sb-spinner ${className}`}
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      {...props}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="sb-spinner-leaf" aria-hidden />
      ))}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--punch)" }}>
      {children}
    </div>
  );
}
