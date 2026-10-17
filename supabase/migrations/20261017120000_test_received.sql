-- Reminder health: "last test received". When someone says a test
-- notification arrived, the phone it arrived on records the time, so the
-- Reminders screen can show when a test last got through.

alter table public.push_subscriptions add column last_test_ok_at timestamptz;
grant select (last_test_ok_at) on public.push_subscriptions to authenticated;

-- Records that a test reached this phone, for the person signed in on it.
create function public.confirm_push_test(endpoint text) returns void
language sql security definer set search_path = '' as $$
  update public.push_subscriptions s
     set last_test_ok_at = now()
   where s.endpoint = confirm_push_test.endpoint and s.profile_id = (select auth.uid());
$$;

revoke all on function public.confirm_push_test(text) from public, anon;
grant execute on function public.confirm_push_test(text) to authenticated;
