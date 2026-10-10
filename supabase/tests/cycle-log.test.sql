-- Logging an injection records the treatment and starts its cycle together,
-- refuses a second injection on the same day or an earlier one, and is
-- limited to the dog's household.

\set alice '\'a1000000-0000-0000-0000-000000000001\''
\set carol '\'c1000000-0000-0000-0000-000000000003\''

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

insert into auth.users (id, email) values (:alice, 'alice2@example.com'), (:carol, 'carol2@example.com');

set role authenticated;
select pg_temp.act_as(:alice);
select public.create_dog('Rufus') as rufus \gset
insert into public.dog_conditions (dog_id, condition_key, pack_version, variant)
  values (:'rufus', 'addisons', '0.1.0', 'typical') returning id as cond \gset
insert into public.plan_items (dog_condition_id, pack_key, kind, product, dose_amount, dose_unit,
                               schedule_kind, schedule_json, set_by_vet_on)
  values (:'cond', 'docp', 'medicine', 'Zycortal', 0.9, 'mL', 'interval',
          '{"kind":"interval","everyDays":28,"time":"09:00"}', '2026-09-01')
  returning id as docp \gset
insert into public.plan_items (dog_condition_id, pack_key, kind, product, dose_amount, dose_unit,
                               schedule_kind, schedule_json, set_by_vet_on)
  values (:'cond', 'glucocorticoid', 'medicine', 'Prednisolone', 2.5, 'mg', 'fixed',
          '{"kind":"fixed","times":["08:00"]}', '2026-09-01')
  returning id as pred \gset

select public.log_cycle_treatment(:'docp', '2026-09-15', '2026-09-15 09:00+01', 0.9, 'mL',
  new_vial => '{"batch":"AB12","expires_on":"2027-06-30","opened_on":"2026-09-15"}') as first \gset

select pg_temp.expect((select count(*) from public.anchors where cycle_no = 1 and anchored_on = '2026-09-15'), 1,
  'logging an injection starts cycle 1 on its date');
select pg_temp.expect((select count(*) from public.vials where batch = 'AB12'), 1, 'a new vial is recorded with it');
select pg_temp.expect((select count(*) from public.treatments t join public.vials v on v.id = t.vial_id where t.id = :'first'), 1,
  'the injection is linked to its vial');

select public.log_cycle_treatment(:'docp', '2026-10-13', '2026-10-13 09:00+01', 0.9, 'mL',
  vial => (select id from public.vials where batch = 'AB12')) as second \gset
select pg_temp.expect((select max(cycle_no) from public.anchors), 2, 'the next injection starts cycle 2');

select pg_temp.expect_error(
  format($$select public.log_cycle_treatment(%L, '2026-10-13', now(), 0.9, 'mL')$$, :'docp'),
  'a second injection on the same day is refused');
select pg_temp.expect_error(
  format($$select public.log_cycle_treatment(%L, '2026-10-01', now(), 0.9, 'mL')$$, :'docp'),
  'an injection earlier than the last one is refused');
select pg_temp.expect_error(
  format($$select public.log_cycle_treatment(%L, '2026-10-20', now(), 2.5, 'mg')$$, :'pred'),
  'a daily tablet is not logged as a cycle');
select pg_temp.expect((select count(*) from public.treatments), 2, 'nothing extra was recorded by the refusals');

with undone as (delete from public.treatments where id = :'second' returning 1)
select pg_temp.expect(count(*), 1, 'the person who logged it can undo it') from undone;
select pg_temp.expect((select max(cycle_no) from public.anchors), 1, 'undoing it removes its cycle too');

select pg_temp.act_as(:carol);
select pg_temp.expect_error(
  format($$select public.log_cycle_treatment(%L, '2026-11-20', now(), 0.9, 'mL')$$, :'docp'),
  'a stranger cannot log an injection');

reset role;
select pg_temp.expect((select count(*) from public.anchors), 1, 'the stranger added no cycle');
