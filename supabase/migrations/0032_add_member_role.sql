-- Extend user_role with 'member' so org accounts can have non-admin
-- teammates (admin = full access including billing/settings/team;
-- member = limited access).
--
-- This migration is intentionally tiny and lives alone because
-- Postgres won't let a newly-added enum value be referenced inside
-- the same transaction that adds it. The next migration (0033) is
-- the first one that consumes 'member', so it has to run after this
-- one has committed.
--
-- Existing data is unaffected: every row in memberships today is
-- either 'creator' or 'admin', and 'member' is purely additive.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'member';
