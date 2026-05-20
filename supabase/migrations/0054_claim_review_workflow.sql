-- Claim review workflow: revision_requested status + threaded comments
--
-- Adds a back-and-forth review loop so an org can request changes on a
-- submission instead of binary approve/reject, and the creator can read
-- feedback + re-upload. Comments are a thread (both sides post), not a
-- single feedback field, so future rounds keep their context.
--
-- Status state machine after this migration:
--   active            -> submitted | cancelled
--   submitted         -> approved | revision_requested | cancelled
--   revision_requested-> submitted | cancelled
--   approved          -> paid
--   paid              -> (terminal)
--   cancelled         -> (terminal)
--
-- The state machine is enforced in the server actions that call
-- .update(); we also extend the existing CHECK constraint on
-- claims.status below so a bad value would be rejected at the DB
-- level. The trigger only adds the new notification branch; all
-- existing transitions are unchanged.

-- ============================================================
-- 1. Extend claims.status CHECK to include the new state
-- ============================================================
-- 0002_multi_claim.sql created an inline CHECK constraint on
-- claims.status. Postgres auto-named it claims_status_check (the
-- standard <table>_<column>_check pattern). Drop + recreate so
-- 'revision_requested' is allowed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'claims_status_check' AND conrelid = 'claims'::regclass
  ) THEN
    ALTER TABLE claims DROP CONSTRAINT claims_status_check;
  END IF;
END;
$$;

ALTER TABLE claims
  ADD CONSTRAINT claims_status_check
  CHECK (status IN (
    'active',
    'submitted',
    'revision_requested',
    'approved',
    'paid',
    'cancelled'
  ));

-- ============================================================
-- 2. New notification event type for "org requested changes"
-- ============================================================
DO $$
BEGIN
  ALTER TYPE notification_event_type ADD VALUE IF NOT EXISTS 'claim_revision_requested';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- ============================================================
-- 3. Brand kit visibility includes revision_requested
-- ============================================================
-- 0041 listed the "live enough" statuses inline. Update so a
-- creator awaiting revisions still has read access to the org's
-- brand kit (they need it to produce the revised asset).
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
        AND c.status IN ('active', 'submitted', 'revision_requested', 'approved', 'paid')
    )
  );

-- ============================================================
-- 4. claim_comments table
-- ============================================================
CREATE TABLE IF NOT EXISTS claim_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  -- Nullable because we want comment threads to survive profile
  -- deletion (audit trail). NULL renders as "deleted user" in UI.
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  -- Disambiguates which side wrote it without joining memberships at
  -- read time. The corresponding RLS INSERT policies enforce that the
  -- value matches the author's actual relationship to the claim.
  author_role text NOT NULL CHECK (author_role IN ('org', 'creator')),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claim_comments_claim_id_created_idx
  ON claim_comments (claim_id, created_at);

ALTER TABLE claim_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: the claim's creator can read the thread on their own claim.
DROP POLICY IF EXISTS "Claim creator reads own comments" ON claim_comments;
CREATE POLICY "Claim creator reads own comments"
  ON claim_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM claims
      WHERE claims.id = claim_comments.claim_id
        AND claims.user_id = auth.uid()
    )
  );

-- SELECT: any active member (admin or member) of the claim's org can
-- read the thread. Mirrors claim_attachments read access.
DROP POLICY IF EXISTS "Org members read claim comments" ON claim_comments;
CREATE POLICY "Org members read claim comments"
  ON claim_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM claims
      WHERE claims.id = claim_comments.claim_id
        AND is_org_member(claims.org_id)
    )
  );

-- INSERT: claim's creator can post with author_role='creator'.
DROP POLICY IF EXISTS "Claim creator inserts own comments" ON claim_comments;
CREATE POLICY "Claim creator inserts own comments"
  ON claim_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND author_role = 'creator'
    AND EXISTS (
      SELECT 1 FROM claims
      WHERE claims.id = claim_comments.claim_id
        AND claims.user_id = auth.uid()
    )
  );

-- INSERT: active org members can post with author_role='org'.
DROP POLICY IF EXISTS "Org members insert org comments" ON claim_comments;
CREATE POLICY "Org members insert org comments"
  ON claim_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND author_role = 'org'
    AND EXISTS (
      SELECT 1 FROM claims
      WHERE claims.id = claim_comments.claim_id
        AND is_org_member(claims.org_id)
    )
  );

-- No UPDATE / DELETE policies. Comments are immutable from the app
-- surface (would muddy a feedback record); ops can edit via service
-- role if needed.

-- ============================================================
-- 5. Update claim notification trigger to handle revision_requested
-- ============================================================
-- Adds a new branch for submitted -> revision_requested. The body is
-- intentionally generic; the actual feedback lives in claim_comments
-- and the creator opens the claim to read it. Existing transitions
-- (approved / paid / cancelled / etc) are unchanged.
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
    ELSIF NEW.status = 'revision_requested' THEN
      PERFORM create_notification_for_user(
        NEW.user_id, v_actor, 'claim_revision_requested', 'Changes requested on your submission',
        COALESCE(v_brief_title, 'The org has requested changes. Open the brief to read the feedback.'),
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
      ELSIF OLD.status = 'active' OR OLD.status = 'revision_requested' THEN
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
ALTER FUNCTION create_claim_notifications() OWNER TO postgres;
