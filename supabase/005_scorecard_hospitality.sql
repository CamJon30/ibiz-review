-- =============================================
-- Migration: Scorecard for Christian Xavier Hospitality Group (Cycle 1)
-- =============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Adds columns for the new metrics. Old columns and old rows are left in place.
-- followup_status and building_distracted are reused (same meaning).

ALTER TABLE scorecard_reviews
  ADD COLUMN IF NOT EXISTS partner_outreach_count INTEGER,
  ADD COLUMN IF NOT EXISTS mom_test_count         INTEGER,
  ADD COLUMN IF NOT EXISTS venues_added           INTEGER,
  ADD COLUMN IF NOT EXISTS ops_sync_status        TEXT,
  ADD COLUMN IF NOT EXISTS reading_status         TEXT,
  ADD COLUMN IF NOT EXISTS craft_sessions         INTEGER;

-- The new form no longer writes the legacy metric columns, so make sure they
-- do not block a save. (Safe to run even if they were never NOT NULL.)
ALTER TABLE scorecard_reviews
  ALTER COLUMN outreach_count  DROP NOT NULL,
  ALTER COLUMN consults_booked DROP NOT NULL,
  ALTER COLUMN prospects_added DROP NOT NULL,
  ALTER COLUMN cert_hours      DROP NOT NULL,
  ALTER COLUMN mentor_status   DROP NOT NULL,
  ALTER COLUMN intel_status    DROP NOT NULL;
