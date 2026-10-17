-- Plus for the history line: the dog has it when anyone active in its
-- household does, nobody can give it to themselves, and a stranger learns nothing.

\set alice '\'a0000000-0000-0000-0000-000000000001\''
\set bob   '\'b0000000-0000-0000-0000-000000000002\''
\set carol '\'c0000000-0000-0000-0000-000000000003\''

\o /dev/null

create function pg_temp.expect(actual boolean, expected boolean, label text) returns void
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

select pg_temp.act_as(:alice);
select pg_temp.expect(public.dog_has_plus(:'bella'), false, 'everyone starts on free');
select pg_temp.expect_error($$update public.profiles set plan_status = 'plus' where id = auth.uid()$$,
  'nobody can give themselves Plus');
select pg_temp.expect_error($$update public.profiles set plan_ends_at = now() + interval '1 year' where id = auth.uid()$$,
  'nobody can extend their own Plus');

-- Bob pays: the whole household sees the dog's full history.
reset role;
update public.profiles set plan_status = 'plus', plan_ends_at = now() + interval '1 year' where id = :bob;
set role authenticated;
select pg_temp.expect(public.dog_has_plus(:'bella'), true, 'the owner sees Plus that another member pays for');
select pg_temp.act_as(:bob);
select pg_temp.expect(public.dog_has_plus(:'bella'), true, 'the member who pays sees it');
select pg_temp.act_as(:carol);
select pg_temp.expect(public.dog_has_plus(:'bella'), false, 'someone outside the household learns nothing');

-- Plus that has ended, or a member who has left, no longer counts.
reset role;
update public.profiles set plan_ends_at = now() - interval '1 day' where id = :bob;
set role authenticated;
select pg_temp.act_as(:alice);
select pg_temp.expect(public.dog_has_plus(:'bella'), false, 'Plus that has ended is free again');
reset role;
update public.profiles set plan_ends_at = null where id = :bob;
update public.household_members set status = 'revoked', revoked_at = now() where profile_id = :bob;
set role authenticated;
select pg_temp.expect(public.dog_has_plus(:'bella'), false, 'Plus held by someone who has left the household does not count');
