-- Mockup seed data for design / QA on the creator-facing surfaces.
--
-- Inserts 6 fake organizations (3 SMB-flavored, 3 big-brand-flavored) and
-- ~4 briefs each. All briefs are status='open' + funded_status='unfunded'
-- with NULL escrow columns, so they appear in the creator feed without
-- requiring real Stripe charges. The auto-create trigger from migration
-- 0028 will populate org_subscriptions rows automatically.
--
-- Run this in the Supabase SQL editor (NOT in supabase/migrations/, on
-- purpose, so it never auto-runs in CI / prod).
--
-- Cleanup at the bottom (commented out): uncomment to remove the seed.

BEGIN;

-- ============================================================
-- 1. Organizations
-- ============================================================
-- Fixed UUIDs so cleanup and re-runs are deterministic.

INSERT INTO organizations (id, slug, name, country, currency, industry, description, accent_color, discoverable)
VALUES
  -- SMB-flavored
  ('a0000001-0000-0000-0000-000000000001', 'solbaer-coffee', 'Solbær Coffee', 'DK', 'DKK',
   'Food & Beverage', 'Specialty roaster with cafés in Copenhagen and Aarhus.', '#C8FF00', TRUE),
  ('a0000001-0000-0000-0000-000000000002', 'frue-studio', 'Frue Studio', 'DK', 'DKK',
   'Fashion', 'Independent womenswear label, small-batch collections.', '#F5C7A8', TRUE),
  ('a0000001-0000-0000-0000-000000000003', 'kraft-strength-lab', 'Kraft Strength Lab', 'DK', 'DKK',
   'Fitness', 'Boutique strength studio focused on barbell coaching.', '#FF5B3F', TRUE),
  -- Big-brand-flavored
  ('a0000001-0000-0000-0000-000000000004', 'norden-audio', 'Norden Audio', 'SE', 'DKK',
   'Consumer Electronics', 'Challenger headphone and speaker brand designed in Stockholm.', '#7C9CFF', TRUE),
  ('a0000001-0000-0000-0000-000000000005', 'halling-living', 'Halling Living', 'NO', 'DKK',
   'Furniture & Home', 'Nordic furniture house, oak-led collections.', '#D9C9A8', TRUE),
  ('a0000001-0000-0000-0000-000000000006', 'frisk-beverages', 'Frisk Beverages', 'DK', 'DKK',
   'FMCG', 'Sparkling botanicals and low-sugar sodas, sold across Scandinavia.', '#9CE6C2', TRUE);

-- ============================================================
-- 2. Briefs
--    All status='open', funded_status='unfunded', escrow_* NULL.
--    published_at staggered over the last ~3 weeks for realistic feed order.
-- ============================================================

-- Solbær Coffee (SMB) — small budgets, lifestyle
INSERT INTO briefs (org_id, title, description, category, duration_class, price_dkk, claim_limit, status, funded_status, published_at, location, is_ad_intended)
VALUES
  ('a0000001-0000-0000-0000-000000000001',
   'Morning coffee ritual, shot vertical',
   'A 20-30s vertical reel showing your morning ritual with our Aarhus blend. Natural light, hand-held feel, no music overlays.',
   'entertaining', 'short', 600, 4, 'open', 'unfunded', NOW() - INTERVAL '2 days', 'Copenhagen', FALSE),
  ('a0000001-0000-0000-0000-000000000001',
   'How to brew V60 at home',
   'Approachable explainer for home brewers. Show grind, bloom, pour technique. We provide a 1kg bag of beans.',
   'guide', 'medium', 900, 2, 'open', 'unfunded', NOW() - INTERVAL '5 days', NULL, FALSE),
  ('a0000001-0000-0000-0000-000000000001',
   'Café opening, Frederiksberg',
   'On-site coverage of our new Frederiksberg café opening. Stills + a short edit. Friday afternoon, 2 hours.',
   'event', 'short', 1500, 1, 'open', 'unfunded', NOW() - INTERVAL '8 days', 'Frederiksberg', FALSE),
  ('a0000001-0000-0000-0000-000000000001',
   'Static post: new oat latte',
   'Single static photo of our new oat latte, your style, our brand kit colors. Caption left to you.',
   'ad', 'static', 400, 6, 'open', 'unfunded', NOW() - INTERVAL '11 days', NULL, TRUE);

