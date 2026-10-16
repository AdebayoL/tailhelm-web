-- Email reminders: reminder layer 3.
--
-- An email goes out when a dose is not ticked 2 hours after its time, again
-- at 21:00 if it is still not ticked, and for injections coming up or
-- overdue. Each person can turn their reminder emails off. Emails carry
-- medicine names, times and dates, never a dose.

alter table public.profiles add column email_reminders boolean not null default true;
grant update (email_reminders) on public.profiles to authenticated;

-- The delivery log now records emails as well as phone notifications, and
-- the 21:00 "still not ticked" message.
alter table public.notifications drop constraint notifications_channel_check;
alter table public.notifications add constraint notifications_channel_check check (channel in ('push', 'email'));
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('test', 'dose_due', 'dose_not_ticked', 'dose_evening', 'dose_ticked', 'injection_soon', 'injection_overdue', 'test_due'));
