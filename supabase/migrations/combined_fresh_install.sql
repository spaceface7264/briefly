-- Combined schema for Briefly (migrations 0001-0014)
-- Paste this into Supabase Dashboard > SQL Editor and run once.

-- ============================================================
-- 0001: Core schema
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE brief_category AS ENUM ('entertaining', 'ad', 'guide', 'event', 'community');
CREATE TYPE brief_status AS ENUM ('open', 'claimed', 'submitted', 'approved', 'paid', 'archived');
CREATE TYPE brief_duration_class AS ENUM ('short', 'medium', 'long', 'static');
CREATE TYPE user_role AS ENUM ('creator', 'admin');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  instagram_handle TEXT,
  tags TEXT[] DEFAULT '{}',
  role user_role NOT NULL DEFAULT 'creator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category brief_category NOT NULL,
  duration_class brief_duration_class NOT NULL DEFAULT 'short',
  price_dkk INTEGER NOT NULL CHECK (price_dkk >= 0),
  deadline DATE,
  location TEXT,
  reference_urls TEXT[] DEFAULT '{}',
  deliverable_specs JSONB DEFAULT '{}',
  usage_rights TEXT,
  status brief_status NOT NULL DEFAULT 'open',
  claim_limit INTEGER NOT NULL DEFAULT 1,
  is_ad_intended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_briefs_status ON briefs(status);
CREATE INDEX idx_briefs_category ON briefs(category);
CREATE INDEX idx_briefs_location ON briefs(location);
CREATE INDEX idx_briefs_duration_class ON briefs(duration_class);
CREATE INDEX idx_briefs_is_ad_intended ON briefs(is_ad_intended);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_briefs_updated_at
  BEFORE UPDATE ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Admin check helper
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 0002: Claims table (multi-claim support)
-- ============================================================
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'approved', 'paid', 'cancelled')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  submission_url TEXT,
  submission_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brief_id, user_id)
);

