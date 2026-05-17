# DESIGN.md, Briefly

Design system reference. Consult before any UI work. The source of truth for tokens is `src/app/globals.css`; this doc explains how to use them and where the system's opinions live.

## Principles

- **Dark-first, theme-aware.** Every screen must work in both themes. Never reference raw hex in components.
- **Quiet by default, vivid on signal.** Surfaces are warm-neutral; brand cyan is reserved for identity, money, CTAs, and live status. Status colors are desaturated so the brand still pops.
- **Tokens over guesses.** If a value isn't in the token system, it doesn't belong in a component. Add a token before you add a magic color.
- **Sharper geometry, generous space.** 8px base radius, fluid type scale, real borders (not opacity tricks), generous whitespace.
- **Motion has a reason.** Fade or stagger on enter, pulse on live state, view transitions across routes. Everything respects `prefers-reduced-motion`.

## Register & color strategy

Briefly's product surfaces sit in the **Restrained** lane: tinted neutrals carrying ~90% of the surface, with brand cyan as the single accent capped near ~10%. The cyan is the only color that's allowed to "shout" in product UI; status colors are kept desaturated so the cyan still reads as singular.

What this means in practice:

- Neutral surfaces, neutral borders, neutral text. The cyan appears on CTAs, prices, "you've claimed this" states, links inside prose, and live-status dots. Almost nothing else.
- Status hues (info, success, warning, error) are for **state**, not decoration. Don't tint a card warning-yellow because it looks nice; tint it because something requires attention.
- Marketing surfaces (the landing page, campaign content) can break the Restrained budget and go Committed. Product cannot.

**Anti-references** (what Briefly is not):

- Not the SaaS-cream-and-purple aesthetic of generic productivity tools.
- Not navy-and-gold fintech.
- Not neon-on-black crypto.
- Not the icon + heading + body card grid stamped down every page.

## Theming architecture

Two tiers, both defined in `src/app/globals.css`:

- **Tier 1** (`@theme inline`): Tailwind utility names mapped to CSS variables. Components consume these: `bg-surface`, `text-foreground`, `border-border-strong`.
- **Tier 2** (`:root` for dark, `[data-theme="light"]` for light): the real color values. Swapping themes is just a data attribute on `<html>`.

**Rule:** components reference tier 1 utilities only. If you're typing `#09D7D7` or `bg-[#0E0E10]` in a component, stop and use the token.

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

Don't go raised-on-raised more than once. Two tiers of elevation in a single composition is the cap; three reads as muddle.

### Text

| Token | Use |
|---|---|
| `text-foreground` | Primary text, headings, key values |
| `text-text-secondary` | Body copy, sentences |
| `text-muted` | Captions, labels, helper text, metadata |
| `text-disabled` | Disabled state only |

### Brand (cyan single-color system)

`#09D7D7` in both themes for fills. For **text on background**, use the `-ink` variant: vivid cyan in dark, darkened teal (`#0E7490`, AAA contrast) in light.

| Token | Use |
|---|---|
| `bg-brand` / `bg-brand-fill` | CTA fills, brand chips |
| `bg-brand-hover` | CTA hover |
| `text-brand-ink` | Brand text (theme-safe) |
| `bg-brand-muted` | Subtle brand-tinted background (12% alpha) |
| `bg-brand-soft` | Very subtle brand wash (6% alpha) |
| `text-on-brand` | Foreground color on a brand fill (dark teal `#0C1618`, ~12:1 contrast) |

`--accent` is an alias of `--brand`, kept for back-compat with pricing/money components.

**Never** use white text on the cyan brand: contrast fails (~1.6:1). Always pair the brand fill with `text-on-brand`.

### Status

Each family has a fill, an `-ink` (text-safe, AA on either theme), and a `-muted` (low-alpha tinted background).

| Family | Use |
|---|---|
| `info` (`#7B9EFF`) | Under review, neutral notices |
| `success` (`#22DB14` dark / `#49AF0E` light) | Live, approved, paid |
| `warning` (`#FBBF24`) | Caution, pending action |
| `error` (`#F87171`) | Destructive, rejected, failed |