-- Frue Studio (SMB) — mid budgets, photo-heavy
INSERT INTO briefs (org_id, title, description, category, duration_class, price_dkk, claim_limit, status, funded_status, published_at, location, is_ad_intended)
VALUES
  ('a0000001-0000-0000-0000-000000000002',
   'SS26 lookbook teaser',
   'Editorial-feeling 30-45s vertical teaser for the SS26 drop. We send 2 pieces, you keep them. Outdoor or studio.',
   'ad', 'medium', 2200, 2, 'open', 'unfunded', NOW() - INTERVAL '1 day', NULL, TRUE),
  ('a0000001-0000-0000-0000-000000000002',
   'Wardrobe staple try-on',
   'Honest try-on of our linen blazer. Talk about fit, fabric, what you would pair it with.',
   'guide', 'short', 1100, 3, 'open', 'unfunded', NOW() - INTERVAL '4 days', NULL, FALSE),
  ('a0000001-0000-0000-0000-000000000002',
   'Studio visit, Vesterbro',
   'Behind-the-scenes coverage of our Vesterbro atelier. 1 long-form piece (3-4 min) + 3 stills.',
   'community', 'long', 3000, 1, 'open', 'unfunded', NOW() - INTERVAL '7 days', 'Vesterbro', FALSE),
  ('a0000001-0000-0000-0000-000000000002',
   'Static: silk slip dress',
   'Single hero shot of the slip dress on you, your aesthetic. We provide the dress.',
   'ad', 'static', 800, 4, 'open', 'unfunded', NOW() - INTERVAL '13 days', NULL, TRUE);

-- Kraft Strength Lab (SMB) — short-form video
INSERT INTO briefs (org_id, title, description, category, duration_class, price_dkk, claim_limit, status, funded_status, published_at, location, is_ad_intended)
VALUES
  ('a0000001-0000-0000-0000-000000000003',
   'First squat session at Kraft',
   'Document your first session with one of our coaches. 30s vertical, voiceover or natural sound.',
   'entertaining', 'short', 700, 5, 'open', 'unfunded', NOW() - INTERVAL '3 days', 'Nørrebro', FALSE),
  ('a0000001-0000-0000-0000-000000000003',
   'Deadlift form breakdown',
   '60-90s explainer breaking down setup, brace, and pull. We provide platform time and a coach for spotting.',
   'guide', 'medium', 1300, 2, 'open', 'unfunded', NOW() - INTERVAL '6 days', 'Nørrebro', FALSE),
  ('a0000001-0000-0000-0000-000000000003',
   'Open house Saturday',
   'Live coverage of our quarterly open house. Stills + short edit by Sunday evening.',
   'event', 'short', 1800, 1, 'open', 'unfunded', NOW() - INTERVAL '10 days', 'Nørrebro', FALSE);

-- Norden Audio (big-brand) — higher budgets, ad-intended
INSERT INTO briefs (org_id, title, description, category, duration_class, price_dkk, claim_limit, status, funded_status, published_at, location, is_ad_intended, usage_rights)
VALUES
  ('a0000001-0000-0000-0000-000000000004',
   'Headphone unboxing, your aesthetic',
   'Unboxing and first-listen of our flagship over-ears. 45-60s vertical. Cinematic, slow, considered. We pay shipping; you keep the unit.',
   'ad', 'medium', 6500, 3, 'open', 'unfunded', NOW() - INTERVAL '1 day', NULL, TRUE,
   'Paid social usage in EU markets, 90 days, organic + boosted.'),
  ('a0000001-0000-0000-0000-000000000004',
   'Travel companion, long-form',
   '3-4 min long-form piece using our wireless ANC pair on a real travel day. Airport, train, hotel. No script; we trust your taste.',
   'entertaining', 'long', 12000, 1, 'open', 'unfunded', NOW() - INTERVAL '4 days', NULL, TRUE,
   'Paid social + YouTube pre-roll, EU + UK, 6 months.'),
  ('a0000001-0000-0000-0000-000000000004',
   'Hero static: studio monitor',
   'Single editorial-grade still of our studio monitor in your space. We supply the unit + creative direction deck.',
   'ad', 'static', 4500, 2, 'open', 'unfunded', NOW() - INTERVAL '9 days', NULL, TRUE,
   'Print + digital, 12 months, global.'),
  ('a0000001-0000-0000-0000-000000000004',
   'Why we built it: 30s spot',
   '30s ad-intended spot built around the question "why do these exist?" Your answer, your framing, our product on screen.',
   'ad', 'short', 8000, 2, 'open', 'unfunded', NOW() - INTERVAL '14 days', NULL, TRUE,
   'Paid social, EU, 90 days.');

