-- A plan change: the delivery log takes it, once per person and change.

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
  values (:alice, 'plan_changed', 'item-1:replaced', 'push', 'Sam changed Bella''s plan', now());
insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values (:alice, 'plan_changed', 'item-1:removed', 'push', 'Sam changed Bella''s plan', now());
select pg_temp.expect((select count(*)::text from public.notifications where kind = 'plan_changed'), '2', 'the log takes plan changes');
select pg_temp.expect_error($$insert into public.notifications (profile_id, kind, ref, channel, title, scheduled_for)
  values ('a0000000-0000-0000-0000-000000000001', 'plan_changed', 'item-1:replaced', 'push', 'again', now())$$, 'each change is sent to a person once');
reset role;
