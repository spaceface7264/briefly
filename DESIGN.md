# DESIGN.md — Briefly

Design system reference. Consult this before any UI work. The source of truth for tokens is `src/app/globals.css`. This doc explains how to use them.

## Principles

- **Dark-first, theme-aware.** Every screen must work in both themes. Never reference raw hex in components.
- **Quiet by default, vivid on signal.** Surfaces are warm-neutral; brand cyan is reserved for identity, money, CTAs, and live status. Status colors are desaturated so the brand still pops.
- **Tokens over guesses.** If a value isn't in the token system, it doesn't belong in a component. Add a token before you add a magic color.
- **Sharper geometry, generous space.** 8px base radius, fluid type scale, lots of breathing room. Borders are real (not opacity tricks) so theme swaps stay crisp.
- **Motion has a reason.** Fade/stagger on enter, pulse on live state, view transitions across routes. Everything respects `prefers-reduced-motion`.

## Theming architecture

Two tiers, defined in `src/app/globals.css`:

- **Tier 1** (`@theme inline`): Tailwind utility names mapped to CSS variables. Components consume these. Example: `bg-surface`, `text-foreground`, `border-border-strong`.
- **Tier 2** (`:root` for dark, `[data-theme="light"]` for light): the real color values. Swapping themes is just a data attribute on `<html>`.

**Rule:** components reference tier 1 utilities only. If you find yourself writing `#09D7D7` or `bg-[#0E0E10]` in a component, stop and use the token.

Theme switching uses `document.startViewTransition` with a `theme-root` named transition (320ms cubic crossfade). Don't fight it with manual transitions on child elements.

## Color tokens

### Surfaces (four-tier elevation)

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg-background` | `#0E0E10` | `#F5F4F0` | Page background |
| `bg-surface` | `#161618` | `#EDECE6` | Cards, sidebar |
| `bg-surface-raised` | `#1D1D20` | `#E4E2DA` | Popovers, modals, raised tiles |
| `bg-surface-hover` | `#28282C` | `#D8D5CC` | Hover state on neutral surfaces |
| `border-border` | `#28282C` | `#D8D5CC` | Default border |
| `border-border-strong` | `#3D3D4A` | `#B5AFA0` | Emphasized border, hover targets |

### Text

| Token | Use |
|---|---|
| `text-foreground` | Primary text |
| `text-text-secondary` | Secondary text, body copy |
| `text-muted` | Captions, labels, helper text |
| `text-disabled` | Disabled state |

### Brand (cyan single-color system)

`#09D7D7` in both themes for fills. For **text on background**, use the `-ink` variant: vivid cyan in dark, darkened teal (`#0E7490`, AAA contrast) in light.

| Token | Use |
|---|---|
| `bg-brand` / `bg-brand-fill` | CTA fills, brand chips |
| `bg-brand-hover` | CTA hover |
| `text-brand-ink` | Brand text (theme-safe) |
| `bg-brand-muted` | Subtle brand-tinted background (12% alpha) |
| `bg-brand-soft` | Very subtle brand wash (6% alpha) |
| `text-on-brand` | Foreground color when sitting on a brand fill (dark teal `#0C1618`, ~12:1 contrast) |

`--accent` is an alias of `--brand`, kept for back-compat (pricing, money). Same rules apply.

**Never** use white text on the cyan brand — contrast fails. Always pair the brand fill with `text-on-brand`.

### Status

Desaturated so they coexist with brand. Each has a fill, an `-ink` (text-safe, AA on either theme), and a `-muted` (low-alpha tinted background).

| Family | Use |
|---|---|
| `info` (`#7B9EFF`) | Under review, neutral notices |
| `success` (`#22DB14` dark / `#49AF0E` light) | Live, approved, paid |
| `warning` (`#FBBF24`) | Caution, pending action |
| `error` (`#F87171`) | Destructive, rejected, failed |

Pattern for status pills/cards: `bg-{name}-muted text-{name}-ink border border-{name}-ink/20`.

## Typography

Fonts loaded by the root layout:

- `font-sans` — **Plus Jakarta Sans** (body, UI)
- `font-display` / `font-heading` — **Inter Tight** (display, large headings)
- `font-serif` — **Instrument Serif** (editorial accents)
- `font-mono` — **Clear Sans** (UI labels; not a real mono, chosen for legibility at small sizes)

Native form elements (`button`, `input`, `select`, `textarea`) are forced to `font-family: inherit` globally — utility classes for size/weight still work.

### Fluid scale

Use the Tailwind `text-*` utilities; values are `clamp()`-based and scale with viewport:

`text-xs` → `text-4xl`, defined in `@theme inline`.

### Numeric typography

For metrics, prices, counters: add `value-text`. It enables tabular + lining nums and a subtle negative tracking so columns of numbers align cleanly.

```tsx
<span className="value-text text-2xl text-brand-ink">{formatPrice(brief.price_dkk)}</span>
```

### Markdown content

`.prose-brief` styles long-form markdown (brief descriptions, etc.). Headings get foreground color, links use brand cyan with offset underline, inline code sits on `surface-raised`.

## Radii

Single root knob: `--radius: 0.5rem` (8px). Everything else is a multiple.

