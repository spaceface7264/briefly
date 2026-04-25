-- Org-scoped notification triggers
-- Rewrite notify_admins/notify_creators to use memberships instead of global role lookup.

-- ============================================================
-- Update create_notification_for_user to accept org_id
-- ============================================================
CREATE OR REPLACE FUNCTION create_notification_for_user(
  p_recipient_id UUID,
  p_actor_id UUID,
  p_event_type notification_event_type,
  p_title TEXT,
  p_body TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_metadata JSONB,
  p_dedupe_key TEXT,
  p_org_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_notification_id UUID;
  v_org_id UUID;
BEGIN
  -- Resolve org_id: use parameter, or fall back to recipient's active org
  v_org_id := COALESCE(p_org_id, (SELECT active_org_id FROM profiles WHERE id = p_recipient_id));

  INSERT INTO notifications (
    recipient_id, actor_id, event_type, title, body,
    entity_type, entity_id, metadata, dedupe_key, org_id
  )
  VALUES (
    p_recipient_id, p_actor_id, p_event_type, p_title, p_body,
    p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::JSONB), p_dedupe_key, v_org_id
  )
  ON CONFLICT (recipient_id, dedupe_key) DO NOTHING
  RETURNING id INTO v_notification_id;

  IF v_notification_id IS NOT NULL THEN
    INSERT INTO notification_outbox (notification_id, org_id)
    VALUES (v_notification_id, v_org_id)
    ON CONFLICT (notification_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
ALTER FUNCTION create_notification_for_user(UUID, UUID, notification_event_type, TEXT, TEXT, TEXT, UUID, JSONB, TEXT, UUID) OWNER TO postgres;

-- ============================================================
-- Rewrite notify_admins to scope by org via memberships
-- ============================================================
CREATE OR REPLACE FUNCTION notify_admins(
  p_org_id UUID,
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
    SELECT m.user_id FROM memberships m
    WHERE m.org_id = p_org_id AND m.role = 'admin' AND m.status = 'active'
  LOOP
    PERFORM create_notification_for_user(
      v_admin_id, p_actor_id, p_event_type, p_title, p_body,
      p_entity_type, p_entity_id, p_metadata, p_dedupe_key, p_org_id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Rewrite notify_creators to scope by org via memberships
-- ============================================================
CREATE OR REPLACE FUNCTION notify_creators(
  p_org_id UUID,
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
    SELECT m.user_id FROM memberships m
    WHERE m.org_id = p_org_id AND m.role = 'creator' AND m.status = 'active'
  LOOP
    PERFORM create_notification_for_user(
      v_creator_id, p_actor_id, p_event_type, p_title, p_body,
      p_entity_type, p_entity_id, p_metadata, p_dedupe_key, p_org_id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Update brief notification trigger to pass org_id
-- ============================================================
CREATE OR REPLACE FUNCTION create_brief_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    PERFORM notify_creators(
      NEW.org_id,
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

-- ============================================================
-- Update claim notification trigger to pass org_id
-- ============================================================
CREATE OR REPLACE FUNCTION create_claim_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_actor UUID;
  v_brief_title TEXT;
  v_org_id UUID;
BEGIN
  SELECT b.title, b.org_id
  INTO v_brief_title, v_org_id
  FROM briefs b
  WHERE b.id = COALESCE(NEW.brief_id, OLD.brief_id);

  v_actor := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;

  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    PERFORM notify_admins(
      v_org_id, v_actor, 'claim_created', 'Brief claimed',
      COALESCE(v_brief_title, 'A brief was claimed by a creator.'),
      'claim', NEW.id,
      jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id, 'status', NEW.status),
      format('claim_created:%s', NEW.id)
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'submitted' THEN
      PERFORM notify_admins(
        v_org_id, v_actor, 'claim_submitted', 'New submission ready for review',
        COALESCE(v_brief_title, 'A creator submitted work for review.'),
        'claim', NEW.id,
        jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
      );
    ELSIF NEW.status = 'approved' THEN
      PERFORM create_notification_for_user(
        NEW.user_id, v_actor, 'claim_approved', 'Submission approved',
        COALESCE(v_brief_title, 'Your submission has been approved.'),
        'claim', NEW.id,
        jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status),
        v_org_id
      );
    ELSIF NEW.status = 'paid' THEN
      PERFORM create_notification_for_user(
        NEW.user_id, v_actor, 'claim_paid', 'Payout sent',
        COALESCE(v_brief_title, 'Your payout has been sent.'),
        'claim', NEW.id,
        jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status),
        v_org_id
      );
    ELSIF NEW.status = 'cancelled' THEN
      IF OLD.status = 'submitted' THEN
        PERFORM create_notification_for_user(
          NEW.user_id, v_actor, 'claim_rejected', 'Submission not approved',
          COALESCE(v_brief_title, 'Your submission needs another attempt.'),
          'claim', NEW.id,
          jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
          format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status),
          v_org_id
        );
      ELSIF OLD.status = 'active' THEN
        IF NEW.expires_at < NOW() THEN
          PERFORM create_notification_for_user(
            NEW.user_id, v_actor, 'claim_expired', 'Claim expired',
            COALESCE(v_brief_title, 'Your claim expired before submission.'),
            'claim', NEW.id,
            jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
            format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status),
            v_org_id
          );
        ELSE
          PERFORM create_notification_for_user(
            NEW.user_id, v_actor, 'claim_released', 'Claim released',
            COALESCE(v_brief_title, 'Your claim has been released.'),
            'claim', NEW.id,
            jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
            format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status),
            v_org_id
          );
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
