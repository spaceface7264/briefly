-- Enforce a reclaim cooldown to prevent release/reclaim loops that extend expiry.
-- Creators must wait 2 days after a cancelled claim before creating a new claim
-- for the same brief.

CREATE OR REPLACE FUNCTION user_not_in_reclaim_cooldown(brief_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  cooldown_days INTEGER := 2;
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM claims c
    WHERE c.brief_id = brief_uuid
      AND c.user_id = auth.uid()
      AND c.status = 'cancelled'
      AND c.updated_at > NOW() - make_interval(days => cooldown_days)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can create claims" ON claims;

CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT user_has_claimed(brief_id)
    AND user_not_in_reclaim_cooldown(brief_id)
    AND get_active_claim_count(brief_id) < (SELECT claim_limit FROM briefs WHERE id = brief_id)
    AND (SELECT status FROM briefs WHERE id = brief_id) = 'open'
  );
