-- The delivery log takes one more kind: the notification the rest of the
-- household gets when a medicine is added to the plan, replaced or taken off,
-- because a calendar can take hours to show the change. It names the medicine
-- and its times, never a dose.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('test', 'dose_due', 'dose_not_ticked', 'dose_evening', 'dose_escalation', 'dose_ticked', 'plan_changed',
    'injection_soon', 'injection_overdue', 'test_due', 'monthly_test', 'phone_lost', 'test_unconfirmed'));
