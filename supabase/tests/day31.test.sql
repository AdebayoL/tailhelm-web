-- The day-31 moment is closed once per person, by that person only, and the
-- household learns who pays for Plus but nothing about their billing.

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

-- Each person closes it for themselves only.
select pg_temp.act_as(:alice);
select pg_temp.expect((select count(*)::text from public.household_members where dog_id = :'bella' and day31_seen_at is not null), '0',
  'nobody has seen the month yet');
select public.mark_day31_seen(:'bella');
select pg_temp.expect((select (day31_seen_at is not null)::text from public.household_members where dog_id = :'bella' and profile_id = :alice), 'true',
  'the owner closes it for themselves');
select pg_temp.expect((select (day31_seen_at is null)::text from public.household_members where dog_id = :'bella' and profile_id = :bob), 'true',
  'it stays open for the rest of the household');

select day31_seen_at as first_seen from public.household_members where dog_id = :'bella' and profile_id = :alice \gset
select public.mark_day31_seen(:'bella');
select pg_temp.expect((select day31_seen_at::text from public.household_members where dog_id = :'bella' and profile_id = :alice), :'first_seen',
  'closing it again keeps the first time');

select pg_temp.act_as(:carol);
select public.mark_day31_seen(:'bella');
reset role;
select pg_temp.expect((select (day31_seen_at is null)::text from public.household_members where dog_id = :'bella' and profile_id = :bob), 'true',
  'someone outside the household changes nothing');
set role authenticated;

select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*)::text from public.household_members where dog_id = :'bella' and day31_seen_at is not null), '1',
  'a member sees who has closed it');
select public.mark_day31_seen(:'bella');
select pg_temp.expect((select (day31_seen_at is not null)::text from public.household_members where dog_id = :'bella' and profile_id = :bob), 'true',
  'a member closes it for themselves');

-- Who pays for Plus.
select pg_temp.act_as(:alice);
select pg_temp.expect(public.dog_plus_payer(:'bella')::text, null, 'nobody pays on free');
reset role;
update public.profiles set plan_status = 'plus', plan_ends_at = now() + interval '1 year' where id = :bob;
set role authenticated;
select pg_temp.expect(public.dog_plus_payer(:'bella')::text, :bob, 'the owner sees who pays');
select pg_temp.act_as(:carol);
select pg_temp.expect(public.dog_plus_payer(:'bella')::text, null, 'someone outside the household learns nothing');

reset role;
update public.profiles set plan_status = 'plus', plan_ends_at = null where id = :alice;
set role authenticated;
select pg_temp.act_as(:bob);
select pg_temp.expect(public.dog_plus_payer(:'bella')::text, :alice, 'when two pay, the owner is named');

reset role;
update public.profiles set plan_status = 'free' where id = :alice;
update public.profiles set plan_ends_at = now() - interval '1 day' where id = :bob;
set role authenticated;
select pg_temp.expect(public.dog_plus_payer(:'bella')::text, null, 'Plus that has ended names nobody');
