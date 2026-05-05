-- Fix the brand_kits read policy for claimed creators.
--
-- 0040 introduced the policy with `c.status IN ('pending', 'approved',
-- 'submitted')`. The plan that drove that migration described claim
-- statuses generically. The codebase's actual `claims.status` CHECK
-- (introduced in 0002_multi_claim.sql) is:
--
--   ('active', 'submitted', 'approved', 'paid', 'cancelled')
--
-- There is no `'pending'` status. The literal therefore matched nothing
-- and creators with a live `active` claim couldn't read their org's
-- brand kit. This migration replaces the policy with the right status
-- set: anything that isn't `cancelled` is "live" enough to deserve
-- access to the kit. We also include `paid` so creators can pull the
-- brand kit for portfolio / case-study purposes after a brief is
-- completed.

DROP POLICY IF EXISTS "Claimed creators read brand_kits" ON brand_kits;
CREATE POLICY "Claimed creators read brand_kits"
  ON brand_kits FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM claims c
      JOIN briefs b ON b.id = c.brief_id
      WHERE b.org_id = brand_kits.org_id
        AND c.user_id = auth.uid()
        AND c.status IN ('active', 'submitted', 'approved', 'paid')
    )
  );