-- Halling Living (big-brand) — furniture, mid-long content
INSERT INTO briefs (org_id, title, description, category, duration_class, price_dkk, claim_limit, status, funded_status, published_at, location, is_ad_intended, usage_rights)
VALUES
  ('a0000001-0000-0000-0000-000000000005',
   'Living room reset with our oak coffee table',
   '60-90s vertical: room reset starring our new oak coffee table. White-glove delivery to your home; you keep the piece.',
   'ad', 'medium', 7500, 2, 'open', 'unfunded', NOW() - INTERVAL '2 days', NULL, TRUE,
   'Paid social + email, Nordics, 6 months.'),
  ('a0000001-0000-0000-0000-000000000005',
   'How we design for small flats',
   'Long-form 4-5 min piece about designing for sub-50m² flats, using 2-3 of our pieces. Studio visit available.',
   'guide', 'long', 11000, 1, 'open', 'unfunded', NOW() - INTERVAL '6 days', 'Oslo', TRUE,
   'YouTube + paid social, 12 months, global.'),
  ('a0000001-0000-0000-0000-000000000005',
   'Editorial still: dining chair',
   'Single editorial still of our dining chair in situ. Your styling, our brand kit.',
   'ad', 'static', 3200, 3, 'open', 'unfunded', NOW() - INTERVAL '12 days', NULL, TRUE,
   'Print + digital, Nordics, 12 months.');

-- Frisk Beverages (big-brand) — FMCG, ad-heavy
INSERT INTO briefs (org_id, title, description, category, duration_class, price_dkk, claim_limit, status, funded_status, published_at, location, is_ad_intended, usage_rights)
VALUES
  ('a0000001-0000-0000-0000-000000000006',
   'Summer in 15 seconds',
   'Punchy 15s vertical built around our new elderflower sparkling. Two flavors shipped to you; we want energy.',
   'ad', 'short', 5500, 5, 'open', 'unfunded', NOW() - INTERVAL '1 day', NULL, TRUE,
   'Paid social, EU, 90 days, organic + boosted.'),
  ('a0000001-0000-0000-0000-000000000006',
   'Why low-sugar matters',
   '60s explainer on why we cut sugar by 70% without losing the bite. Approachable tone; not lecture-y.',
   'guide', 'medium', 4200, 3, 'open', 'unfunded', NOW() - INTERVAL '5 days', NULL, TRUE,
   'Paid social, EU, 6 months.'),
  ('a0000001-0000-0000-0000-000000000006',
   'Festival activation, Roskilde',
   'On-site coverage of our Roskilde activation. Stills + a 60s edit by Monday morning.',
   'event', 'medium', 6800, 2, 'open', 'unfunded', NOW() - INTERVAL '8 days', 'Roskilde', TRUE,
   'Paid social, Nordics, 90 days.'),
  ('a0000001-0000-0000-0000-000000000006',
   'Hero static: full lineup',
   'Single hero still of all six flavors together. Your styling. We ship a full case.',
   'ad', 'static', 2800, 4, 'open', 'unfunded', NOW() - INTERVAL '11 days', NULL, TRUE,
   'Print + digital, Nordics, 12 months.');

COMMIT;

-- ============================================================
-- Cleanup (uncomment to remove the seed)
-- ============================================================
-- BEGIN;
-- DELETE FROM briefs WHERE org_id IN (
--   'a0000001-0000-0000-0000-000000000001',
--   'a0000001-0000-0000-0000-000000000002',
--   'a0000001-0000-0000-0000-000000000003',
--   'a0000001-0000-0000-0000-000000000004',
--   'a0000001-0000-0000-0000-000000000005',
--   'a0000001-0000-0000-0000-000000000006'
-- );
-- DELETE FROM org_subscriptions WHERE org_id IN (
--   'a0000001-0000-0000-0000-000000000001',
--   'a0000001-0000-0000-0000-000000000002',
--   'a0000001-0000-0000-0000-000000000003',
--   'a0000001-0000-0000-0000-000000000004',
--   'a0000001-0000-0000-0000-000000000005',
--   'a0000001-0000-0000-0000-000000000006'
-- );
-- DELETE FROM organizations WHERE id IN (
--   'a0000001-0000-0000-0000-000000000001',
--   'a0000001-0000-0000-0000-000000000002',
--   'a0000001-0000-0000-0000-000000000003',
--   'a0000001-0000-0000-0000-000000000004',
--   'a0000001-0000-0000-0000-000000000005',
--   'a0000001-0000-0000-0000-000000000006'
-- );
-- COMMIT;