| Utility | Multiplier | px |
|---|---|---|
| `rounded-sm` | 0.6x | 4.8 |
| `rounded-md` | 0.8x | 6.4 |
| `rounded-lg` | 1.0x | 8 |
| `rounded-xl` | 1.4x | 11.2 |
| `rounded-2xl` | 1.8x | 14.4 |
| `rounded-3xl` | 2.2x | 17.6 |
| `rounded-4xl` | 2.6x | 20.8 |

Buttons are `rounded-full`. Cards default to `rounded-lg`. Modals to `rounded-2xl`.

## Focus

Global focus ring: 2px solid `--color-brand-pure`, 2px offset, 4px corner radius. It's set on `*:focus-visible` so every keyboard-focusable element gets it for free.

Opt out only when a control defines its own focus style (use `no-global-focus-ring`).

## Motion

- **Page transitions:** `@view-transition { navigation: auto }` — 200ms ease-out fade+translate between routes.
- **Stagger-in:** `animate-stagger-in` on a container fades its first 7 children in at 50ms steps. Use sparingly (list reveals, dashboards).
- **Status pulse:** `animate-status-pulse` for live indicators (success dot scaling + box-shadow ring).
- **Modals:** `dialog[open] > [data-modal-panel]` gets an 180ms cubic-bezier modal-in; backdrop crossfades at 150ms.
- **Spinner:** `.spinner` with 8 `.spinner-leaf` children. 0.85s linear (Emil's preference: snappier than 1s).
- **Theme switch:** uses view transitions, 320ms cubic. Don't add competing transitions on child elements during a theme swap.

All motion respects `prefers-reduced-motion: reduce` — animations collapse to a single frame.

## Components

shadcn/ui primitives live in `src/components/ui/`. Add new ones via the shadcn CLI; don't fork or copy-paste from docs. Compose, don't edit.

Currently in `ui/`: button, checkbox, dialog, dropdown-menu, input, pagination, separator, sheet, sidebar, skeleton, sonner, spinner, tooltip.

### Button

Built on `@base-ui/react/button`. `rounded-full`, height-based sizes.

| Variant | When |
|---|---|
| `default` | Primary CTA (cyan fill, dark text) |
| `outline` | Secondary action with stroke |
| `secondary` | Quiet alternate (raised surface) |
| `ghost` | Tertiary, sits in toolbars |
| `destructive` | Delete, archive, refund |
| `link` | Inline navigation |

Sizes: `xs` (h-6), `sm` (h-7), `default` (h-8), `lg` (h-9), plus `icon`, `icon-xs`, `icon-sm`, `icon-lg`. Buttons translate 1px on active for tactile feedback (skipped for `aria-haspopup` to avoid jitter on menu triggers).

### Brief card pattern

`src/components/brief-card.tsx` shows the category-accent pattern. Each category gets a soft tinted surface (`bg-{color}/5`) with a matching border (`border-{color}/15 hover:border-{color}/30`) and a colored status dot (`bg-{color}-ink`). Reuse this pattern for any taxonomy-tinted card.

For "user has claimed this" / active state on a card: `bg-brand-soft border-brand-ink/20 ring-1 ring-brand-ink/10`. Subtle, not loud.

### Loading skeletons

Each top-level route has a `loading.tsx` (`src/app/*/loading.tsx`, including `admin/(org)/**` and `profile/**`). Skeletons must be **page-shaped** — they should match the layout of the route they shadow so there's no flicker on hydration. Don't ship a route without one.

### Admin badges

`src/lib/admin-badge-tones.ts` centralizes badge styling for `BriefStatus`, `ClaimStatus`, `BriefDurationClass`, `BriefPlatform`, `BriefCategory`, `BriefFundedStatus`. Always import from here; don't roll your own status pill.

## Layout

- App shell uses the shadcn sidebar primitive. Sidebar background is `bg-sidebar` (= `bg-surface`), border is `border-sidebar-border`.
- `/admin` has split route groups: org shell `admin/(org)` and platform shell `admin/super`. Different navs, sibling layouts.
- The sidebar toggle lives inside the sidebar itself; there is no top page-header bar (removed in #58).

## Don'ts

- No em-dashes anywhere (covered in `CLAUDE.md`, restated here because copy is design).
- Don't reference raw hex values in components. Add a token if one is missing.
- Don't use white text on `bg-brand` / `bg-accent`. Use `text-on-brand`.
- Don't use vivid status colors as text on light theme without the `-ink` variant — contrast will fail.
- Don't add page-level transitions that compete with view transitions during nav.
- Don't fork files under `src/components/ui/`. Wrap or compose instead.
- Don't ship a new top-level route without a page-shaped `loading.tsx`.
- Don't reach for `font-mono` thinking it's a code font; in this app it's Clear Sans, optimized for UI labels.
- Don't write component-local animations longer than 320ms unless there's a specific narrative reason (modal entrance, theme swap).

## Adding new tokens

1. Add the real value to **tier 2** (`:root` for dark, `[data-theme="light"]` for light). Always define both.
2. Expose it as a Tailwind utility in **tier 1** (`@theme inline`) under a semantic name.
3. If it's a colored text on a tinted surface, also add an `-ink` variant in the light theme block, darkened to AA contrast on `--bg-2` cream.
4. Update this doc.
