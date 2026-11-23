-- =============================================
-- Reset for a new 12 Week cycle (starts Sun 2026-11-22)
-- Run in Supabase SQL Editor. Previous data is deleted permanently.
-- =============================================

truncate table tasks restart identity;
truncate table pomodoro_sessions restart identity;
truncate table weekly_notes restart identity;
truncate table goals restart identity;

-- Optional: milestone reminders hold future deadlines, so they are kept by default.
-- truncate table reminders restart identity;

-- Optional: run ONLY after rotating the VAPID keys. Old subscriptions stop working
-- once the keys change, and each device re-subscribes when notifications are re-enabled.
-- truncate table push_subscriptions restart identity;

-- Run separately if you also want a clean scorecard history (table is not in schema.sql):
-- truncate table scorecard_reviews restart identity;
