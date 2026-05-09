"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";

type Theme = "dark" | "light";
type ToastTone = "default" | "success" | "error";
type SbToast = { id: number; tone: ToastTone; msg: string; leaving: boolean };

export default function SandboxEditorialPage() {
  // Editorial sandbox shares theme state via next-themes. Internal
  // sliding-thumb toggle calls setTheme — same source of truth as
  // the platform nav dropdowns.
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
      : "light";

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
      data-sbe
      data-theme={theme}
      className="min-h-screen w-full"
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
        viewTransitionName: "sbe-root",
      }}
    >
      <Toolbar theme={theme} onChange={toggleTheme} />

      <main className="mx-auto max-w-[1200px] px-6 sm:px-10 py-12 sm:py-16 space-y-20">
        <Masthead />
        <NavSection />
        <Typography />
        <MonoComparison />
        <SpecStrip />
        <StatusBadges />
        <BriefList />
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
        background: "color-mix(in oklab, var(--bg) 82%, transparent)",
        borderBottom: "1px solid var(--rule)",
      }}
    >
      <div className="mx-auto max-w-[1200px] px-6 sm:px-10 h-14 flex items-center justify-between">
        <div
          className="flex items-center gap-3 text-[11px] uppercase font-semibold"
          style={{
            color: "var(--ink-3)",
            letterSpacing: "0.18em",
            fontFamily: "var(--sbe-font-label)",
          }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>Briefly</span>
          <span style={{ color: "var(--ink-3)" }}>·</span>
          <span>Editorial playground</span>
        </div>

        <div
          className="sbe-toggle relative inline-flex items-center text-[12px] font-medium"
          data-active={theme}
          style={{
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
            padding: "2px",
            background: "var(--bg-elevated)",
          }}
        >
          <span
            className="sbe-toggle-thumb absolute"
            style={{
              top: "2px",
              bottom: "2px",
              left: "2px",
              width: "calc(50% - 2px)",
              background: "var(--ink)",
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
                className="sbe-toggle-btn relative z-10 px-3 py-1 capitalize"
                style={{
                  color: active ? "var(--bg)" : "var(--ink-2)",
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

/* ────────────── Masthead (Hero) ────────────── */

function Masthead() {
  return (
    <section className="sbe-rise sbe-rise-1">
      <div
        className="text-[11px] uppercase font-semibold mb-5"
        style={{
          color: "var(--accent)",
          letterSpacing: "0.18em",
          fontFamily: "var(--sbe-font-label)",
        }}
      >
        Today&apos;s feed
      </div>

      <h1
        className="sbe-display sbe-rise sbe-rise-2"
        style={{
          fontSize: "clamp(40px, 6vw, 72px)",
          fontWeight: 400,
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          maxWidth: 820,
        }}
      >
        Five briefs <em>worth your morning.</em>
      </h1>

      <div className="mt-7 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-10 items-end sbe-rise sbe-rise-3">
        <p
          className="text-[16px]"
          style={{
            color: "var(--ink-3)",
            maxWidth: 540,
            lineHeight: 1.6,
          }}
        >
          A curated set of opportunities matched to your portfolio. Take what fits, pass on the rest. New briefs publish daily at 09:00, paid in seven days, no bidding.
        </p>
        <div className="flex gap-2 sm:justify-self-end">
          <Button variant="ghost">See today&apos;s briefs</Button>
          <Button variant="primary" trailingArrow>Apply to join</Button>
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
        className="mt-4 mb-6 max-w-[60ch] text-[14px]"
        style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
      >
        Two surfaces, two patterns. Public uses a serif wordmark with an issue tagline and underline-active links. The logged-in creator surface keeps the same skeleton but adds a live status pill, notifications, and avatar.
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
        className="flex items-center gap-2 mb-3 text-[11px] uppercase font-semibold"
        style={{
          color: "var(--ink-3)",
          letterSpacing: "0.16em",
          fontFamily: "var(--sbe-font-label)",
        }}
      >
        <span>{label}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ color: "var(--ink-2)" }}>{path}</span>
      </div>
      <div
        className="p-5 sm:p-6"
        style={{
          background: "var(--bg-2)",
          border: "1px dashed var(--rule)",
          borderRadius: "var(--r-lg)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Wordmark({ size = "md" }: { size?: "sm" | "md" }) {
  const fontSize = size === "sm" ? 20 : 24;
  return (
    <div className="flex items-baseline gap-2.5 shrink-0">
      <a
        href="#"
        className="sbe-display"
        style={{
          fontSize,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          textDecoration: "none",
        }}
      >
        Briefly.
      </a>
      <span
        className="hidden sm:inline text-[11px]"
        style={{
          color: "var(--ink-3)",
          fontWeight: 500,
          fontFamily: "var(--sbe-font-label)",
        }}
      >
        Issue 47 · May 2026
      </span>
    </div>
  );
}

function PublicNav() {
  const links = [
    { label: "Briefs", active: true },
    { label: "Library", active: false },
    { label: "For brands", active: false },
    { label: "Pricing", active: false },
  ];
  return (
    <nav
      className="grid items-center gap-4 sm:gap-8"
      style={{
        gridTemplateColumns: "auto 1fr auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-lg)",
        padding: "14px 22px",
      }}
    >
      <Wordmark />

      <ul className="hidden md:flex items-center justify-center gap-7 text-[14px] font-medium">
        {links.map((l) => (
          <li key={l.label}>
            <a href="#" className="sbe-nav-link" data-active={l.active}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 justify-self-end">
        <Button variant="ghost" size="sm">Log in</Button>
        <Button variant="primary" size="sm" trailingArrow>
          Apply
        </Button>
      </div>
    </nav>
  );
}

function CreatorNav() {
  const tabs = [
    { id: "feed", label: "Briefs", active: true },
    { id: "library", label: "Library", active: false },
    { id: "earnings", label: "Earnings", active: false },
    { id: "profile", label: "Profile", active: false },
  ];
  const [activeId, setActiveId] = useState(
    tabs.find((t) => t.active)?.id ?? tabs[0].id,
  );

  return (
    <nav
      className="flex items-center gap-3 sm:gap-6"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-lg)",
        padding: "14px 22px",
      }}
    >
      <Wordmark size="sm" />

      <ul className="hidden md:flex items-center gap-6 ml-4 text-[14px] font-medium">
        {tabs.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => setActiveId(t.id)}
              className="sbe-nav-link"
              data-active={activeId === t.id}
              style={{ background: "transparent", border: "none", cursor: "pointer" }}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="ml-auto flex items-center gap-3">
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase font-semibold"
          style={{
            color: "var(--success)",
            border: "1px solid var(--rule)",
            borderRadius: "999px",
            letterSpacing: "0.12em",
            fontFamily: "var(--sbe-font-label)",
          }}
        >
          <span
            className="sbe-live-dot rounded-full"
            style={{ width: 5, height: 5, background: "var(--success)" }}
          />
          5 today
        </span>
        <NotificationsBell hasNew />
        <button className="sbe-avatar" aria-label="Account" />
      </div>
    </nav>
  );
}

function NotificationsBell({ hasNew }: { hasNew?: boolean }) {
  return (
    <button
      type="button"
      className="sbe-icon-btn"
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
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--accent)",
            border: "2px solid var(--bg-elevated)",
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
        style={{ borderTop: "1px solid var(--rule)" }}
      >
        <TypeRow
          label={<>Display<br /><span style={{ opacity: 0.6 }}>Fraunces</span></>}
        >
          <div
            className="sbe-display"
            style={{
              fontSize: "clamp(36px, 4.5vw, 56px)",
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
            }}
          >
            Five briefs <em>worth your morning.</em>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] uppercase font-semibold"
            style={{
              color: "var(--ink-3)",
              letterSpacing: "0.16em",
              fontFamily: "var(--sbe-font-label)",
            }}
          >
            <span>Headlines · Section h2 · Pillar h3</span>
            <span>400 / 500 + italic</span>
          </div>
        </TypeRow>

        <TypeRow
          label={<>Body<br /><span style={{ opacity: 0.6 }}>Plus Jakarta Sans</span></>}
        >
          <p className="text-[18px] leading-[1.6] max-w-[60ch]">
            Briefly is a curated marketplace for vetted creators. New briefs publish daily at 09:00, paid in seven days, no bidding, no haggling, no chasing invoices.
          </p>
          <div
            className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] uppercase font-semibold"
            style={{
              color: "var(--ink-3)",
              letterSpacing: "0.16em",
              fontFamily: "var(--sbe-font-label)",
            }}
          >
            <span>Paragraphs · Card body · UI text</span>
            <span>400 / 500 / 600 / 700</span>
          </div>
        </TypeRow>

        <TypeRow
          label={<>Label<br /><span style={{ opacity: 0.6 }}>Plus Jakarta · tracked</span></>}
        >
          <div
            className="uppercase font-semibold flex flex-wrap gap-x-8 gap-y-2 text-[12px]"
            style={{ letterSpacing: "0.16em" }}
          >
            <span style={{ color: "var(--ink)" }}>Brief 047 · 4 200 kr</span>
            <span style={{ color: "var(--ink-3)" }}>Due 22 May</span>
            <span style={{ color: "var(--accent)" }}>Issue 47</span>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] uppercase font-semibold"
            style={{
              color: "var(--ink-3)",
              letterSpacing: "0.16em",
              fontFamily: "var(--sbe-font-label)",
            }}
          >
            <span>Labels · IDs · Metrics · Datestamps</span>
            <span>500 / 600 · sans-serif (replaces traditional mono)</span>
          </div>
        </TypeRow>

        <TypeRow label={<>Scale</>} last>
          <div className="space-y-2">
            <div
              className="sbe-display"
              style={{ fontSize: 56, fontWeight: 400, letterSpacing: "-0.025em" }}
            >
              56 / Display XL
            </div>
            <div
              className="sbe-display"
              style={{ fontSize: 40, fontWeight: 400, letterSpacing: "-0.02em" }}
            >
              40 / Display L
            </div>
            <div
              className="sbe-display"
              style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.018em" }}
            >
              28 / Display M
            </div>
            <div className="font-semibold" style={{ fontSize: 20, letterSpacing: "-0.012em" }}>
              20 / Heading
            </div>
            <div style={{ fontSize: 16 }}>16 / Body</div>
            <div style={{ fontSize: 14, color: "var(--ink-2)" }}>14 / Body S</div>
            <div
              className="uppercase font-semibold"
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                letterSpacing: "0.16em",
              }}
            >
              11 / Label
            </div>
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
        className="text-[11px] uppercase font-semibold py-6 self-start"
        style={{
          color: "var(--ink-3)",
          letterSpacing: "0.16em",
          fontFamily: "var(--sbe-font-label)",
          borderBottom: last ? "none" : "1px solid var(--rule)",
        }}
      >
        {label}
      </div>
      <div
        className="py-6"
        style={{ borderBottom: last ? "none" : "1px solid var(--rule)" }}
      >
        {children}
      </div>
    </>
  );
}

