-- The watchdogs: the delivery log takes the monthly test and the reminder
-- health emails, each still once per person, and the daily check claims each
-- day once and is hidden from everyone signed in.

\set alice '\'a0000000-0000-0000-0000-000000000001\''

\o /dev/null

create function pg_temp.expect(actual text, expected text, label text) returns void
language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL: % (expected %, got %)', label, expected, actual;
  end if;
  raise notice 'ok: %', label;
end;
$$;

create function pg_temp.expect_error(statement text, label text) returns void
language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok: % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (no error)', label;
end;
$$;

insert into auth.users (id, email) values (:alice, 'alice@example.com');

set role service_role;
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'monthly_test', '2026-10-17', 'push', 'Monthly reminder test', now());
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'phone_lost', 'row-1', 'email', 'Bella''s reminders can no longer reach your iPhone', now());
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'test_unconfirmed', 'row-2', 'email', 'Bella''s reminders may not reach you', now());
select pg_temp.expect((select count(*)::text from public.notifications), '3', 'the log takes the monthly test and both health emails');
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'monthly_test', '2026-10-17', 'push', 'again', now())$$, 'a monthly test goes once a day at most');
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'phone_lost', 'row-1', 'email', 'again', now())$$, 'a lost phone is emailed about once');

insert into public.reminder_checks (day) values ('2026-10-16');
select pg_temp.expect((select status from public.reminder_checks where day = '2026-10-16'), 'running', 'a day is claimed before it is checked');
select pg_temp.expect_error($$insert into public.reminder_checks (day) values ('2026-10-16')$$, 'each day is checked once');
update public.reminder_checks set status = 'done', finished_at = now(), expected = 7, not_sent = 1, not_delivered = 0,
  gaps = '[{"dogId": "d", "kind": "dose_due", "ref": "x", "problem": "not_sent"}]' where day = '2026-10-16';
select pg_temp.expect((select not_sent::text from public.reminder_checks where day = '2026-10-16'), '1', 'the result is kept with the day');
select pg_temp.expect_error($$update public.reminder_checks set status = 'maybe'$$, 'a check is running, done or failed');
reset role;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :alice)::text, false);
select pg_temp.expect_error($$select count(*) from public.reminder_checks$$, 'nobody signed in can read the daily checks');
select pg_temp.expect_error($$insert into public.reminder_checks (day) values ('2026-10-17')$$, 'or write them');
reset role;
