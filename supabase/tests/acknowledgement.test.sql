-- The setup acknowledgement: each person records their own, once per wording
-- version, sees only their own, and cannot change or remove it afterwards.

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
insert into public.consents (profile_id, kind, version) values (:alice, 'acknowledgement', '2026-10-09');
select pg_temp.expect((select count(*)::text from public.consents where accepted_at is not null), '1', 'Alice records the acknowledgement, dated');
select pg_temp.expect_error($$insert into public.consents (profile_id, kind, version)
  values ('a0000000-0000-0000-0000-000000000001', 'acknowledgement', '2026-10-09')$$, 'the same version is recorded once');
select pg_temp.expect_error($$insert into public.consents (profile_id, kind, version)
  values ('b0000000-0000-0000-0000-000000000002', 'acknowledgement', '2026-10-09')$$, 'nobody records it for someone else');
select pg_temp.expect_error($$update public.consents set version = 'x'$$, 'a recorded acknowledgement cannot be changed');
select pg_temp.expect_error($$delete from public.consents$$, 'a recorded acknowledgement cannot be removed');

select pg_temp.act_as(:bob);
select pg_temp.expect((select count(*)::text from public.consents), '0', 'Bob cannot see Alice''s acknowledgement');
reset role;
