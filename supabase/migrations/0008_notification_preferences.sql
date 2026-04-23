-- Per-user email notification preferences
-- Lets users opt out of transactional emails (admins: submission alerts,
-- creators: new-brief alerts). Defaults to TRUE so existing users keep
-- receiving notifications until they explicitly opt out.

ALTER TABLE profiles
  ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN profiles.email_notifications_enabled IS
  'When FALSE, the user is excluded from role-specific transactional email flows (notify-submission for admins, notify-new-brief for creators). System-critical emails (auth, account recovery) are unaffected.';