/* ────────────── Label/structural type comparison ────────────── */

function MonoComparison() {
  const fonts: {
    name: string;
    subtitle: string;
    family: string;
    transform?: "uppercase" | "none";
    tracking?: string;
    current?: boolean;
  }[] = [
    {
      name: "Plus Jakarta Sans + tracking",
      subtitle: "current · sans-serif uppercase, the editorial label voice",
      family: "var(--sbe-font-label)",
      transform: "uppercase",
      tracking: "0.16em",
      current: true,
    },
    {
      name: "Fraunces (small caps)",
      subtitle: "serif label · pairs natively with display, slightly soft",
      family: "var(--sbe-font-display)",
      transform: "uppercase",
      tracking: "0.12em",
    },
    {
      name: "JetBrains Mono",
      subtitle: "true mono · for those who want the technical voice back",
      family: "ui-monospace, 'JetBrains Mono', monospace",
      transform: "uppercase",
      tracking: "0.10em",
    },
    {
      name: "Geist Mono",
      subtitle: "alternate mono · narrower, modern neutral",
      family: "ui-monospace, 'Geist Mono', monospace",
      transform: "uppercase",
      tracking: "0.10em",
    },
    {
      name: "Clear Sans",
      subtitle: "alternate sans · neutral, very legible at small sizes",
      family: "'Clear Sans', system-ui, sans-serif",
      transform: "uppercase",
      tracking: "0.14em",
    },
  ];

  return (
    <section>
      <SectionLabel>Label/structural type</SectionLabel>
      <p
        className="mt-4 mb-6 max-w-[60ch] text-[14px]"
        style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
      >
        Editorial reframes the &quot;mono&quot; role. Same UI strings rendered in five candidate label families at the sizes the platform actually uses (11–13px, uppercase, with tracking). Compare glyph shapes vertically — &quot;047&quot;, &quot;0&quot; vs &quot;O&quot;, &quot;1&quot; vs &quot;l&quot;, the dot separator.
      </p>

      <div
        className="overflow-hidden"
        style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)" }}
      >
        {/* Header row */}
        <div
          className="grid items-center px-5 py-3 text-[11px] uppercase font-semibold"
          style={{
            gridTemplateColumns: "minmax(220px, 1.2fr) minmax(0, 2fr) minmax(0, 1.4fr)",
            color: "var(--ink-3)",
            background: "var(--bg-2)",
            borderBottom: "1px solid var(--rule)",
            letterSpacing: "0.16em",
            fontFamily: "var(--sbe-font-label)",
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
              borderBottom: i < fonts.length - 1 ? "1px solid var(--rule-soft)" : "none",
              background: "var(--bg-elevated)",
            }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-[14px]">{f.name}</span>
                {f.current && (
                  <span
                    className="px-1.5 py-0.5 text-[10px] uppercase font-semibold"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      border: "1px solid var(--accent-muted)",
                      borderRadius: "999px",
                      letterSpacing: "0.12em",
                    }}
                  >
                    current
                  </span>
                )}
              </div>
              <div
                className="text-[12px] mt-0.5"
                style={{ color: "var(--ink-3)", lineHeight: 1.4 }}
              >
                {f.subtitle}
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-[11px] font-semibold"
                style={{
                  fontFamily: f.family,
                  color: "var(--ink)",
                  letterSpacing: f.tracking,
                  textTransform: f.transform,
                }}
              >
                <span>Brief 047</span>
                <span style={{ color: "var(--ink-3)" }}>·</span>
                <span>Due 22 May</span>
                <span style={{ color: "var(--ink-3)" }}>·</span>
                <span>Issue 47</span>
                <span style={{ color: "var(--ink-3)" }}>·</span>
                <span>08.05.2026</span>
              </div>
              <div
                className="mt-2 text-[11px] font-medium"
                style={{
                  fontFamily: f.family,
                  color: "var(--ink-2)",
                  letterSpacing: f.tracking,
                  textTransform: f.transform,
                }}
              >
                Average payout · 3 800 kr · 7 days · 340 creators
              </div>
            </div>

            <div className="min-w-0">
              <div
                className="text-[13px]"
                style={{ fontFamily: f.family, color: "var(--ink)", lineHeight: 1.4 }}
              >
                Brief 047 · 4 200 kr
              </div>
              <div
                className="mt-1 text-[13px]"
                style={{ fontFamily: f.family, color: "var(--ink-2)", lineHeight: 1.4 }}
              >
                Illegal/legible: 0Oo · 1lI · ()[]{}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 text-[11px] uppercase font-semibold"
        style={{
          color: "var(--ink-3)",
          letterSpacing: "0.16em",
          fontFamily: "var(--sbe-font-label)",
        }}
      >
        Tell me which to adopt and I&apos;ll swap <span style={{ color: "var(--ink)" }}>--sbe-font-label</span> + update the typography row.
      </div>
    </section>
  );
}

