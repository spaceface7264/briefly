-- Application notifications: notify org admins when a creator applies,
-- and notify the applicant when their application is approved or rejected.
--
-- Reuses the org-scoped notification helpers introduced in 0018
-- (notify_admins, create_notification_for_user) and the outbox
-- infrastructure from 0012. The matching email-preference column lives
-- on profiles so a recipient can opt out from /admin/settings or
-- /profile.

-- 1. Extend the event-type enum with the three application events.
--    Wrapped in DO blocks so the migration is idempotent on reruns.
DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE IF NOT EXISTS 'application_received';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE IF NOT EXISTS 'application_approved';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE IF NOT EXISTS 'application_rejected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Email-preference column. Same default (TRUE) as every other
--    notify_* column on profiles.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_applications BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Trigger function. Fires AFTER INSERT (notify org admins) and
--    AFTER UPDATE on status (notify applicant on approve/reject).
CREATE OR REPLACE FUNCTION create_application_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID;
  v_org_name TEXT;
  v_applicant_name TEXT;
  v_applicant_label TEXT;
BEGIN
  v_actor := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;

  SELECT name INTO v_org_name
  FROM organizations
  WHERE id = COALESCE(NEW.org_id, OLD.org_id);

  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_applicant_name
    FROM profiles
    WHERE id = NEW.user_id;

    v_applicant_label := COALESCE(NULLIF(v_applicant_name, ''), 'A creator');

    PERFORM notify_admins(
      NEW.org_id,
      NEW.user_id,
      'application_received',
      'New application to join',
      v_applicant_label || ' applied to join ' ||
        COALESCE(NULLIF(v_org_name, ''), 'your organisation') || '.',
      'application',
      NEW.id,
      jsonb_build_object(
        'application_id', NEW.id,
        'applicant_id', NEW.user_id,
        'org_id', NEW.org_id
      ),
      format('application_received:%s', NEW.id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM create_notification_for_user(
        NEW.user_id,
        v_actor,
        'application_approved',
        'Application approved',
        'You can now access ' ||
          COALESCE(NULLIF(v_org_name, ''), 'the organisation') || '.',
        'application',
        NEW.id,
        jsonb_build_object('application_id', NEW.id, 'org_id', NEW.org_id),
        format('application_decision:%s:%s', NEW.id, NEW.status),
        NEW.org_id
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM create_notification_for_user(
        NEW.user_id,
        v_actor,
        'application_rejected',
        'Application not approved',
        'Your application to ' ||
          COALESCE(NULLIF(v_org_name, ''), 'the organisation') ||
          ' was not approved.',
        'application',
        NEW.id,
        jsonb_build_object('application_id', NEW.id, 'org_id', NEW.org_id),
        format('application_decision:%s:%s', NEW.id, NEW.status),
        NEW.org_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION create_application_notifications() OWNER TO postgres;

DROP TRIGGER IF EXISTS trigger_application_notifications ON org_applications;
CREATE TRIGGER trigger_application_notifications
  AFTER INSERT OR UPDATE ON org_applications
  FOR EACH ROW
  EXECUTE FUNCTION create_application_notifications();
