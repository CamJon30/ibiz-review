-- =============================================
-- 12 Week Year Tracker - Supabase Schema v2
-- =============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
--
-- IF YOU ALREADY HAVE v1 TABLES, run the migration
-- section at the bottom instead of the full CREATE.
-- =============================================

-- Tasks table: one row per task, now with notes
CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date TEXT NOT NULL,
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals table: 12-week quarter goals
CREATE TABLE IF NOT EXISTS goals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pomodoro sessions: track daily focus sessions
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  UNIQUE(date)
);

-- Weekly notes: free-form reflections per week
CREATE TABLE IF NOT EXISTS weekly_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week_start TEXT NOT NULL,
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Push subscriptions: store browser push endpoints
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Milestone reminders: upcoming deadlines and events
CREATE TABLE IF NOT EXISTS reminders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  due_date TEXT NOT NULL,
  notes TEXT DEFAULT '',
  alert_days JSONB DEFAULT '[7, 1]',
  notified_days JSONB DEFAULT '[]',
  done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_pomo_date ON pomodoro_sessions(date);
CREATE INDEX IF NOT EXISTS idx_weekly_notes_week ON weekly_notes(week_start);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON pomodoro_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weekly_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON reminders FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- MIGRATION FROM v2 to v3:
-- If you already have v2 tables, run ONLY these:
-- =============================================
-- CREATE TABLE IF NOT EXISTS reminders (
--   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--   title TEXT NOT NULL,
--   due_date TEXT NOT NULL,
--   notes TEXT DEFAULT '',
--   alert_days JSONB DEFAULT '[7, 1]',
--   notified_days JSONB DEFAULT '[]',
--   done BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);
-- ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all" ON reminders FOR ALL USING (true) WITH CHECK (true);
