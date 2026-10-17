-- Reminder layer 4: a dose still not ticked at +4 hours or 21:00, whichever is
-- sooner, is passed to the rest of the household. It is logged like every other
-- reminder, once per person per channel.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('test', 'dose_due', 'dose_not_ticked', 'dose_evening', 'dose_escalation', 'dose_ticked', 'injection_soon', 'injection_overdue', 'test_due'));
