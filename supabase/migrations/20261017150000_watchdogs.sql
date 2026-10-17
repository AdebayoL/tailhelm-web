-- The watchdogs: the monthly test notification, the reminder health emails,
-- and the daily reconciliation of reminders expected against reminders sent.
--
-- The delivery log takes three more kinds: the monthly test, the email when a
-- person's last phone stops getting notifications, and the email when a
-- monthly test goes unconfirmed. Like every reminder they carry no dose.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('test', 'dose_due', 'dose_not_ticked', 'dose_evening', 'dose_escalation', 'dose_ticked', 'injection_soon',
    'injection_overdue', 'test_due', 'monthly_test', 'phone_lost', 'test_unconfirmed'));

-- One row per day the scheduler has checked. The row is written before the
-- check starts, so a day is checked once however often the scheduler runs.
-- Gaps name dogs, plan items and kinds of reminder by id only. Nobody signed
-- in can read it: it is for the founder, through the dashboard.
create table public.reminder_checks (
  day date primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  expected integer check (expected >= 0),
  not_sent integer check (not_sent >= 0),
  not_delivered integer check (not_delivered >= 0),
  gaps jsonb
);

alter table public.reminder_checks enable row level security;
revoke all on public.reminder_checks from anon, authenticated;
grant select, insert, update on public.reminder_checks to service_role;
