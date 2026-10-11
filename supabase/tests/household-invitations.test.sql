-- Invitations: the owner invites by email, the person with that email sees
-- and accepts it, a stranger cannot, and a member can leave.

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
  (:bob, 'Bob@Example.com'),
  (:carol, 'carol@example.com'),
  (:dave, 'dave@example.com');

set role authenticated;
select pg_temp.act_as(:alice);
select public.create_dog('Bella') as bella \gset
insert into public.household_members (dog_id, invited_email) values (:'bella', 'bob@example.com');
select pg_temp.expect_error(
  format($$insert into public.household_members (dog_id, invited_email) values (%L, 'BOB@example.com')$$, :'bella'),
  'an address can hold only one open invitation per dog');

-- Carol cannot see or accept Bob's invitation.
select pg_temp.act_as(:carol);
select pg_temp.expect((select count(*) from public.my_invitations()), 0, 'a stranger sees no invitation');
reset role;
select id as invite from public.household_members where invited_email = 'bob@example.com' \gset
set role authenticated;
select pg_temp.act_as(:carol);
select pg_temp.expect_error(format($$select public.accept_invitation(%L)$$, :'invite'),
  'a stranger cannot accept someone else''s invitation');
select pg_temp.expect((select count(*) from public.dogs), 0, 'a stranger still sees no dog');

-- Bob sees it, matched by email whatever the case, and accepts.
select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*) from public.my_invitations() where dog_name = 'Bella' and invited_by = 'alice'), 1,
  'the invited person sees the invitation with the dog and who sent it');
select pg_temp.expect((select count(*) from public.dogs), 0, 'an invitation alone shows no records');
select public.accept_invitation(:'invite') as accepted \gset
select pg_temp.expect((select count(*) from public.dogs where id = :'accepted'), 1, 'accepting returns the dog');
select pg_temp.expect((select count(*) from public.dogs), 1, 'after accepting, the member sees the dog');
select pg_temp.expect((select count(*) from public.my_invitations()), 0, 'the invitation is no longer open');

-- Dave declines his.
select pg_temp.act_as(:alice);
insert into public.household_members (dog_id, invited_email) values (:'bella', 'dave@example.com');
select pg_temp.act_as(:dave);
select id as dave_invite from public.my_invitations() \gset
select public.decline_invitation(:'dave_invite');
select pg_temp.expect((select count(*) from public.my_invitations()), 0, 'a declined invitation is gone');
select pg_temp.expect((select count(*) from public.dogs), 0, 'declining gives no access');

-- Household size: Alice, Bob and one open invitation fill it.
select pg_temp.act_as(:alice);
insert into public.household_members (dog_id, invited_email) values (:'bella', 'carol@example.com');
select pg_temp.expect_error(
  format($$insert into public.household_members (dog_id, invited_email) values (%L, 'eve@example.com')$$, :'bella'),
  'a fourth person cannot be invited');

-- Bob leaves; the owner cannot.
select pg_temp.act_as(:bob);
select public.leave_household(:'bella');
select pg_temp.expect((select count(*) from public.dogs), 0, 'a member who leaves loses access at once');
select pg_temp.act_as(:alice);
select public.leave_household(:'bella');
select pg_temp.expect((select count(*) from public.dogs), 1, 'the owner cannot leave');

-- Alice cancels Carol's invitation and invites Bob back; he gets his old membership back.
with cancelled as (
  update public.household_members set status = 'revoked', revoked_at = now()
   where invited_email = 'carol@example.com' and status = 'invited' returning 1)
select pg_temp.expect(count(*), 1, 'the owner can cancel an invitation') from cancelled;
insert into public.household_members (dog_id, invited_email) values (:'bella', 'bob@example.com');
select pg_temp.act_as(:bob);
select id as again from public.my_invitations() \gset
select public.accept_invitation(:'again');
select pg_temp.expect((select count(*) from public.dogs), 1, 'someone invited back regains access');
select pg_temp.expect((select count(*) from public.household_members where profile_id = :bob), 1,
  'and keeps a single membership');

reset role;