Canonical pattern for status pills and cards:

```tsx
<span className="inline-flex items-center gap-1.5 rounded-full bg-warning-muted px-2 py-0.5 text-xs text-warning-ink ring-1 ring-warning-ink/20">
  <span className="size-1.5 rounded-full bg-warning-ink" />
  Pending review
</span>
```

For pre-built status taxonomy, import from `src/lib/admin-badge-tones.ts` rather than rolling your own.

## Typography

Fonts loaded by the root layout:

- `font-sans`, **Plus Jakarta Sans**, body and UI.
- `font-display` / `font-heading`, **Inter Tight**, display and large headings.
- `font-serif`, **Instrument Serif**, editorial accents (sparingly).
- `font-mono`, **Clear Sans**, UI labels. Not a real mono; chosen for legibility at small sizes.

Native form elements (`button`, `input`, `select`, `textarea`) are forced to `font-family: inherit` globally, so platform fonts apply but per-element size and weight utilities still work.

### Fluid scale

Use the Tailwind `text-*` utilities; values are `clamp()`-based and scale with viewport. `text-xs` through `text-4xl` are defined in `@theme inline`.

### Hierarchy (default mapping)

| Slot | Class | Notes |
|---|---|---|
| Page H1 | `font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground` | One per page. |
| Section H2 | `font-display text-xl sm:text-2xl font-semibold text-foreground` | |
| Sub-section H3 | `text-base font-semibold text-foreground` | Body font, not display. |
| Body | `text-sm sm:text-base text-text-secondary` | Cap at 65–75ch. |
| Meta / labels | `text-xs font-medium text-muted uppercase tracking-wide` | For section labels, table headers. |

Aim for at least a 1.25x ratio between consecutive sizes. Don't fake hierarchy with color alone; weight and scale do the work.

### Numeric typography

For metrics, prices, counters: add `value-text`. Enables tabular and lining numerals plus a subtle negative tracking so columns of numbers align.

```tsx
<span className="value-text text-2xl text-brand-ink">{formatPrice(brief.price_dkk)}</span>
```

### Markdown content

`.prose-brief` styles long-form markdown. Headings get foreground color, links use brand cyan with offset underline, inline code sits on `surface-raised`.

## Spacing & layout

The system has no spacing tokens beyond Tailwind's scale; the discipline is in **how** you use them.

- **Container widths.** Use `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` for primary content. `max-w-4xl` for forms and reading-width prose. `max-w-2xl` for single-column long-form. Don't wrap everything in a container; nav bars, full-bleed banners, and dashboard grids span edge-to-edge.
- **Vertical rhythm.** Page sections get `py-8 sm:py-12`; cards get `p-4` or `p-6` depending on density. Vary the values across the page; same padding everywhere reads as monotony.
- **Grid gaps.** Brief grids: `gap-3 sm:gap-4`. Dashboard tiles: `gap-4 sm:gap-6`. Tight clusters (chips, meta rows): `gap-1.5` or `gap-2`.
- **Don't nest cards.** A card inside a card is always wrong here. Drop the inner border and use spacing or a divider instead.

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

Buttons are `rounded-full`. Cards default to `rounded-lg`. Modals to `rounded-2xl`. Pills and chips to `rounded-full`. Avatars to `rounded-full`.

## Iconography

**Lucide React** (`lucide-react`) is the only icon library. Don't introduce alternatives.

- Default size: 16px (`size-4`) inside body text, 14px (`size-3.5`) inside `sm` buttons, 12px (`size-3`) inside `xs` buttons. Button primitive auto-sizes SVGs already; trust it.
- Strokes: leave at Lucide defaults (1.5px). Don't bump weight per-icon.
- Color: inherit `currentColor`. Don't set fill or stroke colors directly; let the surrounding `text-*` utility do it.
- Icons next to text get `gap-1.5` to `gap-2` from the parent flex container, not margins.

