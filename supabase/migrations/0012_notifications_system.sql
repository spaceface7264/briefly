CREATE TYPE notification_event_type AS ENUM (
  'claim_created',
  'claim_submitted',
  'claim_approved',
  'claim_rejected',
  'claim_paid',
  'claim_released',
  'claim_expired',
  'brief_published'
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_claim_updates BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_claim_queue BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_payments BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type notification_event_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  dedupe_key TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_recipient_dedupe
  ON notifications(recipient_id, dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read_created
  ON notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID NOT NULL UNIQUE REFERENCES notifications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status_next_attempt
  ON notification_outbox(status, next_attempt_at);

DROP TRIGGER IF EXISTS update_notification_outbox_updated_at ON notification_outbox;
CREATE TRIGGER update_notification_outbox_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can update own notification read state" ON notifications;
CREATE POLICY "Users can update own notification read state"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own outbox records" ON notification_outbox;
CREATE POLICY "Users can view own outbox records"
  ON notification_outbox FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.id = notification_outbox.notification_id
        AND n.recipient_id = auth.uid()
    )
    OR is_admin()
  );

CREATE OR REPLACE FUNCTION create_notification_for_user(
  p_recipient_id UUID,
  p_actor_id UUID,
  p_event_type notification_event_type,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB,
  p_dedupe_key TEXT
)
RETURNS VOID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (
    recipient_id,
    actor_id,
    event_type,
    title,
    body,
    entity_type,
    entity_id,
    metadata,
    dedupe_key
  )
  VALUES (
    p_recipient_id,
    p_actor_id,
    p_event_type,
    p_title,
    p_body,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::JSONB),
    p_dedupe_key
  )
  ON CONFLICT (recipient_id, dedupe_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  IF v_notification_id IS NOT NULL THEN
    INSERT INTO notification_outbox (notification_id)
    VALUES (v_notification_id)
    ON CONFLICT (notification_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_admins(
  p_actor_id UUID,
  p_event_type notification_event_type,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB,
  p_dedupe_key TEXT
)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  FOR v_admin_id IN
    SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    PERFORM create_notification_for_user(
      v_admin_id,
      p_actor_id,
      p_event_type,
      p_title,
      p_body,
      p_entity_type,
      p_entity_id,
      p_metadata,
      p_dedupe_key
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_creators(
  p_actor_id UUID,
  p_event_type notification_event_type,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB,
  p_dedupe_key TEXT
)
RETURNS VOID AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  FOR v_creator_id IN
    SELECT id FROM profiles WHERE role = 'creator'
  LOOP
    PERFORM create_notification_for_user(
      v_creator_id,
      p_actor_id,
      p_event_type,
      p_title,
      p_body,
      p_entity_type,
      p_entity_id,
      p_metadata,
      p_dedupe_key
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_brief_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    PERFORM notify_creators(
      NEW.created_by,
      'brief_published',
      'New brief available',
      NEW.title,
      'brief',
      NEW.id,
      jsonb_build_object('brief_id', NEW.id, 'brief_title', NEW.title),
      format('brief_published:%s', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_claim_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID;
  v_brief_title TEXT;
BEGIN
  SELECT b.title
  INTO v_brief_title
  FROM briefs b
  WHERE b.id = COALESCE(NEW.brief_id, OLD.brief_id);

  v_actor := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;

  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    PERFORM notify_admins(
      v_actor,
      'claim_created',
      'Brief claimed',
      COALESCE(v_brief_title, 'A brief was claimed by a creator.'),
      'claim',
      NEW.id,
      jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id, 'status', NEW.status),
      format('claim_created:%s', NEW.id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' THEN
      PERFORM notify_admins(
        v_actor,
        'claim_submitted',
        'New submission ready for review',
        COALESCE(v_brief_title, 'A creator submitted work for review.'),
        'claim',
        NEW.id,
        jsonb_build_object(
          'brief_id', NEW.brief_id,
          'claim_id', NEW.id,
          'old_status', OLD.status,
          'new_status', NEW.status
        ),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
      );
    ELSIF NEW.status = 'approved' THEN
      PERFORM create_notification_for_user(
        NEW.user_id,
        v_actor,
        'claim_approved',
        'Submission approved',
        COALESCE(v_brief_title, 'Your submission has been approved.'),
        'claim',
        NEW.id,
        jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
      );
    ELSIF NEW.status = 'paid' THEN
      PERFORM create_notification_for_user(
        NEW.user_id,
        v_actor,
        'claim_paid',
        'Payout sent',
        COALESCE(v_brief_title, 'Your payout has been sent.'),
        'claim',
        NEW.id,
        jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
      );
    ELSIF NEW.status = 'cancelled' THEN
      IF OLD.status = 'submitted' THEN
        PERFORM create_notification_for_user(
          NEW.user_id,
          v_actor,
          'claim_rejected',
          'Submission not approved',
          COALESCE(v_brief_title, 'Your submission needs another attempt.'),
          'claim',
          NEW.id,
          jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
          format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
        );
      ELSIF OLD.status = 'active' THEN
        IF NEW.expires_at < NOW() THEN
          PERFORM create_notification_for_user(
            NEW.user_id,
            v_actor,
            'claim_expired',
            'Claim expired',
            COALESCE(v_brief_title, 'Your claim expired before submission.'),
            'claim',
            NEW.id,
            jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
            format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
          );
        ELSE
          PERFORM create_notification_for_user(
            NEW.user_id,
            v_actor,
            'claim_released',
            'Claim released',
            COALESCE(v_brief_title, 'Your claim has been released.'),
            'claim',
            NEW.id,
            jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
            format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_brief_notifications ON briefs;
CREATE TRIGGER trigger_brief_notifications
  AFTER INSERT ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION create_brief_notification();

DROP TRIGGER IF EXISTS trigger_claim_notifications ON claims;
CREATE TRIGGER trigger_claim_notifications
  AFTER INSERT OR UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION create_claim_notifications();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
