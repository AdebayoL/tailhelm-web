-- The care team's history: when each person joined, which invitations were
-- declined, invitations closing after 7 days, and who last recorded what.

\set alice '\'a0000000-0000-0000-0000-000000000001\''
\set bob   '\'b0000000-0000-0000-0000-000000000002\''
\set carol '\'c0000000-0000-0000-0000-000000000003\''
\set dave  '\'d0000000-0000-0000-0000-000000000004\''

\o /dev/null

create function pg_temp.expect(actual bigint, expected bigint, label text) returns void
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
  (:carol, 'carol@example.com'),
  (:dave, 'dave@example.com');

set role authenticated;
select pg_temp.act_as(:alice);
select public.create_dog('Bella') as bella \gset
select pg_temp.expect((select count(*) from public.household_members where profile_id = :alice and joined_at is not null), 1,
  'the owner joins when they add the dog');

-- Bob accepts and joins; Dave declines.
insert into public.household_members (dog_id, invited_email) values (:'bella', 'bob@example.com');
insert into public.household_members (dog_id, invited_email) values (:'bella', 'dave@example.com');
select pg_temp.expect((select count(*) from public.household_members where invited_email = 'bob@example.com' and joined_at is null), 1,
  'an invitation has not joined');
select pg_temp.act_as(:bob);
select id as bob_invite from public.my_invitations() \gset
select public.accept_invitation(:'bob_invite');
select pg_temp.act_as(:dave);
select id as dave_invite from public.my_invitations() \gset
select public.decline_invitation(:'dave_invite');
select pg_temp.act_as(:alice);
select pg_temp.expect((select count(*) from public.household_members where profile_id = :bob and joined_at >= invited_at), 1,
  'accepting records when they joined');
select pg_temp.expect((select count(*) from public.household_members where invited_email = 'dave@example.com'
                         and status = 'revoked' and declined_at is not null), 1,
  'the owner sees that an invitation was declined');

-- Carol's invitation is 8 days old: closed, and it holds no place.
insert into public.household_members (dog_id, invited_email) values (:'bella', 'carol@example.com');
reset role;
update public.household_members set invited_at = now() - interval '8 days' where invited_email = 'carol@example.com';
select id as carol_invite from public.household_members where invited_email = 'carol@example.com' \gset
set role authenticated;
select pg_temp.act_as(:carol);
select pg_temp.expect((select count(*) from public.my_invitations()), 0, 'an invitation older than 7 days is not shown');
select pg_temp.expect_error(format($$select public.accept_invitation(%L)$$, :'carol_invite'),
  'an invitation older than 7 days cannot be accepted');
select pg_temp.expect((select count(*) from public.dogs), 0, 'so it gives no access');

select pg_temp.act_as(:alice);
insert into public.household_members (dog_id, invited_email) values (:'bella', 'eve@example.com');
select pg_temp.expect((select count(*) from public.household_members where invited_email = 'eve@example.com'), 1,
  'a closed invitation frees its place');
select pg_temp.expect_error(
  format($$update public.household_members set invited_at = now() where id = %L$$, :'carol_invite'),
  'sending an invitation again needs a free place');

-- Alice cancels Eve's invitation and sends Carol's again.
update public.household_members set status = 'revoked', revoked_at = now() where invited_email = 'eve@example.com';
update public.household_members set invited_at = now() where id = :'carol_invite';
select pg_temp.act_as(:carol);
select pg_temp.expect((select count(*) from public.my_invitations()), 1, 'an invitation sent again is open for another 7 days');

-- Who last recorded something.
select pg_temp.act_as(:bob);
insert into public.events (dog_id, kind, started_at) values (:'bella', 'stressful_event', now() - interval '1 hour');
select pg_temp.act_as(:alice);
select pg_temp.expect((select count(*) from public.household_last_recorded(:'bella')
                        where profile_id = :bob and recorded_at > now() - interval '1 minute'), 1,
  'the household sees when a member last recorded something');
select pg_temp.expect((select count(*) from public.household_last_recorded(:'bella') where profile_id = :alice), 0,
  'someone who has recorded nothing has no date');
select pg_temp.act_as(:dave);
select pg_temp.expect((select count(*) from public.household_last_recorded(:'bella')), 0,
  'someone outside the household sees nothing');

reset role;