/* ────────────── Spec strip — editorial stat card ────────────── */

function SpecStrip() {
  const stats = [
    { label: "Briefs claimed", value: "7", unit: "" },
    { label: "Awaiting payout", value: "12 400", unit: "kr" },
    { label: "Paid out", value: "8 600", unit: "kr" },
    { label: "Acceptance rate", value: "94", unit: "%" },
  ];
  return (
    <section className="sbe-rise sbe-rise-4">
      <SectionLabel count="This month">Spec strip</SectionLabel>
      <div className="mt-5 sbe-card p-7 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
          {stats.map((s) => (
            <div key={s.label} className="sbe-stat">
              <span
                className="text-[13px]"
                style={{ color: "var(--ink-3)" }}
              >
                {s.label}
              </span>
              <span
                className="sbe-display"
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  letterSpacing: "-0.012em",
                  color: "var(--ink)",
                }}
              >
                {s.value}
                {s.unit && (
                  <span
                    className="ml-1 text-[13px] font-medium"
                    style={{
                      color: "var(--ink-3)",
                      fontFamily: "var(--sbe-font-body)",
                      letterSpacing: 0,
                    }}
                  >
                    {s.unit}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
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

const STATUS_CONFIG: Record<StatusKind, { label: string; color: string; pulse?: boolean }> = {
  live: { label: "Live", color: "var(--success)", pulse: true },
  claimed: { label: "Claimed", color: "var(--accent)" },
  review: { label: "Under review", color: "var(--warning)" },
  approved: { label: "Approved", color: "var(--success)" },
  rejected: { label: "Rejected", color: "var(--error)" },
  expired: { label: "Expired", color: "var(--ink-3)" },
  paid: { label: "Paid", color: "var(--success)" },
  refunded: { label: "Refunded", color: "var(--ink-3)" },
};

function StatusBadge({ status }: { status: StatusKind }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] uppercase font-semibold"
      style={{
        border: "1px solid var(--rule)",
        borderRadius: "999px",
        padding: "4px 10px",
        color: "var(--ink)",
        letterSpacing: "0.12em",
        fontFamily: "var(--sbe-font-label)",
      }}
    >
      <span
        className={c.pulse ? "sbe-live-dot" : ""}
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: c.color,
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
      <div className="flex flex-wrap gap-2 mt-5">
        {all.map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>
    </section>
  );
}

/* ────────────── Numbered brief list (editorial signature) ────────────── */

function BriefList() {
  const items: {
    num: string;
    title: string;
    body: string;
    meta: string[];
    pay: string;
    when: string;
  }[] = [
    {
      num: "01",
      title: "Bouldering gym launch — short-form video, Aarhus",
      body: "Three 30-second cuts for opening week. Vertical, native sound, no voiceover required. Brand has full creative trust.",
      meta: ["Video", "3 deliverables", "Due 22 May"],
      pay: "4 200 kr",
      when: "on delivery",
    },
    {
      num: "02",
      title: "Coffee roaster — product photography, in-studio",
      body: "Eight hero shots for a single-origin launch. Natural light preferred. Half-day shoot, props provided.",
      meta: ["Photo", "8 images", "Due 18 May"],
      pay: "2 800 kr",
      when: "on delivery",
    },
    {
      num: "03",
      title: "Wellness brand — long-form Instagram reel",
      body: "Sixty seconds, voiceover scripted by client. Shoot in natural daylight, talent provided on location.",
      meta: ["Video", "1 reel", "Due 25 May"],
      pay: "3 500 kr",
      when: "on delivery",
    },
    {
      num: "04",
      title: "Independent magazine — editorial portrait",
      body: "Single subject, single location. Final selection of six frames in colour and black and white. Print rights only.",
      meta: ["Photo", "6 images", "Due 28 May"],
      pay: "1 900 kr",
      when: "on delivery",
    },
    {
      num: "05",
      title: "Restaurant opening — behind-the-scenes documentary",
      body: "One full evening of service. Two-minute edit, plus raw selects. Subject is comfortable on camera.",
      meta: ["Video", "1 film + selects", "Due 02 Jun"],
      pay: "6 800 kr",
      when: "on delivery",
    },
  ];

  return (
    <section>
      <SectionLabel count="5 available">Open briefs</SectionLabel>
      <div className="mt-2 sbe-list">
        {items.map((item) => (
          <button key={item.num} type="button" className="sbe-list-row">
            <span className="sbe-list-num">{item.num}</span>
            <span className="min-w-0">
              <h3
                className="sbe-display mb-2"
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: "-0.015em",
                }}
              >
                {item.title}
              </h3>
              <p
                className="text-[14px]"
                style={{ color: "var(--ink-3)", lineHeight: 1.55, maxWidth: 520 }}
              >
                {item.body}
              </p>
              <span
                className="flex flex-wrap gap-3 mt-3.5 text-[12px]"
                style={{ color: "var(--ink-3)" }}
              >
                {item.meta.map((m, i) => (
                  <span
                    key={m}
                    style={{
                      paddingRight: 12,
                      borderRight:
                        i < item.meta.length - 1 ? "1px solid var(--rule)" : "none",
                    }}
                  >
                    {m}
                  </span>
                ))}
              </span>
            </span>
            <span className="text-right">
              <span
                className="sbe-display block"
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: "-0.012em",
                }}
              >
                {item.pay}
              </span>
              <span
                className="block text-[12px] mt-1"
                style={{ color: "var(--ink-3)" }}
              >
                {item.when}
              </span>
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
      <div className="mt-5 sbe-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            data-active={active === t.id}
            onClick={() => setActive(t.id)}
            className="sbe-tab"
          >
            {t.label}{" "}
            <span
              className="sbe-display ml-1.5"
              style={{
                color: "var(--ink-3)",
                fontSize: 13,
                fontStyle: "italic",
                fontWeight: 400,
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
        <span
          className="sbe-tab-indicator"
          style={{
            width: `${100 / tabs.length}%`,
            transform: `translateX(${idx * 100}%)`,
          }}
          aria-hidden
        />
      </div>
      <div className="mt-6 text-[14px]" style={{ color: "var(--ink-2)" }}>
        Showing <strong style={{ color: "var(--ink)" }}>{active}</strong> briefs.
      </div>
    </section>
  );
}

/* ────────────── Brief sample cards ────────────── */

function BriefSample() {
  const cards = [
    {
      id: "Brief 047",
      type: "Video",
      title: "Bouldering gym launch — 3× short-form video",
      body: "Three vertical cuts, native sound, no voiceover. Aarhus.",
      pay: "4 200 kr",
      due: "22 May",
    },
    {
      id: "Brief 046",
      type: "Photo",
      title: "Coffee roaster, single-origin launch",
      body: "Eight hero shots. Half-day, in-studio, props provided.",
      pay: "2 800 kr",
      due: "18 May",
    },
    {
      id: "Brief 043",
      type: "Video · Doc",
      title: "Restaurant opening — behind the scenes",
      body: "One full evening of service. Two-minute edit plus selects.",
      pay: "6 800 kr",
      due: "02 Jun",
    },
  ];
  return (
    <section>
      <div
        className="flex items-end justify-between pb-5 mb-6"
        style={{ borderBottom: "1px solid var(--rule)" }}
      >
        <h2
          className="sbe-display"
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          A taste of <em>today&apos;s feed.</em>
        </h2>
        <span
          className="text-[11px] uppercase font-semibold"
          style={{
            color: "var(--ink-3)",
            letterSpacing: "0.16em",
            fontFamily: "var(--sbe-font-label)",
          }}
        >
          5 live
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <article
            key={c.id}
            className="sbe-card flex flex-col cursor-pointer"
            style={{ padding: "26px 24px", minHeight: 240 }}
          >
            <div
              className="flex items-center justify-between mb-4 text-[11px] uppercase font-semibold"
              style={{
                color: "var(--ink-3)",
                letterSpacing: "0.14em",
                fontFamily: "var(--sbe-font-label)",
              }}
            >
              <span style={{ color: "var(--ink-2)" }}>{c.id}</span>
              <span
                className="px-2 py-0.5"
                style={{
                  border: "1px solid var(--rule)",
                  borderRadius: "999px",
                  color: "var(--ink-2)",
                }}
              >
                {c.type}
              </span>
            </div>
            <h3
              className="sbe-display mb-2"
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.018em",
                lineHeight: 1.2,
              }}
            >
              {c.title}
            </h3>
            <p
              className="text-[14px] mb-auto"
              style={{ color: "var(--ink-3)", lineHeight: 1.55 }}
            >
              {c.body}
            </p>
            <div
              className="flex items-center justify-between pt-5 mt-5"
              style={{ borderTop: "1px solid var(--rule-soft)" }}
            >
              <span
                className="sbe-display"
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  letterSpacing: "-0.012em",
                  color: "var(--ink)",
                }}
              >
                {c.pay}
              </span>
              <span
                className="sbe-display italic text-[12px]"
                style={{
                  color: "var(--ink-3)",
                  fontWeight: 400,
                }}
              >
                Due {c.due}
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
  return "var(--accent)";
}

function ClaimedBriefSection({ fire }: { fire: (t: ToastTone, m: string) => void }) {
  const cards: ClaimedBrief[] = [
    {
      id: "Brief 047",
      type: "Video",
      title: "Bouldering gym launch — 3× short-form video",
      body: "Three vertical cuts, native sound, no voiceover. Aarhus.",
      pay: "4 200 kr",
      timeLeft: "6d left",
      due: "22 May",
      urgency: "calm",
    },
    {
      id: "Brief 046",
      type: "Photo",
      title: "Coffee roaster, single-origin launch",
      body: "Eight hero shots. Half-day, in-studio, props provided.",
      pay: "2 800 kr",
      timeLeft: "2d left",
      due: "18 May",
      urgency: "warning",
    },
    {
      id: "Brief 043",
      type: "Video · Doc",
      title: "Restaurant opening — behind the scenes",
      body: "One full evening of service. Two-minute edit plus selects.",
      pay: "6 800 kr",
      timeLeft: "8h left",
      due: "Tomorrow",
      urgency: "critical",
    },
  ];

  return (
    <section>
      <SectionLabel>Claimed brief</SectionLabel>
      <p
        className="mt-4 mb-6 max-w-[60ch] text-[14px]"
        style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
      >
        Same shape as an open brief — just tinted, with a small Claimed pill and an inline countdown that goes amber under 3 days, red under 24 hours.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    <article
      className="sbe-card sbe-card-claimed flex flex-col"
      style={{ padding: "26px 24px" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-[11px] uppercase font-semibold"
          style={{
            color: "var(--ink-3)",
            letterSpacing: "0.14em",
            fontFamily: "var(--sbe-font-label)",
          }}
        >
          <span style={{ color: "var(--ink-2)" }}>{brief.id}</span>
          <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span>
          <span>{brief.type}</span>
        </div>
        <ClaimedPill />
      </div>

      <h3
        className="sbe-display mb-2"
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.018em",
          lineHeight: 1.2,
        }}
      >
        {brief.title}
      </h3>

      <p
        className="text-[14px] mb-auto"
        style={{ color: "var(--ink-3)", lineHeight: 1.55 }}
      >
        {brief.body}
      </p>

      <div
        className="flex items-end justify-between gap-3 pt-5 mt-5"
        style={{ borderTop: "1px solid var(--rule-soft)" }}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="sbe-display"
            style={{
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: "-0.012em",
              color: "var(--ink)",
              lineHeight: 1,
            }}
          >
            {brief.pay}
          </span>
          <span className="text-[12px] truncate">
            <span style={{ color, fontWeight: 600 }}>{brief.timeLeft}</span>
            <span style={{ color: "var(--ink-3)", margin: "0 6px" }}>·</span>
            <span
              className="uppercase font-semibold"
              style={{
                color: "var(--ink-3)",
                letterSpacing: "0.12em",
              }}
            >
              Due {brief.due}
            </span>
          </span>
        </div>
        <Button
          variant="primary"
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
      className="inline-flex items-center gap-1.5 text-[10px] uppercase font-semibold"
      style={{
        border: "1px solid var(--accent-muted)",
        borderRadius: "999px",
        padding: "3px 8px",
        color: "var(--accent)",
        letterSpacing: "0.14em",
        fontFamily: "var(--sbe-font-label)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: "var(--accent)",
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
        variant="accent"
        tag="For creators"
        title={
          <>
            Steady briefs.
            <br />
            <em>Predictable pay.</em>
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
            <em>Get the work.</em>
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
  variant: "accent" | "surface";
  tag: string;
  title: React.ReactNode;
  body: string;
  items: string[];
  priceLabel: string;
  priceSub: string;
  cta: string;
}) {
  const isAccent = variant === "accent";
  return (
    <div
      className="flex flex-col"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--rule)",
        borderRadius: "var(--r-lg)",
        padding: "40px 36px",
        minHeight: 460,
      }}
    >
      <span
        className="self-start text-[11px] uppercase font-semibold mb-7"
        style={{
          color: isAccent ? "var(--accent)" : "var(--ink-3)",
          letterSpacing: "0.18em",
          fontFamily: "var(--sbe-font-label)",
        }}
      >
        {tag}
      </span>
      <h3
        className="sbe-display mb-4"
        style={{
          fontSize: 36,
          fontWeight: 400,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
        }}
      >
        {title}
      </h3>
      <p
        className="text-[15px] mb-7"
        style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
      >
        {body}
      </p>
      <ul className="mb-8">
        {items.map((it, i) => (
          <li
            key={i}
            className="py-3 text-[14px]"
            style={{
              color: "var(--ink)",
              borderBottom:
                i < items.length - 1 ? "1px solid var(--rule-soft)" : "none",
            }}
          >
            {it}
          </li>
        ))}
      </ul>
      <div
        className="mt-auto flex items-center justify-between gap-4 pt-6"
        style={{ borderTop: "1px solid var(--rule)" }}
      >
        <div
          className="text-[13px]"
          style={{ color: "var(--ink-3)" }}
        >
          <strong
            className="sbe-display block mb-0.5"
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.012em",
              color: "var(--ink)",
            }}
          >
            {priceLabel}
          </strong>
          {priceSub}
        </div>
        <Button variant={isAccent ? "accent" : "primary"} trailingArrow>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
        <Field label="Brief title">
          <input
            type="text"
            className="sbe-input"
            placeholder="e.g. Coffee roaster launch"
            defaultValue="Bouldering gym launch"
          />
        </Field>
        <Field label="Brief type">
          <select className="sbe-input" defaultValue="Video">
            <option>Photo</option>
            <option>Video</option>
            <option>Motion</option>
            <option>Copy</option>
          </select>
        </Field>
        <Field label="Description" full>
          <textarea
            className="sbe-input"
            rows={3}
            placeholder="What needs to be made..."
            defaultValue="Three vertical cuts, native sound, no voiceover. Full creative trust."
          />
        </Field>
        <Field label="Payout (kr)">
          <input type="number" className="sbe-input" defaultValue={4200} />
        </Field>
        <Field label="Due date">
          <input type="date" className="sbe-input" defaultValue="2026-05-22" />
        </Field>
        <div
          className="sm:col-span-2 flex items-center justify-between gap-4 px-5 py-4"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-md)",
          }}
        >
          <div>
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Notify roster on publish
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              Email creators that match this brief&apos;s skill tags.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notify}
            data-on={notify}
            onClick={() => setNotify((v) => !v)}
            className="sbe-switch shrink-0"
          >
            <span className="sbe-switch-thumb" aria-hidden />
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
      <span
        className="text-[11px] uppercase font-semibold"
        style={{
          color: "var(--ink-3)",
          letterSpacing: "0.14em",
          fontFamily: "var(--sbe-font-label)",
        }}
      >
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
      <div className="flex flex-wrap gap-3 mt-5">
        <Button variant="ghost" onClick={() => confirmRef.current?.showModal()}>
          Open confirm
        </Button>
        <Button variant="ghost" onClick={() => headsUpRef.current?.showModal()}>
          Open heads-up
        </Button>
      </div>

      <dialog
        ref={confirmRef}
        className="sbe-dialog"
        onClick={(e) => {
          if (e.target === confirmRef.current) confirmRef.current?.close();
        }}
      >
        <div className="sbe-dialog-panel" onClick={(e) => e.stopPropagation()}>
          <div
            className="text-[11px] uppercase font-semibold mb-3"
            style={{
              color: "var(--error)",
              letterSpacing: "0.18em",
              fontFamily: "var(--sbe-font-label)",
            }}
          >
            Destructive
          </div>
          <h3
            className="sbe-display mb-3"
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.022em",
              lineHeight: 1.1,
            }}
          >
            Archive this brief?
          </h3>
          <p
            className="text-[15px] mb-7"
            style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
          >
            Any unfilled slots will be refunded. In-progress claims stay open until they expire. This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => confirmRef.current?.close()}>
              Cancel
            </Button>
            <button
              type="button"
              className="sbe-btn sbe-btn-sm"
              style={{
                background: "var(--error)",
                color: "var(--bg-elevated)",
                border: "1px solid var(--error)",
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
        className="sbe-dialog"
        onClick={(e) => {
          if (e.target === headsUpRef.current) headsUpRef.current?.close();
        }}
      >
        <div className="sbe-dialog-panel" onClick={(e) => e.stopPropagation()}>
          <div
            className="text-[11px] uppercase font-semibold mb-3"
            style={{
              color: "var(--warning)",
              letterSpacing: "0.18em",
              fontFamily: "var(--sbe-font-label)",
            }}
          >
            Heads up
          </div>
          <h3
            className="sbe-display mb-3"
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: "-0.022em",
              lineHeight: 1.1,
            }}
          >
            Publishing will <em>charge escrow.</em>
          </h3>
          <p
            className="text-[15px] mb-7"
            style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
          >
            Publishing this brief charges{" "}
            <strong style={{ color: "var(--ink)" }}>4 200 kr × 3 slots = 12 600 kr</strong>{" "}
            from your saved card. Funds release to creators on approval.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={publishing}
              onClick={() => headsUpRef.current?.close()}
            >
              Not yet
            </Button>
            <Button
              variant="primary"
              size="sm"
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

