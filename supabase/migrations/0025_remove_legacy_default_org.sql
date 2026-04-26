-- Remove the legacy default org seeded in 0015.
--
-- History:
--   0015 — INSERT 00000000-0000-0000-0000-000000000001 ('Briefly') as
--          a temporary multi-tenancy home for pre-multi-tenancy data.
--   0016 — backfilled every org_id column on existing rows to point
--          at this id.
--   0021 — set handle_new_user() to auto-attach new signups to it.
--   0023 — replaced handle_new_user() so new signups no longer attach
--          to it; the row was kept in case any of that data was real.
--
-- The data attached to this row was test data and is no longer
-- needed, so this migration removes the row entirely. 0021 is
-- effectively retired by this — its trigger function was already
-- replaced by 0023, and the org it used to point at no longer exists
-- after this runs.
--
-- The 0015 seed line still runs on a from-scratch replay, then this
-- migration removes the row. Slight churn, but every other approach
-- (modifying 0015, deleting 0021, etc.) breaks deterministic replay
-- of applied migrations.

DO $$
DECLARE
  v_legacy_id UUID := '00000000-0000-0000-0000-000000000001';
  v_count BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = v_legacy_id) THEN
    RAISE NOTICE 'Legacy default org already absent — nothing to do';
    RETURN;
  END IF;

  -- Tables added in 0016 reference organizations(id) without
  -- ON DELETE, so we have to clear them explicitly. Deleting in
  -- dependency order: outbox before notifications, payments before
  -- claims, claims before briefs.
  DELETE FROM notification_outbox WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % notification_outbox rows', v_count;

  DELETE FROM notifications WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % notifications rows', v_count;

  DELETE FROM payments WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % payments rows', v_count;

  DELETE FROM claims WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % claims rows', v_count;

  DELETE FROM briefs WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % briefs rows', v_count;

  DELETE FROM invite_codes WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % invite_codes rows', v_count;

  DELETE FROM invoice_counters WHERE org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % invoice_counters rows', v_count;

  -- profiles.active_org_id has no ON DELETE clause, so blank it out
  -- on any profile that was still pointing at the legacy org.
  -- getActiveOrg falls back to memberships when active_org_id is null.
  UPDATE profiles SET active_org_id = NULL WHERE active_org_id = v_legacy_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleared active_org_id on % profiles', v_count;

  -- memberships (0015) and org_applications (0022) cascade on org
  -- delete, so they go away with the row itself.
  DELETE FROM organizations WHERE id = v_legacy_id;
  RAISE NOTICE 'Legacy default org removed';
END $$;
