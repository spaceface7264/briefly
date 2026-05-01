-- Lock the escrow columns on `briefs` at the database layer.
--
-- 0034 broadened the brief write policy to `is_org_member()` with a
-- table-wide `FOR ALL` grant. Combined with the escrow columns added
-- in 0037, that left a hole: any org member could `UPDATE briefs SET
-- escrow_held_dkk = …, price_dkk = …` and rewrite the contract that
-- payClaim relies on for payout sizing. brief-form.tsx already gates
-- the inputs client-side; this migration is the server-side
-- counterpart so the disabled attribute stays a UX hint and the real
-- security boundary lives in Postgres.
--
-- Two rules:
--   1. The escrow bookkeeping columns (funded_status,
--      escrow_amount_dkk, escrow_held_dkk, stripe_payment_intent_id)
--      are writable only by the platform service role. The webhook,
--      pay-action.ts, and archiveBriefWithRefund all use the
--      service-role admin client, so legitimate flows still work.
--   2. price_dkk and claim_limit are frozen once the brief leaves
--      `unfunded`. Even an org admin cannot rewrite them after the
--      escrow PaymentIntent has fired; archive + republish is the
--      only path. This matches the client-side `escrowLocked` rule
--      in brief-form.tsx.

DROP TRIGGER IF EXISTS briefs_escrow_immutability ON briefs;
DROP FUNCTION IF EXISTS enforce_brief_escrow_immutability();

CREATE OR REPLACE FUNCTION enforce_brief_escrow_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Resolve the JWT role of the current session. The service-role
  -- client (createAdminClient) connects with role `service_role`;
  -- the user-bound client (createClient) uses `authenticated`.
  -- Direct postgres connections (psql via the dashboard, migration
  -- runner) leave the claim NULL; we treat that as platform-trusted.
  v_role := current_setting('request.jwt.claims', true)::jsonb->>'role';

  IF v_role IS NOT NULL AND v_role <> 'service_role' THEN
    IF OLD.funded_status IS DISTINCT FROM NEW.funded_status THEN
      RAISE EXCEPTION
        'escrow column "%" can only be modified by the platform service role',
        'funded_status';
    END IF;
    IF OLD.escrow_amount_dkk IS DISTINCT FROM NEW.escrow_amount_dkk THEN
      RAISE EXCEPTION
        'escrow column "%" can only be modified by the platform service role',
        'escrow_amount_dkk';
    END IF;
    IF OLD.escrow_held_dkk IS DISTINCT FROM NEW.escrow_held_dkk THEN
      RAISE EXCEPTION
        'escrow column "%" can only be modified by the platform service role',
        'escrow_held_dkk';
    END IF;
    IF OLD.stripe_payment_intent_id IS DISTINCT FROM NEW.stripe_payment_intent_id THEN
      RAISE EXCEPTION
        'escrow column "%" can only be modified by the platform service role',
        'stripe_payment_intent_id';
    END IF;
  END IF;

  -- price_dkk and claim_limit are part of the escrow contract once
  -- funded_status leaves `unfunded`. Reject changes from any role
  -- (service role included; archive + republish is the supported
  -- path for changing a funded brief's price or slot count).
  IF OLD.funded_status <> 'unfunded' THEN
    IF OLD.price_dkk IS DISTINCT FROM NEW.price_dkk THEN
      RAISE EXCEPTION
        'price_dkk cannot change while funded_status is %; archive and republish to adjust',
        OLD.funded_status;
    END IF;
    IF OLD.claim_limit IS DISTINCT FROM NEW.claim_limit THEN
      RAISE EXCEPTION
        'claim_limit cannot change while funded_status is %; archive and republish to adjust',
        OLD.funded_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SECURITY DEFINER + owner postgres so the trigger evaluates with
-- the table owner's privileges and is not subject to the calling
-- user's RLS context (per CLAUDE.md "Don'ts").
ALTER FUNCTION enforce_brief_escrow_immutability() OWNER TO postgres;

CREATE TRIGGER briefs_escrow_immutability
  BEFORE UPDATE ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_brief_escrow_immutability();
