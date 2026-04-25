-- =============================================
-- Migration: Add task notes + weekly notes
-- =============================================
-- Run this in Supabase SQL Editor AFTER the initial schema

-- Add notes column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Weekly notes table: one entry per week
CREATE TABLE IF NOT EXISTS weekly_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week_start TEXT NOT NULL,     -- "2025-04-06" format (Sunday of that week)
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- RLS for weekly_notes
ALTER TABLE weekly_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON weekly_notes FOR ALL USING (true) WITH CHECK (true);
