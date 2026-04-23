-- Per-notification-type email preferences
--
-- Replaces the single email_notifications_enabled boolean (added in 0008)
-- with one column per notification type, so users can opt in/out of each
-- transactional flow individually.
--
-- To preserve user intent across the upgrade, the previous global opt-out
-- is copied into every new column: if a user had turned off all emails
-- before, they stay off for every type. Users who were opted in default
-- to opted in for every type, matching the current behaviour.

ALTER TABLE profiles
  ADD COLUMN notify_submissions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN notify_new_briefs BOOLEAN NOT NULL DEFAULT TRUE;

-- Preserve any prior global opt-outs
UPDATE profiles
SET
  notify_submissions = email_notifications_enabled,
  notify_new_briefs = email_notifications_enabled;

ALTER TABLE profiles DROP COLUMN email_notifications_enabled;

COMMENT ON COLUMN profiles.notify_submissions IS
  'When FALSE, admins are excluded from notify-submission emails sent when creators submit work for review.';
COMMENT ON COLUMN profiles.notify_new_briefs IS
  'When FALSE, creators are excluded from notify-new-brief emails sent when a new brief is published.';
