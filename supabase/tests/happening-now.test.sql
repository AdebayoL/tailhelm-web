-- Happening now keeps one running timer per dog, shared by the household and
-- hidden from everyone else.

\set alice '\'a0000000-0000-0000-0000-000000000001\''
\set bob   '\'b0000000-0000-0000-0000-000000000002\''
\set carol '\'c0000000-0000-0000-0000-000000000003\''

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

insert into auth.users (id, email) values
  (:alice, 'alice@example.com'),
  (:bob, 'bob@example.com'),
  (:carol, 'carol@example.com');

set role authenticated;
select pg_temp.act_as(:alice);
select public.create_dog('Bella') as bella \gset
insert into public.household_members (dog_id, invited_email) values (:'bella', 'bob@example.com');
select pg_temp.act_as(:bob);
select id as bob_invite from public.my_invitations() \gset
select public.accept_invitation(:'bob_invite');

-- Alice starts it; Bob sees it running and cannot start a second.
select pg_temp.act_as(:alice);
insert into public.events (id, dog_id, kind, started_at, capture_mode)
  values ('e0000000-0000-0000-0000-000000000001', :'bella', 'happening_now', now() - interval '4 minutes', 'happening_now');
select pg_temp.act_as(:bob);
select pg_temp.expect((select recorded_by::text from public.events where capture_mode = 'happening_now' and ended_at is null), :alice,
  'the household sees who started it');
select pg_temp.expect_error(format($$insert into public.events (dog_id, kind, started_at, capture_mode)
  values (%L, 'happening_now', now(), 'happening_now')$$, :'bella'), 'a dog has one running at a time');

-- Bob stops it; then a new one can start.
update public.events set ended_at = now(), duration_s = 240 where id = 'e0000000-0000-0000-0000-000000000001' and ended_at is null;
select pg_temp.expect((select duration_s::text from public.events where id = 'e0000000-0000-0000-0000-000000000001'), '240',
  'anyone in the household can stop it');
insert into public.events (dog_id, kind, started_at, capture_mode) values (:'bella', 'happening_now', now(), 'happening_now');
select pg_temp.expect((select count(*)::text from public.events where capture_mode = 'happening_now'), '2',
  'a new one starts once the last has stopped');

-- Other kinds of event are never held to one at a time.
insert into public.events (dog_id, kind, started_at, capture_mode) values (:'bella', 'stressful_event', now(), 'logged');
insert into public.events (dog_id, kind, started_at, capture_mode) values (:'bella', 'stressful_event', now(), 'logged');
select pg_temp.expect((select count(*)::text from public.events where kind = 'stressful_event'), '2',
  'stressful days can overlap');

-- Someone outside the household sees nothing and starts nothing.
select pg_temp.act_as(:carol);
select pg_temp.expect((select count(*)::text from public.events), '0', 'a stranger sees no captures');
select pg_temp.expect_error(format($$insert into public.events (dog_id, kind, started_at, capture_mode)
  values (%L, 'happening_now', now() - interval '1 hour', 'happening_now')$$, :'bella'), 'a stranger cannot start one');

reset role;
