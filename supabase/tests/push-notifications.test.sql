-- Phone notifications: each person saves and sees only their own phones and
-- their own delivery log, a phone moves to whoever signs in on it, and the
-- log refuses a second send of the same reminder.

\set alice '\'a0000000-0000-0000-0000-000000000001\''
\set bob '\'b0000000-0000-0000-0000-000000000002\''

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

create function pg_temp.act_as(person uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', person)::text, false);
$$;

insert into auth.users (id, email) values (:alice, 'alice@example.com'), (:bob, 'bob@example.com');

set role authenticated;
select pg_temp.act_as(:alice);
select public.save_push_subscription('https://push.example.com/phone-1', 'key', 'secret', 'iPhone');
select pg_temp.expect((select count(*)::text from public.push_subscriptions), '1', 'Alice sees the phone she saved');
select pg_temp.expect_error($$select p256dh from public.push_subscriptions$$, 'the phone''s keys cannot be read back');
select pg_temp.expect_error($$insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example.com/x', 'k', 's')$$,
  'phones are saved only through save_push_subscription');

select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*)::text from public.push_subscriptions), '0', 'Bob cannot see Alice''s phone');
select public.save_push_subscription('https://push.example.com/phone-1', 'key2', 'secret2', 'iPhone');
select pg_temp.expect((select count(*)::text from public.push_subscriptions), '1', 'the phone moves to Bob when he signs in on it');
select pg_temp.act_as(:alice);
select pg_temp.expect((select count(*)::text from public.push_subscriptions), '0', 'and Alice no longer gets reminders on it');

select pg_temp.act_as(:bob);
select public.save_push_subscription('https://push.example.com/phone-2', 'k', 's', 'Android');
select pg_temp.act_as(:alice);
select public.forget_push_subscription('https://push.example.com/phone-2');
select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*)::text from public.push_subscriptions), '2', 'Alice cannot forget Bob''s phone');
select public.forget_push_subscription('https://push.example.com/phone-2');
select pg_temp.expect((select count(*)::text from public.push_subscriptions), '1', 'Bob forgets his own phone when he signs out');

-- A test that arrived is recorded on the phone it arrived on, by its own person only.
select pg_temp.act_as(:alice);
select public.confirm_push_test('https://push.example.com/phone-1');
select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*)::text from public.push_subscriptions where last_test_ok_at is not null), '0', 'Alice cannot record a test on Bob''s phone');
select public.confirm_push_test('https://push.example.com/phone-1');
select pg_temp.expect((select count(*)::text from public.push_subscriptions where last_test_ok_at is not null), '1', 'Bob records that a test reached his phone');
select pg_temp.expect_error($$update public.push_subscriptions set last_test_ok_at = now()$$, 'the time is recorded only through confirm_push_test');

select pg_temp.act_as(null);
select pg_temp.expect_error($$select public.save_push_subscription('https://push.example.com/y', 'k', 's', null)$$, 'a stranger cannot save a phone');
reset role;

-- The scheduler's log: one row per person per reminder.
set role service_role;
insert into public.notifications (profile_id, kind, ref, title, scheduled_for)
  values (:alice, 'dose_due', 'item:2026-10-13:08:00', 'Time for Bella''s Prednisolone', now());
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'dose_due', 'item:2026-10-13:08:00', 'again', now())$$, 'the same reminder is never logged twice');
reset role;

set role authenticated;
select pg_temp.act_as(:alice);
select pg_temp.expect((select count(*)::text from public.notifications), '1', 'Alice sees her own delivery log');
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'test', 'x', 'x', now())$$, 'people cannot write to the delivery log');
select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*)::text from public.notifications), '0', 'Bob cannot see Alice''s log');
reset role;

-- Email reminders: the same reminder by email is logged separately from the
-- phone notification, and still only once.
set role service_role;
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'dose_due', 'item:2026-10-13:08:00', 'email', 'Time for Bella''s Prednisolone', now());
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'dose_evening', 'item:2026-10-13:08:00', 'email', 'Bella''s Prednisolone still isn''t ticked today', now());
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'dose_evening', 'item:2026-10-13:08:00', 'email', 'again', now())$$, 'the same email is never logged twice');
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'dose_escalation', 'item:2026-10-13:08:00', 'push', 'Bella''s Prednisolone wasn''t logged today', now());
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'dose_escalation', 'item:2026-10-13:08:00', 'push', 'again', now())$$, 'an escalation is never logged twice');
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'test', 'y', 'sms', 'x', now())$$, 'only push and email are channels');
reset role;

-- Each person can turn their own reminder emails off, and nobody else's.
set role authenticated;
select pg_temp.act_as(:alice);
select pg_temp.expect((select email_reminders::text from public.profiles where id = :alice), 'true', 'reminder emails are on by default');
update public.profiles set email_reminders = false where id = :alice;
select pg_temp.expect((select email_reminders::text from public.profiles where id = :alice), 'false', 'Alice turns her reminder emails off');
select pg_temp.act_as(:bob);
update public.profiles set email_reminders = false where id = :alice;
reset role;
select pg_temp.expect((select count(*)::text from public.profiles where email_reminders = false), '1', 'Bob cannot change Alice''s setting');