## Forms

The canonical labeled control:

```tsx
<label htmlFor="title" className="block text-sm font-medium mb-2">
  Title <span className="text-error">*</span>
</label>
<input
  id="title"
  className="h-8 w-full rounded-lg border border-border bg-transparent px-2.5 text-sm placeholder:text-muted focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/30 outline-none"
/>
```

Rules:

- Required fields get a `text-error` asterisk inside the label, not a separate "required" hint.
- Focus uses the global focus ring (`*:focus-visible` in CSS), except for compound inputs that own their own ring; those use `focus-within:border-brand focus-within:ring-1 focus-within:ring-brand` on the wrapper.
- Invalid state: `aria-invalid="true"` triggers a destructive border and ring via the shadcn `Input` primitive. Use that instead of toggling classes by hand.
- Helper text sits under the input at `text-xs text-muted`. Error text uses `text-xs text-error`, never both at once.
- Stack labels above inputs. No inline labels in this product; they read as legacy.

## Focus

Global focus ring: 2px solid `--color-brand-pure`, 2px offset, 4px corner radius, applied to `*:focus-visible`. Every keyboard-focusable element gets it for free.

Opt out only when a control owns its focus style. Add `no-global-focus-ring` to the element and define your own.

## Motion

Two named curves live in `globals.css` (currently scoped under `[data-sb]` but conceptually shared). Treat them as the system's curves:

