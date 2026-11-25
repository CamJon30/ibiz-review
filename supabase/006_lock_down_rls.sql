-- =============================================
-- Lock the database to your login only
-- =============================================
-- BEFORE RUNNING:
--   1. Create your user: Supabase Dashboard > Authentication > Users > Add user
--      (tick "Auto Confirm User"), then copy that user's UUID.
--   2. Replace PASTE-USER-UUID-HERE below with that UUID (it appears once).
--   3. Turn OFF new signups: Authentication > Sign In / Providers > "Allow new users to sign up".
-- Run this AFTER the new app version is deployed and you have signed in once.
-- Until it runs, the database is still open to anyone with the anon key.

-- Single place that defines who the owner is
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$ SELECT auth.uid() = 'PASTE-USER-UUID-HERE'::uuid $$;

DO $$
DECLARE
  t text;
  p record;
BEGIN
  -- Tables the app reads and writes with your login
  FOREACH t IN ARRAY ARRAY['tasks','goals','pomodoro_sessions','weekly_notes','reminders','scorecard_reviews','cycle_themes']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY owner_only ON public.%I FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner())', t);
  END LOOP;

  -- Push subscriptions: only the server (service role key) touches this table.
  -- RLS on with no policies means the public anon key gets nothing.
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' LOOP
      EXECUTE format('DROP POLICY %I ON public.push_subscriptions', p.policyname);
    END LOOP;
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Check the result (optional): every app table should show owner_only, push_subscriptions none
-- SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY 1;
