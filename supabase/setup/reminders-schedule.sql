-- Runs the reminder scheduler every 5 minutes. Not a migration: it holds the
-- address of the live app and needs the shared secret, so it is run once by
-- hand in the Supabase SQL Editor, after the app has CRON_SECRET set.
--
-- Replace PASTE-THE-CRON-SECRET-HERE with the same value as CRON_SECRET in
-- Vercel. The secret is kept in Supabase Vault, not in the job itself.
-- Running this again is harmless: it replaces the job with the same name.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('PASTE-THE-CRON-SECRET-HERE', 'reminders_cron_secret')
 where not exists (select 1 from vault.secrets where name = 'reminders_cron_secret');

select cron.schedule(
  'tailhelm-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://www.tailhelm.com/api/reminders/run',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it is running, after 10 minutes:
--   select status, status_code, created from net._http_response order by created desc limit 5;
-- A status_code of 200 means the app ran the reminders.
