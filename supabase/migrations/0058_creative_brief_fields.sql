-- Migration 0058: Creative brief canonical structure
--
-- Adds dedicated text columns matching the canonical creative-brief template
-- (Project, Objective, Audience, Insight, Message, Tone, Deliverables, Mandatories).
-- Project maps to the existing `title` column; the others are new.
--
-- Existing columns (`description`, `deliverable_specs`, `usage_rights`) are not
-- dropped here: data is preserved and the UI is migrated separately. The
-- `usage_rights` text is backfilled into `mandatories` so the new field is
-- populated for existing briefs.
--
-- All new columns are nullable. Required-on-publish semantics are enforced in
-- server actions, not the schema, so drafts remain frictionless to save.

alter table briefs
  add column if not exists objective text,
  add column if not exists audience text,
  add column if not exists insight text,
  add column if not exists message text,
  add column if not exists tone text,
  add column if not exists deliverables text,
  add column if not exists mandatories text;

update briefs
set mandatories = usage_rights
where usage_rights is not null
  and mandatories is null;
