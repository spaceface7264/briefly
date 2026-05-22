# Pre-mortem

What kills Briefly in the next six months, ranked. Each item has a trip wire (a concrete signal the risk is materializing) and a countermeasure (what defuses it before launch, or what we do if the trip wire fires after).

Companion to TODO.md and DESIGN.md. Read before adding anything to TODO.md's pre-launch section.

## Launch context

- **Target launch:** 2026-06-02 (Boulders onboarding begins)
- **First org user:** boulders.dk
- **Creator pool:** ~10 lined up
- **Current state:** the workflow runs manually at Boulders today; Briefly automates the existing process

This changes the risk weighting below. #2 (cold start) is materially lower than the generic case because demand on both sides is pre-committed. #3 (first dispute) is materially higher because the first org is the founder's own employer and a botched dispute is a professional reputation hit. The sharpest launch test is **parity with the existing manual Boulders workflow**, not the generic checklist.

## 1. We never launch

The TODO list keeps generating pre-launch blockers. Each one looks reasonable in isolation. Together they form a moving finish line, and six months in we have a polished pre-product with zero paying orgs.

Trip wire: pre-launch section of TODO.md grows two weeks in a row without an item being deleted.

Countermeasure: the launch criteria below are the only blockers. Anything not on the list ships post-launch by default.

Launch criteria:
- [ ] One real org can publish, fund, and approve one brief end-to-end in prod
- [ ] One real creator can claim, submit, and receive payout in prod
- [ ] Stripe webhooks handle the three failure paths: payment_intent.payment_failed, charge.refunded, transfer.failed
- [ ] RLS spot-check on every table in the happy path, walked as a non-owner user
- [ ] Supabase Pro upgrade
- [ ] Resend deliverability test to gmail, outlook, and a custom-domain inbox
- [ ] Stripe Connect Express onboarding walked end-to-end by a Danish private-individual creator (no CVR), with friction points documented
- [x] Briefs restructured around the canonical creative-brief template (Project, Objective, Audience, Insight, Message, Tone, Deliverables, Mandatories), surfaced on the publish form and the creator-side brief view (migration 0058)

## 2. Cold start never happens

We launch with no critical mass. Orgs post once, see no claims, leave. Creators visit, see three open briefs, leave.

Trip wire: any published brief sits with zero claims for over 48h, or any active creator sees fewer than three open briefs on a return visit.

Countermeasure:
- Pick one vertical for launch. Multi-tenant branding stays as plumbing, not as marketing.
- Line up 3 seed orgs willing to publish 5 briefs in week one.
- Line up 10 seed creators committed to claiming in week one.
- Do not open a second vertical until the first shows org repeat rate above a defined threshold.

## 3. First dispute goes public

An org refuses to approve a borderline submission. The creator's money sits in escrow. There is no published arbitration policy, no SLA, no automated escalation. It becomes a thread somewhere and the trust narrative is set before we have volume to drown it out.

Trip wire: any approval pending over 72h, or any submission rejected without an admin notification path.

Countermeasure:
- Write the arbitration policy before first paying org. Link it from the brief publish flow.
- Auto-resolve in creator's favor after N days unless org formally appeals (decide N before launch).
- Alert when a submission has been pending over 48h.

## 4. Unit economics break on small briefs

Stripe Connect fees plus platform take eat the floor-price brief. Either creators feel ripped off or we do.

Trip wire: any brief priced below the breakeven floor.

Countermeasure:
- Compute the breakeven floor: Stripe acquiring fee + Connect transfer fee + minimum platform margin.
- Enforce a minimum price_dkk in the publish server action, not just in the form.
- Document the math in CLAUDE.md so future pricing decisions reference it.

## 5. Cross-tenant RLS leak

A new table or query gets a missed policy. One org sees another's briefs, submissions, or memberships. Even one incident sets the security narrative.

Trip wire: any new migration adds a table without enabling RLS and at least one policy in the same migration file.

Countermeasure:
- Lint or CI check on supabase/migrations/: every `create table` must be followed by `alter table ... enable row level security` and at least one `create policy` in the same file.
- Before launch: spin up a non-owner test user, walk every happy path in /admin, log anything they can see that they shouldn't.

## 6. Multi-tenant branding never pays off

We paid the abstraction cost of `NEXT_PUBLIC_PLATFORM_NAME` and friends but only one brand ever shipped. Optionality bought, optionality wasted.

Trip wire: at six months post-launch, only one platform name has reached prod.

Countermeasure: fold the env-driven branding back to constants. Carry optionality only when a concrete second tenant is in flight.