CREATE INDEX idx_claims_brief_id ON claims(brief_id);
CREATE INDEX idx_claims_user_id ON claims(user_id);
CREATE INDEX idx_claims_status ON claims(status);

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION get_active_claim_count(brief_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER FROM claims
    WHERE brief_id = brief_uuid AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_claimed(brief_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM claims
    WHERE brief_id = brief_uuid
    AND user_id = auth.uid()
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 0004: Invite codes
-- ============================================================
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);

CREATE OR REPLACE FUNCTION use_invite_code(invite_code TEXT, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  SELECT * INTO code_record
  FROM invite_codes
  WHERE code = invite_code
    AND used_by IS NULL
    AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE invite_codes
  SET used_by = user_uuid, used_at = NOW()
  WHERE id = code_record.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 0006: Stripe Connect + Payments
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN stripe_account_id TEXT UNIQUE,
  ADD COLUMN stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN stripe_details_submitted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  amount_dkk INTEGER NOT NULL CHECK (amount_dkk >= 0),
  stripe_transfer_id TEXT UNIQUE,
  stripe_account_id TEXT NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_claim_id ON payments(claim_id);
CREATE INDEX idx_payments_creator_id ON payments(creator_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE UNIQUE INDEX uniq_payments_claim_succeeded
  ON payments(claim_id)
  WHERE status = 'succeeded';

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 0007: VAT & Invoicing
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN country TEXT,
  ADD COLUMN billing_address_line1 TEXT,
  ADD COLUMN billing_address_line2 TEXT,
  ADD COLUMN billing_postal_code TEXT,
  ADD COLUMN billing_city TEXT,
  ADD COLUMN vat_registered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN vat_number TEXT,
  ADD COLUMN cvr_number TEXT,
  ADD COLUMN self_billing_agreement_version TEXT,
  ADD COLUMN self_billing_agreement_accepted_at TIMESTAMPTZ;

CREATE TABLE invoice_counters (
  year INTEGER PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION allocate_invoice_number(p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  INSERT INTO invoice_counters (year, last_seq)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_seq = invoice_counters.last_seq + 1
  RETURNING last_seq INTO next_seq;
  RETURN next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TYPE vat_scheme AS ENUM ('none', 'standard', 'reverse_charge');

ALTER TABLE payments
  ADD COLUMN invoice_year INTEGER,
  ADD COLUMN invoice_seq INTEGER,
  ADD COLUMN invoice_number TEXT,
  ADD COLUMN invoice_issued_at TIMESTAMPTZ,
  ADD COLUMN subtotal_dkk INTEGER,
  ADD COLUMN vat_rate_bp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN vat_amount_dkk INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN total_dkk INTEGER,
  ADD COLUMN vat_scheme vat_scheme NOT NULL DEFAULT 'none',
  ADD COLUMN creator_name_snapshot TEXT,
  ADD COLUMN creator_address_snapshot TEXT,
  ADD COLUMN creator_country_snapshot TEXT,
  ADD COLUMN creator_vat_number_snapshot TEXT,
  ADD COLUMN creator_cvr_snapshot TEXT,
  ADD COLUMN platform_name_snapshot TEXT,
  ADD COLUMN platform_address_snapshot TEXT,
  ADD COLUMN platform_cvr_snapshot TEXT,
  ADD COLUMN platform_vat_snapshot TEXT,
  ADD COLUMN brief_title_snapshot TEXT,
  ADD COLUMN self_billing_agreement_version_snapshot TEXT,
  ADD CONSTRAINT payments_invoice_number_unique UNIQUE (invoice_number);

CREATE INDEX idx_payments_invoice_year ON payments(invoice_year);

-- ============================================================
-- 0009: Per-type notification preferences
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN notify_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_new_briefs BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_claim_updates BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_claim_queue BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_payments BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 0010: Claim auto-expiry via pg_cron
-- ============================================================
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

-- ============================================================
-- 0011: Reclaim cooldown
-- ============================================================
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

-- ============================================================
-- 0012: Notifications system
-- ============================================================
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

CREATE TABLE notifications (
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

CREATE UNIQUE INDEX idx_notifications_recipient_dedupe
  ON notifications(recipient_id, dedupe_key);
CREATE INDEX idx_notifications_recipient_read_created
  ON notifications(recipient_id, read_at, created_at DESC);
CREATE INDEX idx_notifications_created_at
  ON notifications(created_at DESC);

CREATE TABLE notification_outbox (
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

CREATE INDEX idx_notification_outbox_status_next_attempt
  ON notification_outbox(status, next_attempt_at);

CREATE TRIGGER update_notification_outbox_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notification helper functions
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
    recipient_id, actor_id, event_type, title, body,
    entity_type, entity_id, metadata, dedupe_key
  )
  VALUES (
    p_recipient_id, p_actor_id, p_event_type, p_title, p_body,
    p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::JSONB), p_dedupe_key
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
  p_actor_id UUID, p_event_type notification_event_type,
  p_title TEXT, p_body TEXT, p_entity_type TEXT, p_entity_id UUID,
  p_metadata JSONB, p_dedupe_key TEXT
)
RETURNS VOID AS $$
DECLARE v_admin_id UUID;
BEGIN
  FOR v_admin_id IN SELECT id FROM profiles WHERE role = 'admin'
  LOOP
    PERFORM create_notification_for_user(
      v_admin_id, p_actor_id, p_event_type, p_title, p_body,
      p_entity_type, p_entity_id, p_metadata, p_dedupe_key
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_creators(
  p_actor_id UUID, p_event_type notification_event_type,
  p_title TEXT, p_body TEXT, p_entity_type TEXT, p_entity_id UUID,
  p_metadata JSONB, p_dedupe_key TEXT
)
RETURNS VOID AS $$
DECLARE v_creator_id UUID;
BEGIN
  FOR v_creator_id IN SELECT id FROM profiles WHERE role = 'creator'
  LOOP
    PERFORM create_notification_for_user(
      v_creator_id, p_actor_id, p_event_type, p_title, p_body,
      p_entity_type, p_entity_id, p_metadata, p_dedupe_key
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_brief_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'open' THEN
    PERFORM notify_creators(
      NEW.created_by, 'brief_published', 'New brief available', NEW.title,
      'brief', NEW.id,
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
  SELECT b.title INTO v_brief_title
  FROM briefs b WHERE b.id = COALESCE(NEW.brief_id, OLD.brief_id);

  v_actor := NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;

  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    PERFORM notify_admins(
      v_actor, 'claim_created', 'Brief claimed',
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
        v_actor, 'claim_submitted', 'New submission ready for review',
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
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
      );
    ELSIF NEW.status = 'paid' THEN
      PERFORM create_notification_for_user(
        NEW.user_id, v_actor, 'claim_paid', 'Payout sent',
        COALESCE(v_brief_title, 'Your payout has been sent.'),
        'claim', NEW.id,
        jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
        format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
      );
    ELSIF NEW.status = 'cancelled' THEN
      IF OLD.status = 'submitted' THEN
        PERFORM create_notification_for_user(
          NEW.user_id, v_actor, 'claim_rejected', 'Submission not approved',
          COALESCE(v_brief_title, 'Your submission needs another attempt.'),
          'claim', NEW.id,
          jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
          format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
        );
      ELSIF OLD.status = 'active' THEN
        IF NEW.expires_at < NOW() THEN
          PERFORM create_notification_for_user(
            NEW.user_id, v_actor, 'claim_expired', 'Claim expired',
            COALESCE(v_brief_title, 'Your claim expired before submission.'),
            'claim', NEW.id,
            jsonb_build_object('brief_id', NEW.brief_id, 'claim_id', NEW.id),
            format('claim_status:%s:%s:%s', NEW.id, OLD.status, NEW.status)
          );
        ELSE
          PERFORM create_notification_for_user(
            NEW.user_id, v_actor, 'claim_released', 'Claim released',
            COALESCE(v_brief_title, 'Your claim has been released.'),
            'claim', NEW.id,
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

CREATE TRIGGER trigger_brief_notifications
  AFTER INSERT ON briefs
  FOR EACH ROW
  EXECUTE FUNCTION create_brief_notification();

CREATE TRIGGER trigger_claim_notifications
  AFTER INSERT OR UPDATE ON claims
  FOR EACH ROW
  EXECUTE FUNCTION create_claim_notifications();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL USING (is_admin());

-- Briefs
ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators can view open briefs or briefs they claimed"
  ON briefs FOR SELECT
  USING (status = 'open' OR user_has_claimed(id) OR is_admin());
CREATE POLICY "Admins have full access to briefs"
  ON briefs FOR ALL USING (is_admin());

-- Claims
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
  ON claims FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "Users can create claims"
  ON claims FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT user_has_claimed(brief_id)
    AND user_not_in_reclaim_cooldown(brief_id)
    AND get_active_claim_count(brief_id) < (SELECT claim_limit FROM briefs WHERE id = brief_id)
    AND (SELECT status FROM briefs WHERE id = brief_id) = 'open'
  );
CREATE POLICY "Users can update own claims"
  ON claims FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins have full access to claims"
  ON claims FOR ALL USING (is_admin());
CREATE POLICY "Admins can update any claim"
  ON claims FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- Invite codes
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can check invite codes"
  ON invite_codes FOR SELECT USING (true);
CREATE POLICY "Admins can create invite codes"
  ON invite_codes FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admins can update invite codes"
  ON invite_codes FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete invite codes"
  ON invite_codes FOR DELETE USING (is_admin());

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Creators view own payments"
  ON payments FOR SELECT USING (creator_id = auth.uid() OR is_admin());
CREATE POLICY "Admins manage payments"
  ON payments FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Invoice counters
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to invoice counters"
  ON invoice_counters FOR ALL USING (false) WITH CHECK (false);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (recipient_id = auth.uid() OR is_admin());
CREATE POLICY "Users can update own notification read state"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- Notification outbox
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own outbox records"
  ON notification_outbox FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.id = notification_outbox.notification_id
        AND n.recipient_id = auth.uid()
    )
    OR is_admin()
  );