| Token | Curve | Use |
|---|---|---|
| `--sb-ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Default. Enter, settle, hover, theme swap. |
| `--sb-ease-inout` | `cubic-bezier(0.77, 0, 0.175, 1)` | Symmetric transitions, rare. |

Stock motion vocabulary:

- **Page transitions.** `@view-transition { navigation: auto }`, 200ms ease-out fade with a small Y translate.
- **Stagger-in.** `animate-stagger-in` on a container fades its first 7 children in at 50ms steps. Use for list reveals and dashboards; not for every flex container.
- **Status pulse.** `animate-status-pulse` for live indicators: a success dot scales while a box-shadow ring fades outward.
- **Modals.** `dialog[open] > [data-modal-panel]` gets an 180ms `cubic-bezier(0.16, 1, 0.3, 1)` modal-in; backdrop crossfades 150ms.
- **Spinner.** `.spinner` with 8 `.spinner-leaf` children. 0.85s linear cycle (snappier than 1s on purpose).
- **Theme switch.** View transitions, 320ms cubic.

Rules:

- Don't animate CSS layout properties (`width`, `height`, `top`, `left`, `margin`). Use `transform` and `opacity`.
- Component-local animations cap at 320ms unless there's a narrative reason (modal entrance, theme swap).
- No bounce, no elastic. Ease out with exponential curves only.
- Respect `prefers-reduced-motion: reduce`; animations collapse to a single frame globally.

## Empty states

Empty lists are surfaces, not afterthoughts. The standard shape:

- A short, specific line of copy (`text-base text-text-secondary`), not "No data".
- One supporting line of secondary copy explaining why or what to do next (`text-sm text-muted`).
- An optional primary CTA (`Button variant="default"`) when there's an obvious next action.

Don't decorate with large illustrations. Don't center the empty state in a tiny card; let it breathe at section scale.

## Components

shadcn/ui primitives live in `src/components/ui/`. Add new ones via the shadcn CLI; don't fork or copy-paste from docs. Compose, don't edit.

Currently in `ui/`: `button`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `pagination`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `spinner`, `tooltip`.

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

Sizes: `xs` (h-6), `sm` (h-7), `default` (h-8), `lg` (h-9), plus `icon`, `icon-xs`, `icon-sm`, `icon-lg`. Buttons translate 1px on active for tactile feedback (skipped for `aria-haspopup` so menu triggers don't jitter).

One primary CTA per surface. If you feel two `variant="default"` buttons on a page, you've made the wrong call somewhere upstream.

### Brief card pattern

`src/components/brief-card.tsx` shows the category-accent pattern. Each category gets a soft tinted surface (`bg-{color}/5`), a matching border (`border-{color}/15 hover:border-{color}/30`), and a colored status dot (`bg-{color}-ink`). Reuse this pattern for any taxonomy-tinted card.

For "user has claimed this" / active state on a card: `bg-brand-soft border-brand-ink/20 ring-1 ring-brand-ink/10`. Subtle, not loud.

### Loading skeletons

Each top-level route has a `loading.tsx` under `src/app/*/loading.tsx`, including `admin/(org)/**` and `profile/**`. Skeletons must be **page-shaped**: same layout, same column widths, same vertical rhythm as the route they shadow. Generic gray boxes are not acceptable. Don't ship a route without one.

### Admin badges

`src/lib/admin-badge-tones.ts` centralizes badge styling for `BriefStatus`, `ClaimStatus`, `BriefDurationClass`, `BriefPlatform`, `BriefCategory`, `BriefFundedStatus`. Always import from here; don't roll your own status pill.

## App shell

- The shell uses the shadcn sidebar primitive. Sidebar background is `bg-sidebar` (= `bg-surface`); border is `border-sidebar-border`.
- `/admin` has split route groups: org shell `admin/(org)` and platform shell `admin/super`. Different navs, sibling layouts.
- The sidebar toggle lives inside the sidebar itself. There is no top page-header bar (removed in #58).

## Voice & copy

Copy is design. Same standards apply.

- **Direct, specific, lowercase where it reads natural.** "Publish brief", not "Submit Brief for Publication". Sentence case for headings, not title case.
- **Active voice.** "We refunded 240 DKK", not "240 DKK has been refunded".
- **Concrete over generic.** "No briefs match these filters" beats "No results". "Couldn't reach Stripe, try again in a moment" beats "An error occurred".
- **Money is precise.** Always show currency. Always render DKK in whole units in UI (never øre).
- **No em-dashes.** Use commas, colons, semicolons, periods, or parentheses. Not `--` either.
- **No exclamation marks** outside actual celebration moments (a confirmed payout, a published brief). Default is calm.

## Anti-patterns

Stop and rewrite if you catch any of these:

- **Side-stripe borders.** `border-l-4 border-warning` as a callout accent. Use a full subtle border + tinted background, or a leading icon, or nothing.
- **Gradient text.** `bg-clip-text` over a gradient. Single solid color. Emphasis via weight or size.
- **Glassmorphism as decoration.** Backdrop blurs on cards "to make them feel modern". The modal backdrop is the one place blur is allowed.
- **Hero-metric template.** Big number, small label, supporting stats, gradient accent. Generic SaaS dashboard cliche. If you need a metric, give it real context and let surrounding spacing do the work.
- **Identical card grids.** Same-sized cards with icon, heading, body, repeated four or six times. Vary by hierarchy or use a different layout primitive.
- **Modal as first thought.** Modals are usually laziness. Try inline editing, expanding rows, or a dedicated page before reaching for one.
- **Raw hex in components.** Use a tier 1 utility. If the token doesn't exist, add it.
- **Color carrying meaning alone.** Status always pairs color with text or an icon, for accessibility and clarity.
- **Page-level transitions that fight view transitions.** Let the route fade do its work; don't add a competing wrapper animation.
- **Forked shadcn primitives.** Don't edit files under `src/components/ui/`. Wrap or compose.
- **Skipping `loading.tsx`** on a new top-level route. Always page-shaped.

## Adding new tokens

1. Add the real value to **tier 2** (`:root` for dark, `[data-theme="light"]` for light). Always define both.
2. Expose it as a Tailwind utility in **tier 1** (`@theme inline`) under a semantic name.
3. If it's a colored text on a tinted surface, add an `-ink` variant in the light theme block, darkened to AA contrast on `--bg-2` cream.
4. Update this doc with the token and one usage example.