/* ────────────── Toasts ────────────── */

function ToastSection({ fire }: { fire: (t: ToastTone, m: string) => void }) {
  return (
    <section>
      <SectionLabel>Toasts</SectionLabel>
      <div className="flex flex-wrap gap-3 mt-5">
        <Button variant="ghost" onClick={() => fire("default", "Brief saved as draft")}>
          Default toast
        </Button>
        <Button variant="ghost" onClick={() => fire("success", "Payout released to creator")}>
          Success
        </Button>
        <Button variant="ghost" onClick={() => fire("error", "Payment method declined")}>
          Error
        </Button>
      </div>
      <p className="mt-3 text-[12px]" style={{ color: "var(--ink-3)" }}>
        Toasts appear at bottom-right of the viewport. Themed with editorial tokens, so they crossfade with the theme toggle.
      </p>
    </section>
  );
}

function ToastStack({ toasts }: { toasts: SbToast[] }) {
  return (
    <div className="sbe-toast-stack" aria-live="polite">
      {toasts.map((t) => {
        const accent =
          t.tone === "success"
            ? "var(--success)"
            : t.tone === "error"
              ? "var(--error)"
              : "var(--accent)";
        return (
          <div
            key={t.id}
            className="sbe-toast"
            data-leaving={t.leaving}
            style={{ borderLeftColor: accent }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
              style={{ background: accent }}
            />
            <span
              className="text-[14px]"
              style={{ color: "var(--ink)", lineHeight: 1.4 }}
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
        className="mt-4 mb-6 max-w-[60ch] text-[14px]"
        style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
      >
        8-leaf radial spinner, 0.85s linear cycle. A faster spinner perceptually = a faster app. Inherits <span style={{ color: "var(--ink)" }}>currentColor</span> so it picks up whatever text color sits around it.
      </p>

      {/* Sizes */}
      <SubLabel>Size scale</SubLabel>
      <div
        className="flex flex-wrap items-end gap-8 px-5 py-6"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
        }}
      >
        {[12, 14, 16, 20, 24, 32, 40].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2.5">
            <Spinner size={s} />
            <span
              className="text-[10.5px] uppercase font-semibold"
              style={{
                color: "var(--ink-3)",
                letterSpacing: "0.12em",
                fontFamily: "var(--sbe-font-label)",
              }}
            >
              {s}px
            </span>
          </div>
        ))}
      </div>

      {/* In button */}
      <SubLabel className="mt-7">In button · click to simulate</SubLabel>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="primary"
          disabled={paying}
          onClick={() => {
            simulate(setPaying, () => fire("success", "Payment processed · 12 600 kr held in escrow"));
          }}
        >
          {paying && <Spinner size={14} data-icon="inline-start" />}
          {paying ? "Processing payment…" : "Pay 12 600 kr"}
        </Button>
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => {
            simulate(setSaving, () => fire("default", "Draft saved"));
          }}
        >
          {saving && <Spinner size={14} data-icon="inline-start" />}
          {saving ? "Saving…" : "Save draft"}
        </Button>
        <Button
          variant="naked"
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
      <SubLabel className="mt-7">Inline · alongside text</SubLabel>
      <div
        className="flex items-center gap-2.5 px-4 py-3 text-[14px]"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-md)",
          color: "var(--ink-2)",
        }}
      >
        <Spinner size={14} />
        <span>Fetching today&apos;s briefs…</span>
      </div>

      {/* Card overlay */}
      <SubLabel className="mt-7">Card · processing payment</SubLabel>
      <div
        className="relative px-7 py-7 overflow-hidden"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--rule)",
          borderRadius: "var(--r-lg)",
        }}
      >
        <div
          className="transition-opacity duration-200"
          style={{ opacity: cardLoading ? 0.4 : 1 }}
        >
          <div
            className="text-[11px] uppercase font-semibold mb-2"
            style={{
              color: "var(--ink-3)",
              letterSpacing: "0.16em",
              fontFamily: "var(--sbe-font-label)",
            }}
          >
            Brief 047 · publish
          </div>
          <h3
            className="sbe-display mb-2"
            style={{
              fontSize: 24,
              fontWeight: 500,
              letterSpacing: "-0.018em",
              lineHeight: 1.15,
            }}
          >
            Charge 12 600 kr from Visa ··· 4242
          </h3>
          <p
            className="text-[14px] mb-5"
            style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
          >
            Funds release to creators on approval. Unfilled slots refund automatically when the brief expires.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={cardLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
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
              background: "color-mix(in oklab, var(--bg-elevated) 75%, transparent)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
            aria-live="polite"
          >
            <div className="flex flex-col items-center gap-3">
              <Spinner size={28} />
              <div
                className="text-[11px] uppercase font-semibold"
                style={{
                  color: "var(--ink-2)",
                  letterSpacing: "0.18em",
                  fontFamily: "var(--sbe-font-label)",
                }}
              >
                Processing payment…
              </div>
            </div>
          </div>
        )}
      </div>

      <p
        className="mt-3 text-[11px] uppercase font-semibold"
        style={{
          color: "var(--ink-3)",
          letterSpacing: "0.16em",
          fontFamily: "var(--sbe-font-label)",
        }}
      >
        Tip · spinner color follows currentColor. Primary buttons → bg paper; ghost buttons → ink.
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
      className={`text-[11px] uppercase font-semibold mb-3 ${className}`}
      style={{
        color: "var(--ink-3)",
        letterSpacing: "0.16em",
        fontFamily: "var(--sbe-font-label)",
      }}
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
      <div className="mt-5 sbe-empty">
        <div
          className="mx-auto mb-5 grid place-items-center"
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--r-md)",
            border: "1px dashed var(--rule)",
            color: "var(--ink-3)",
          }}
          aria-hidden
        >
          <span
            className="sbe-display"
            style={{ fontSize: 24, fontWeight: 400, lineHeight: 1 }}
          >
            ∅
          </span>
        </div>
        <h3
          className="sbe-display mb-2"
          style={{
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "-0.018em",
            lineHeight: 1.15,
          }}
        >
          No briefs yet
        </h3>
        <p
          className="text-[14px] max-w-[44ch] mx-auto mb-6"
          style={{ color: "var(--ink-2)", lineHeight: 1.6 }}
        >
          New briefs publish at 09:00 every weekday. You can also browse past briefs while you wait.
        </p>
        <Button variant="primary" trailingArrow>
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
      <div className="mt-5 space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="grid items-center gap-4 px-4 py-3"
            style={{
              gridTemplateColumns: "60px 1fr 100px 80px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--rule)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div className="sbe-skel" style={{ height: 12 }} />
            <div className="sbe-skel" style={{ height: 14 }} />
            <div className="sbe-skel" style={{ height: 12 }} />
            <div className="sbe-skel" style={{ height: 22, borderRadius: "999px" }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────── Buttons row ────────────── */

function ButtonsRow() {
  return (
    <section className="space-y-5">
      <SectionLabel>Buttons</SectionLabel>
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="primary">Primary ink</Button>
        <Button variant="primary" trailingArrow>
          Primary with arrow
        </Button>
        <Button variant="accent">Accent terracotta</Button>
        <Button variant="accent" trailingArrow>
          Accent with arrow
        </Button>
        <Button variant="ghost">Ghost outline</Button>
        <Button variant="naked">Naked text</Button>
        <Button variant="naked" trailingArrow>
          Naked with arrow
        </Button>
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
        { name: "--bg-elevated", value: "var(--bg-elevated)" },
        { name: "--bg-2", value: "var(--bg-2)" },
        { name: "--rule", value: "var(--rule)" },
        { name: "--rule-soft", value: "var(--rule-soft)" },
      ],
    },
    {
      label: "Text",
      tokens: [
        { name: "--ink", value: "var(--ink)" },
        { name: "--ink-2", value: "var(--ink-2)" },
        { name: "--ink-3", value: "var(--ink-3)" },
      ],
    },
    {
      label: "Signal",
      tokens: [
        { name: "--accent", value: "var(--accent)" },
        { name: "--success", value: "var(--success)" },
        { name: "--warning", value: "var(--warning)" },
        { name: "--error", value: "var(--error)" },
      ],
    },
  ];
  return (
    <section className="space-y-6 pb-16">
      <SectionLabel>Tokens</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map((g) => (
          <div key={g.label}>
            <div
              className="text-[11px] uppercase font-semibold mb-3"
              style={{
                color: "var(--ink-3)",
                letterSpacing: "0.16em",
                fontFamily: "var(--sbe-font-label)",
              }}
            >
              {g.label}
            </div>
            <div
              className="overflow-hidden"
              style={{ border: "1px solid var(--rule)", borderRadius: "var(--r-md)" }}
            >
              {g.tokens.map((t, i) => (
                <div
                  key={t.name}
                  className="flex items-center gap-3 px-3 py-2.5 text-[13px]"
                  style={{
                    borderTop: i > 0 ? "1px solid var(--rule-soft)" : "none",
                    background: "var(--bg-elevated)",
                  }}
                >
                  <span
                    className="w-7 h-7 shrink-0"
                    style={{
                      background: t.value,
                      border: "1px solid var(--rule)",
                      borderRadius: "var(--r-sm)",
                    }}
                  />
                  <span style={{ color: "var(--ink)", fontWeight: 500 }}>{t.name}</span>
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
  variant = "primary",
  size = "default",
  trailingArrow = false,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "accent" | "naked";
  size?: "default" | "sm";
  trailingArrow?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const variantCls = `sbe-btn-${variant}`;
  const sizeCls = size === "sm" ? "sbe-btn-sm" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`sbe-btn ${variantCls} ${sizeCls}`.trim()}
    >
      {children}
      {trailingArrow && (
        <span className="sbe-arrow" aria-hidden>
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
      className={`sbe-spinner ${className}`.trim()}
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      {...props}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="sbe-spinner-leaf" aria-hidden />
      ))}
    </span>
  );
}

/* ────────────── Section label ────────────── */

function SectionLabel({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: string;
}) {
  return (
    <div
      className="sbe-section-label"
      style={{ fontFamily: "var(--sbe-font-label)" }}
    >
      <span>{children}</span>
      {count && <span className="count">{count}</span>}
    </div>
  );
}
