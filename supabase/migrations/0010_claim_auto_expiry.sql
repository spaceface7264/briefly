-- Claims carry an `expires_at` (set to claimed_at + 7 days in the client)
-- but nothing enforces it. If a creator claims a brief and ghosts, the
-- claim stays `status='active'` indefinitely, blocking the slot against
-- `claim_limit` via `get_active_claim_count` and blocking the creator
-- from re-claiming via `user_has_claimed`. This migration wires up a
-- pg_cron job to flip stale `active` claims to `cancelled`.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION expire_stale_claims()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE claims
  SET status = 'cancelled'
  WHERE status = 'active'
    AND expires_at < NOW();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unschedule any prior run of this job before re-scheduling, so the
-- migration is idempotent if it ever needs to be re-applied.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-claims') THEN
    PERFORM cron.unschedule('expire-stale-claims');
  END IF;
END;
$$;

SELECT cron.schedule(
  'expire-stale-claims',
  '0 * * * *',
  $$SELECT expire_stale_claims();$$
);
