-- The calendar feed: a household member makes a link, a calendar app reads it
-- with no sign-in, and a replaced or stopped link, or a dog no longer active,
-- reads as an empty plan. The token itself is never stored.

\set alice '\'a0000000-0000-0000-0000-000000000001\''
\set carol '\'c0000000-0000-0000-0000-000000000003\''
\set token1 '\'tok1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\''
\set token2 '\'tok2-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\''

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

create function pg_temp.hash(t text) returns text
language sql as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;

insert into auth.users (id, email) values (:alice, 'alice@example.com'), (:carol, 'carol@example.com');

set role authenticated;
select pg_temp.act_as(:alice);
select public.create_dog('Bella') as bella \gset
insert into public.dog_conditions (dog_id, condition_key, pack_version, variant)
  values (:'bella', 'addisons', '0.2.0', 'typical') returning id as cond \gset
insert into public.plan_items (dog_condition_id, pack_key, kind, product, dose_amount, dose_unit,
                               schedule_kind, schedule_json, set_by_vet_on)
  values (:'cond', 'glucocorticoid', 'medicine', 'Prednisolone', 2.5, 'mg',
          'fixed', '{"kind":"fixed","times":["08:00"]}', '2026-09-12');

-- A stranger cannot make a link for Bella.
select pg_temp.act_as(:carol);
select pg_temp.expect_error(format($$select public.new_calendar_feed(%L, %L)$$, :'bella', pg_temp.hash(:token1)),
  'a stranger cannot make a calendar link');

select pg_temp.act_as(:alice);
select public.new_calendar_feed(:'bella', pg_temp.hash(:token1));

-- A calendar app reads it signed out.
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select public.calendar_feed(:token1) as feed \gset
select pg_temp.expect((:'feed'::jsonb) ->> 'dog_name', 'Bella', 'the feed reads without sign-in');
select pg_temp.expect((:'feed'::jsonb) ->> 'live', 'true', 'a new link is live');
select pg_temp.expect(jsonb_array_length((:'feed'::jsonb) -> 'items')::text, '1', 'the feed carries the plan');
select pg_temp.expect(((:'feed'::jsonb)::text like '%2.5%' or (:'feed'::jsonb)::text like '%dose%')::text, 'false',
  'the feed never carries a dose');
select pg_temp.expect(public.calendar_feed('wrong-token-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')::text, null, 'an unknown link reads nothing');
select pg_temp.expect_error('select * from public.calendar_feeds', 'a signed-out visitor cannot list feeds');

-- A new link replaces the old one, which reads as empty.
reset role;
set role authenticated;
select pg_temp.act_as(:alice);
select public.new_calendar_feed(:'bella', pg_temp.hash(:token2));
select pg_temp.expect((select count(*) from public.calendar_feeds where revoked_at is null)::text, '1', 'one live link per dog');
select pg_temp.expect(public.calendar_feed(:token1) ->> 'live', 'false', 'the replaced link reads as empty');
select pg_temp.expect(public.calendar_feed(:token2) ->> 'live', 'true', 'the new link is live');

-- Each calendar app has its own link; removing one leaves the other.
select public.new_calendar_feed(:'bella', pg_temp.hash(:token2 || 'apple'), 'apple');
select pg_temp.expect((select count(*) from public.calendar_feeds where revoked_at is null)::text, '2', 'one live link per calendar app');
select pg_temp.expect((select app from public.calendar_feeds where revoked_at is null and app <> 'other'), 'apple', 'the household sees which app a link is for');
select public.revoke_calendar_feed(:'bella', 'apple');
select pg_temp.expect(public.calendar_feed(:token2 || 'apple') ->> 'live', 'false', 'a removed app link reads as empty');
select pg_temp.expect(public.calendar_feed(:token2) ->> 'live', 'true', 'the other app keeps its link');

-- Stopping the link empties the calendar.
select public.revoke_calendar_feed(:'bella');
select pg_temp.expect(public.calendar_feed(:token2) ->> 'live', 'false', 'a stopped link reads as empty');

-- A dog marked as died empties the calendar too.
select public.new_calendar_feed(:'bella', pg_temp.hash(:token1 || 'x'));
update public.dogs set status = 'passed_away' where id = :'bella';
select pg_temp.expect(public.calendar_feed(:token1 || 'x') ->> 'live', 'false', 'a dog no longer active has an empty calendar');

reset role;
