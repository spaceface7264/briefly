-- Atomic escrow slot release (Phase 1.1d follow-up; security fix).
--
-- The original payClaim implementation read briefs.escrow_held_dkk into
-- application memory, validated it against the slot gross, called
-- stripe.transfers.create(), then issued an UPDATE that wrote
-- `held - slot` back. Two concurrent payClaim runs on the same brief
-- could both pass the read-time guard, both transfer to the creator,
-- and both subtract the same slot from the same starting balance,
-- leaving funds double-paid and the held column overstated. This
-- migration replaces that read-then-write with a single atomic UPDATE
-- that moves held + funded_status together, and provides an inverse
-- restore helper for the case where Stripe fails after we have already
-- decremented.

DROP FUNCTION IF EXISTS release_escrow_slot(UUID, INTEGER);

CREATE FUNCTION release_escrow_slot(p_brief_id UUID, p_slot_dkk INTEGER)
RETURNS TABLE(new_held INTEGER, new_status brief_funded_status) AS $$
BEGIN
  UPDATE briefs
  SET
    escrow_held_dkk = escrow_held_dkk - p_slot_dkk,
    funded_status = CASE
      WHEN escrow_held_dkk - p_slot_dkk = 0 THEN 'released'::brief_funded_status
      ELSE 'partially_released'::brief_funded_status
    END
  WHERE id = p_brief_id
    AND escrow_held_dkk >= p_slot_dkk
    AND funded_status IN ('funded'::brief_funded_status, 'partially_released'::brief_funded_status)
  RETURNING escrow_held_dkk, funded_status
  INTO new_held, new_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'escrow_release_failed: brief % cannot release % DKK', p_brief_id, p_slot_dkk;
  END IF;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION release_escrow_slot(UUID, INTEGER) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION release_escrow_slot(UUID, INTEGER) TO authenticated;

DROP FUNCTION IF EXISTS restore_escrow_slot(UUID, INTEGER);

CREATE FUNCTION restore_escrow_slot(p_brief_id UUID, p_slot_dkk INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE briefs
  SET
    escrow_held_dkk = escrow_held_dkk + p_slot_dkk,
    funded_status = CASE
      WHEN funded_status = 'released'::brief_funded_status THEN 'partially_released'::brief_funded_status
      ELSE funded_status
    END
  WHERE id = p_brief_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION restore_escrow_slot(UUID, INTEGER) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION restore_escrow_slot(UUID, INTEGER) TO authenticated;
