-- Account-type fork: every user is either a 'creator' or 'org' account.
--
-- The split is enforced at three layers:
--   1. profiles.account_type column (single source of truth)
--   2. memberships trigger (a creator can only hold creator memberships;
--      an org user can hold one admin/member membership in exactly one org)
--   3. RLS on app-facing tables (org_applications, claims) that gate
--      action-taking by the user's account type
--
-- Org teammates: the user_role enum was extended in 0032 with 'member'.
-- An org has one 'owner' (tracked on organizations.owner_id) plus any
-- number of 'admin' or 'member' teammates via memberships.
--
-- Invites: invite_codes grows two new columns so the same table can
-- carry three intents:
--   * platform admin invites first org owner   → role=admin,  type=org
--   * org admin invites teammate               → role=admin/member, type=org
--   * org admin invites creator (existing flow)→ role=creator, type=creator
-- use_invite_code() is rewritten to honor those fields.

-- ============================================================
-- Schema additions
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'creator'
    CHECK (account_type IN ('creator', 'org'));

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

ALTER TABLE invite_codes
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'creator'
    CHECK (role IN ('creator', 'admin', 'member')),
  ADD COLUMN IF NOT EXISTS intended_account_type TEXT NOT NULL DEFAULT 'creator'
    CHECK (intended_account_type IN ('creator', 'org'));

-- Internal sanity: an invite for a creator must use role=creator,
-- and an invite for an org must use role=admin or role=member.
ALTER TABLE invite_codes
  DROP CONSTRAINT IF EXISTS invite_codes_role_matches_account_type;
ALTER TABLE invite_codes
  ADD CONSTRAINT invite_codes_role_matches_account_type
    CHECK (
      (intended_account_type = 'creator' AND role = 'creator')
      OR
      (intended_account_type = 'org' AND role IN ('admin', 'member'))
    );

-- ============================================================
-- Backfill
-- ============================================================
--
-- Any user with at least one active admin membership becomes an
-- 'org' account. Everyone else stays 'creator' (the column default).
--
-- Edge case: a user who happens to have BOTH an admin membership and
-- a creator membership today is classified 'org' here. The trigger
-- below only fires on INSERT/UPDATE, so existing mixed rows keep
-- working — but the user can't add another creator membership until
-- the situation is resolved manually. In practice this only affects
-- a small handful of dev/seed accounts; we'll fix them by hand.

UPDATE profiles p
   SET account_type = 'org'
 WHERE EXISTS (
   SELECT 1 FROM memberships m
    WHERE m.user_id = p.id
      AND m.role = 'admin'
      AND m.status = 'active'
 );

-- For each org, backfill owner_id with its oldest active admin.
-- Orgs with no admin yet are left with owner_id = NULL and will get
-- their owner set the first time someone redeems an admin invite.

UPDATE organizations o
   SET owner_id = sub.user_id
  FROM (
    SELECT DISTINCT ON (org_id) org_id, user_id
      FROM memberships
     WHERE role = 'admin' AND status = 'active'
     ORDER BY org_id, created_at ASC
  ) AS sub
 WHERE o.id = sub.org_id
   AND o.owner_id IS NULL;

-- ============================================================
-- Helper: current user's account_type
-- ============================================================
--
-- SECURITY DEFINER so RLS policies that call this don't recurse
-- into profiles' own RLS.

CREATE OR REPLACE FUNCTION current_account_type()
RETURNS TEXT AS $$
  SELECT account_type FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Trigger: keep memberships.role aligned with profiles.account_type
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_membership_role_matches_account_type()
RETURNS TRIGGER AS $$
DECLARE
  v_acct TEXT;
  v_existing_org_count INT;
BEGIN
  SELECT account_type INTO v_acct
    FROM profiles
   WHERE id = NEW.user_id;

  IF v_acct IS NULL THEN
    RAISE EXCEPTION 'user has no profile (id=%)', NEW.user_id;
  END IF;

  IF v_acct = 'creator' AND NEW.role <> 'creator' THEN
    RAISE EXCEPTION
      'creator accounts can only hold creator memberships (got role=%)',
      NEW.role;
  END IF;

  IF v_acct = 'org' AND NEW.role = 'creator' THEN
    RAISE EXCEPTION
      'org accounts cannot hold creator memberships';
  END IF;

  -- Org accounts: one organization, period. We check on INSERT and
  -- on org_id changes via UPDATE.
  IF v_acct = 'org'
     AND (TG_OP = 'INSERT'
          OR (TG_OP = 'UPDATE' AND NEW.org_id <> OLD.org_id)) THEN
    SELECT COUNT(*) INTO v_existing_org_count
      FROM memberships
     WHERE user_id = NEW.user_id
       AND status = 'active'
       AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    IF v_existing_org_count > 0 THEN
      RAISE EXCEPTION
        'org accounts can only belong to one organization';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memberships_role_matches_account_type ON memberships;
