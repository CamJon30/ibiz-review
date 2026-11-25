-- =============================================
-- Migration: 12 Week cycle theme
-- =============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- One row per cycle, keyed by the cycle start date (CYCLE_START in components/Tracker.js)

CREATE TABLE IF NOT EXISTS cycle_themes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_start TEXT NOT NULL UNIQUE,   -- "2026-11-22"
  theme TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cycle_themes ENABLE ROW LEVEL SECURITY;
-- Matches the other tables for now. Tighten together with them when auth is added.
CREATE POLICY "Allow all" ON cycle_themes FOR ALL USING (true) WITH CHECK (true);
