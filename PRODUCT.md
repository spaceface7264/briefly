# Product

## Register

product

## Users

**Org users** (`/admin/*`). Marketing or community leads at small to mid-sized businesses, often Danish, with a real product or storefront and a content budget but no in-house video team. Their context: a few briefs running at once, a roster of creators to keep track of, and not enough hours to chase invoices. They want to publish a paid brief, see who claimed it, approve good work fast, and trust the money side runs itself.

**Creators** (`/briefs`, `/profile/*`). Regular people with smaller followings, often already customers or fans of the org. Side-income or part-time, comfortable making short-form for TikTok and Reels, not chasing influencer status. Their context: scanning what's open, claiming what fits, submitting work, getting paid without filing self-invoices.

## Product Purpose

Briefly turns an organisation's own patrons into its paid content creators, and handles the legal and money rails so neither side has to think about them.

The bet: the people most willing and best-suited to make great content for a brand are usually already its customers. They post and tag the org for free anyway. Briefly is the bridge: the org publishes a brief into escrow, a creator from its network (existing fans, newsletter readers, customers it invited) claims it, submits the work, gets paid in DKK, and the usage rights flow to the org. The alternative is manually DMing taggers and reconciling small-gig invoices across a roster, which is administrative misery for both sides.

Success looks like: an org runs paid briefs as a regular content motion, not a project. A creator earns predictable side-income from brands they actually use, without ever opening a spreadsheet.

## Brand Personality

Cool, modern, straightforward.

Voice in practice: direct and specific, no hype, no marketing varnish. Active voice. Sentence case. Calm. Numbers are real numbers; money is exact; status is unambiguous. Lowercase where it reads natural. No exclamation marks outside genuine celebration moments (a confirmed payout, a published brief). Never em-dashes; use commas, colons, semicolons, periods, or parentheses.

## Anti-references

Briefly is **not** a freelance marketplace and must not feel like one. Active rejections:

- **Race-to-the-bottom marketplaces** (Fiverr, generic Upwork-style gigs). No bidding, no star ratings on creators, no "starting at" pricing tricks, no lowest-bidder optics. Price is set by the org and is what gets paid.
- **Glossy influencer platforms** (Aspire, follower-count-led tooling). The creator's value here is patron-affinity and a real audience, not reach math. The product shouldn't make creators feel ranked or auctioned.
- **Productivity-tool sameness**. Not the cream + purple Notion/Linear lookalike pile.

Feature-rich and competent is fine. Busy is not.

## Design Principles

1. **Money is precise.** Every DKK is visible. No "starting at", no hidden fees, no surprise withholdings. If the org pays 800, the creator sees 800 (minus the platform fee, also visible). Escrow and payout state are always legible.
2. **Calm by default, loud on signal.** The product is quiet by default: tinted neutrals, restrained type, no decorative motion. Brand cyan only fires when something genuinely needs attention (a pending submission, a live brief, a paid status). If everything is loud, nothing is.
3. **Respect the creator.** No dark patterns, no platform-leverage tricks, no withholding of payouts beyond what the workflow requires. Self-billing should feel like a service, not a tax.
4. **Boring is a feature.** The admin shell should feel like a tool, not a brand experience. Reliability over flair. A creator should be able to claim, submit, and get paid without ever pausing to figure out what to do next.
5. **One next thing.** Every screen makes the next action obvious. The admin landing leads with what needs review; the brief detail leads with the next decision; an empty state names the next step in plain English.

## Accessibility & Inclusion

WCAG 2.1 AA. English-language product (the brand serves Danish customers but the interface is English; money formats use Danish locale for thousands separators). Respect `prefers-reduced-motion`: any non-essential animation collapses to a single frame. Status colour is always paired with text or icon. No interaction is gated behind hover alone.