CREATE TRIGGER memberships_role_matches_account_type
  BEFORE INSERT OR UPDATE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION enforce_membership_role_matches_account_type();

-- ============================================================
-- Rewrite use_invite_code() to honor invite.role and account_type
-- ============================================================

CREATE OR REPLACE FUNCTION use_invite_code(invite_code TEXT, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_invite invite_codes%ROWTYPE;
  v_account_type TEXT;
  v_has_memberships BOOLEAN;
BEGIN
  -- Find a valid unused code
  SELECT * INTO v_invite
    FROM invite_codes
   WHERE code = invite_code
     AND used_by IS NULL
     AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Load profile + check whether they already have memberships
  SELECT account_type INTO v_account_type
    FROM profiles
   WHERE id = user_uuid;

  IF v_account_type IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM memberships
     WHERE user_id = user_uuid AND status = 'active'
  ) INTO v_has_memberships;

  -- If the user is fresh (no active memberships), lock them to the
  -- invite's intended account type. If they already have memberships,
  -- the types must match — otherwise a creator can't redeem an
  -- org-teammate invite, and an org user can't redeem a creator invite.
  IF NOT v_has_memberships THEN
    UPDATE profiles
       SET account_type = v_invite.intended_account_type
     WHERE id = user_uuid;
    v_account_type := v_invite.intended_account_type;
  ELSIF v_account_type <> v_invite.intended_account_type THEN
    RAISE EXCEPTION
      'this invite is for % accounts but you have a % account',
      v_invite.intended_account_type, v_account_type;
  END IF;

  -- Mark the code consumed
  UPDATE invite_codes
     SET used_by = user_uuid, used_at = NOW()
   WHERE id = v_invite.id;

  -- Create the membership at the invite's role. The trigger will
  -- raise if the (account_type, role) pair is invalid or if an org
  -- account is trying to join a second org.
  INSERT INTO memberships (user_id, org_id, role, status)
  VALUES (user_uuid, v_invite.org_id, v_invite.role::user_role, 'active')
  ON CONFLICT (user_id, org_id) DO UPDATE SET status = 'active';

  -- First admin to land in an org becomes its owner
  IF v_invite.role = 'admin' THEN
    UPDATE organizations
       SET owner_id = user_uuid
     WHERE id = v_invite.org_id
       AND owner_id IS NULL;
  END IF;

  -- Set active org for fresh users
  UPDATE profiles
     SET active_org_id = v_invite.org_id
   WHERE id = user_uuid AND active_org_id IS NULL;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION use_invite_code(TEXT, UUID) OWNER TO postgres;

-- ============================================================
-- RLS adjustments: gate creator-only actions by account type
-- ============================================================
--
-- Org accounts must not be able to apply to other orgs from /discover
-- or claim briefs in their own org "as a creator". The trigger above
-- already prevents the underlying memberships, but actions still
-- pass through their own tables — we close the loop here.

DROP POLICY IF EXISTS "Users can apply to discoverable orgs" ON org_applications;
CREATE POLICY "Creator users can apply to discoverable orgs"
  ON org_applications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND current_account_type() = 'creator'
    AND EXISTS (
      SELECT 1 FROM organizations
       WHERE id = org_applications.org_id
         AND discoverable = TRUE
    )
  );

DROP POLICY IF EXISTS "Users create claims in org" ON claims;
CREATE POLICY "Creator users create claims in org"
  ON claims FOR INSERT
  WITH CHECK (
    org_id = active_org_id()
    AND user_id = auth.uid()
    AND current_account_type() = 'creator'
    AND NOT user_has_claimed(brief_id)
    AND user_not_in_reclaim_cooldown(brief_id)
    AND get_active_claim_count(brief_id) < (SELECT claim_limit FROM briefs WHERE id = brief_id)
    AND (SELECT status FROM briefs WHERE id = brief_id) = 'open'
  );
