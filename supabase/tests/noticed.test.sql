-- Noticed: only the scheduler writes an observation; the household reads it
-- and marks it; nobody else sees it; each dog is looked at once a day.

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
select pg_temp.act_as(:carol);
select public.create_dog('Rex') as rex \gset

-- The scheduler claims each dog once a day, and saves what it found.
reset role;
select set_config('request.jwt.claims', '', false);
set role service_role;
select pg_temp.expect((select count(*)::text from public.claim_noticed('2026-10-25', 10)), '2', 'the first run of the day claims every dog');
select pg_temp.expect((select count(*)::text from public.claim_noticed('2026-10-25', 10)), '0', 'a second run the same day claims none');
select pg_temp.expect((select count(*)::text from public.claim_noticed('2026-10-26', 1)), '1', 'the next day claims them again, as many as asked');
select pg_temp.expect((select count(*)::text from public.claim_noticed('2026-10-26', 10)), '1', '...and the rest on the next run');

insert into public.observations_noticed (id, dog_id, rule_family, rule_key, fingerprint, computed_on, window_start, window_end, evidence_json, copy)
values ('f0000000-0000-0000-0000-000000000001', :'bella', 'direction', 'na_k_ratio', 'direction:na_k_ratio:down:x', '2026-10-25', '2026-10-01', '2026-10-25',
  '{"rule": "A rule", "records": []}', 'Bella’s Na:K ratio has fallen across the last 3 results.');
select pg_temp.expect_error(format($$insert into public.observations_noticed (dog_id, rule_family, rule_key, fingerprint, computed_on, window_start, window_end, evidence_json, copy)
  values (%L, 'direction', 'na_k_ratio', 'direction:na_k_ratio:down:x', '2026-11-01', '2026-10-01', '2026-11-01', '{}', 'Again')$$, :'bella'),
  'the same finding is never saved twice');

-- The household reads it; a stranger sees nothing.
set role authenticated;
select pg_temp.act_as(:bob);
select pg_temp.expect((select copy from public.observations_noticed), 'Bella’s Na:K ratio has fallen across the last 3 results.', 'the household reads it');
select pg_temp.act_as(:carol);
select pg_temp.expect((select count(*)::text from public.observations_noticed), '0', 'a stranger sees nothing');
update public.observations_noticed set dismissed_at = now();
select pg_temp.expect_error($$select * from public.noticed_runs$$, 'nobody but the scheduler reads the daily claims');
select pg_temp.expect_error($$select * from public.claim_noticed('2026-10-27', 10)$$, 'nobody but the scheduler claims a dog');

-- Members mark it, with their own time and name, and change nothing else.
select pg_temp.act_as(:bob);
update public.observations_noticed set shown_at = '2000-01-01', dismissed_at = '2000-01-01';
select pg_temp.expect((select dismissed_by::text from public.observations_noticed), :bob, 'dismissing records who did it');
select pg_temp.expect((select (dismissed_at > '2026-01-01' and shown_at > '2026-01-01')::text from public.observations_noticed), 'true',
  'the marks carry the time they were made, not one sent in');
select pg_temp.act_as(:alice);
update public.observations_noticed set shown_at = now() + interval '1 day', dismissed_at = now() + interval '1 day';
select pg_temp.expect((select dismissed_by::text from public.observations_noticed), :bob, 'a mark already made is kept');
update public.observations_noticed set added_to_report_at = now();
select pg_temp.expect((select added_by::text from public.observations_noticed), :alice, 'adding it to the summary records who did it');
update public.observations_noticed set added_to_report_at = null, dismissed_at = null;
select pg_temp.expect((select (added_by is null and dismissed_by is null)::text from public.observations_noticed), 'true', 'both can be undone');
select pg_temp.expect_error($$update public.observations_noticed set copy = 'Something else'$$, 'nobody changes the words');
select pg_temp.expect_error(format($$insert into public.observations_noticed (dog_id, rule_family, rule_key, fingerprint, computed_on, window_start, window_end, evidence_json, copy)
  values (%L, 'direction', 'k', 'made-up', '2026-10-25', '2026-10-01', '2026-10-25', '{}', 'Made up')$$, :'bella'),
  'nobody but the scheduler saves one');

-- Any member switches it off, and the scheduler then leaves the dog alone.
select pg_temp.act_as(:bob);
update public.dogs set noticed_off = true where id = :'bella';
select pg_temp.expect((select noticed_off::text from public.dogs where id = :'bella'), 'true', 'any member switches Noticed off');
reset role;
set role service_role;
select pg_temp.expect((select string_agg(dog_id::text, ',') from public.claim_noticed('2026-10-27', 10)), :'rex', 'a dog with Noticed off is never claimed');
reset role;
