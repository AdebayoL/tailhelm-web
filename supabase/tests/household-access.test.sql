-- Household access: a member sees the dog's records; a stranger, a removed
-- member and a signed-out visitor see nothing. Plus the integrity rules the
-- database enforces: household size, the tick lock, and plan history.

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

-- --- Set-up, as the database owner -----------------------------------------

insert into auth.users (id, email) values
  (:alice, 'alice@example.com'),
  (:bob, 'bob@example.com'),
  (:carol, 'carol@example.com'),
  (:dave, 'dave@example.com');

select pg_temp.expect((select count(*) from public.profiles), 4, 'signing up creates a profile');

select pg_temp.expect((select count(*) from public.condition_packs where condition_key = 'addisons'), 1,
  'the Addison''s pack is seeded by its migration');

-- Alice adds Bella and invites Bob and Dave.
set role authenticated;
select pg_temp.act_as(:alice);
select public.create_dog('Bella') as bella \gset
insert into public.household_members (dog_id, profile_id, invited_email)
  values (:'bella', :bob, 'bob@example.com'), (:'bella', :dave, 'dave@example.com');
reset role;

-- Accepting an invitation comes later; mark both accepted here.
update public.household_members set status = 'active' where role = 'member';

-- Alice removes Dave.
set role authenticated;
select pg_temp.act_as(:alice);
with removed as (update public.household_members set status = 'revoked', revoked_at = now() where profile_id = :dave returning 1)
select pg_temp.expect(count(*), 1, 'the owner can remove a member') from removed;

-- Bob records a plan, a treatment, a result and an event.
select pg_temp.act_as(:bob);
insert into public.dog_conditions (dog_id, condition_key, pack_version, variant)
  values (:'bella', 'addisons', '0.1.0', 'typical') returning id as bella_addisons \gset
insert into public.plan_items (dog_condition_id, pack_key, kind, product, dose_amount, dose_unit,
                               schedule_kind, schedule_json, set_by_vet_on)
  values (:'bella_addisons', 'glucocorticoid', 'medicine', 'Prednisolone', 2.5, 'mg',
          'fixed', '{"kind":"fixed","times":["08:00"]}', '2026-09-12')
  returning id as pred \gset
insert into public.treatments (plan_item_id, given_on, slot, amount, unit)
  values (:'pred', '2026-10-09', '08:00', 2.5, 'mg');
insert into public.observations (dog_condition_id, type_key, taken_at, values_json)
  values (:'bella_addisons', 'electrolytes', now(), '{"sodium":145,"potassium":5.0}');
insert into public.events (dog_id, kind, started_at) values (:'bella', 'stressful_event', now());

-- --- A member sees the household's records ---------------------------------

select pg_temp.expect((select count(*) from public.dogs), 1, 'a member sees the dog');
select pg_temp.expect((select count(*) from public.household_members), 3, 'a member sees the household, including who was removed');
select pg_temp.expect((select count(*) from public.plan_items), 1, 'a member sees the plan');
select pg_temp.expect((select count(*) from public.treatments), 1, 'a member sees treatments');
select pg_temp.expect((select count(*) from public.observations), 1, 'a member sees results');
select pg_temp.expect((select count(*) from public.events), 1, 'a member sees events');
select pg_temp.expect((select count(*) from public.profiles), 1, 'a person sees only their own profile');

-- --- A stranger sees nothing and can change nothing ------------------------

select pg_temp.act_as(:carol);
select pg_temp.expect((select count(*) from public.dogs), 0, 'a stranger sees no dog');
select pg_temp.expect((select count(*) from public.household_members), 0, 'a stranger sees no household');
select pg_temp.expect((select count(*) from public.dog_conditions), 0, 'a stranger sees no condition');
select pg_temp.expect((select count(*) from public.plan_items), 0, 'a stranger sees no plan');
select pg_temp.expect((select count(*) from public.treatments), 0, 'a stranger sees no treatment');
select pg_temp.expect((select count(*) from public.observations), 0, 'a stranger sees no result');
select pg_temp.expect((select count(*) from public.events), 0, 'a stranger sees no event');
with changed as (update public.dogs set name = 'Taken' returning 1)
select pg_temp.expect(count(*), 0, 'a stranger cannot rename the dog') from changed;
select pg_temp.expect_error(
  format($$insert into public.events (dog_id, kind, started_at) values (%L, 'x', now())$$, :'bella'),
  'a stranger cannot add an event');
select pg_temp.expect_error(
  format($$insert into public.household_members (dog_id, profile_id) values (%L, %L)$$, :'bella', :carol),
  'a stranger cannot add themselves to the household');

-- --- A removed member sees nothing -----------------------------------------

select pg_temp.act_as(:dave);
select pg_temp.expect((select count(*) from public.dogs), 0, 'a removed member sees no dog');
select pg_temp.expect((select count(*) from public.household_members), 0, 'a removed member sees no household');
select pg_temp.expect((select count(*) from public.plan_items), 0, 'a removed member sees no plan');
select pg_temp.expect((select count(*) from public.treatments), 0, 'a removed member sees no treatment');
select pg_temp.expect((select count(*) from public.observations), 0, 'a removed member sees no result');
select pg_temp.expect((select count(*) from public.events), 0, 'a removed member sees no event');
select pg_temp.expect_error(
  format($$insert into public.observations (dog_condition_id, type_key, taken_at, values_json)
           values (%L, 'electrolytes', now(), '{}')$$, :'bella_addisons'),
  'a removed member cannot add a result');

-- --- A member who is not the owner cannot manage the household -------------

select pg_temp.act_as(:bob);
select pg_temp.expect_error(
  format($$insert into public.household_members (dog_id, invited_email) values (%L, 'eve@example.com')$$, :'bella'),
  'a member cannot invite');
with changed as (update public.household_members set role = 'owner' where profile_id = :bob returning 1)
select pg_temp.expect(count(*), 0, 'a member cannot make themselves owner') from changed;

-- --- Signed out --------------------------------------------------------------

reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect_error('select * from public.dogs', 'a signed-out visitor cannot read dogs');
select pg_temp.expect_error('select * from public.observations', 'a signed-out visitor cannot read results');
select pg_temp.expect_error($$select public.create_dog('Ghost')$$, 'a signed-out visitor cannot add a dog');

-- --- Household size ----------------------------------------------------------

reset role;
set role authenticated;
select pg_temp.act_as(:alice);
insert into public.household_members (dog_id, invited_email) values (:'bella', 'frank@example.com');
select pg_temp.expect_error(
  format($$insert into public.household_members (dog_id, invited_email) values (%L, 'grace@example.com')$$, :'bella'),
  'a household holds at most 3 people');

-- --- The tick lock -----------------------------------------------------------

select pg_temp.expect_error(
  format($$insert into public.treatments (plan_item_id, given_on, slot) values (%L, '2026-10-09', '08:00')$$, :'pred'),
  'a second tick for the same dose is refused');
select pg_temp.expect_error(
  format($$insert into public.treatments (plan_item_id, given_on, slot, extra_no) values (%L, '2026-10-09', '08:00', 1)$$, :'pred'),
  'an extra dose needs confirming');
insert into public.treatments (plan_item_id, given_on, slot, extra_no, extra_confirmed)
  values (:'pred', '2026-10-09', '08:00', 1, true);
select pg_temp.expect((select count(*) from public.treatments), 2, 'a confirmed extra dose is recorded');
with removed as (delete from public.treatments where extra_no = 0 returning 1)
select pg_temp.expect(count(*), 0, 'only the person who ticked can undo it') from removed;

-- --- Plan history ------------------------------------------------------------

select pg_temp.expect_error(
  format($$update public.plan_items set dose_amount = 5 where id = %L$$, :'pred'),
  'a dose is never edited in place');
with retired as (update public.plan_items set active = false where id = :'pred' returning 1)
select pg_temp.expect(count(*), 1, 'a plan item can be retired when a new one supersedes it') from retired;
select pg_temp.expect_error(
  format($$insert into public.plan_items (dog_condition_id, pack_key, kind, schedule_kind, schedule_json)
           values (%L, 'docp', 'medicine', 'interval', '{"kind":"fixed","times":["08:00"]}')$$, :'bella_addisons'),
  'a schedule must match its kind');
select pg_temp.expect_error(
  format($$insert into public.plan_items (dog_condition_id, pack_key, kind, schedule_kind, schedule_json)
           values (%L, 'docp', 'medicine', 'hourly', '{"kind":"hourly"}')$$, :'bella_addisons'),
  'a schedule kind the engine lacks is refused');
select pg_temp.expect_error(
  format($$insert into public.plan_items (dog_condition_id, pack_key, kind, dose_amount, dose_unit, schedule_kind, schedule_json)
           values (%L, 'glucocorticoid', 'medicine', 2.5, 'mg', 'fixed', '{"kind":"fixed","times":["08:00"]}')$$, :'bella_addisons'),
  'a dose needs the date the vet set it');

-- --- Profiles ----------------------------------------------------------------

select pg_temp.act_as(:bob);
select pg_temp.expect_error(
  format($$update public.profiles set plan_status = 'plus' where id = %L$$, :bob),
  'a person cannot change their own plan');
with changed as (update public.profiles set display_name = 'Bob' returning 1)
select pg_temp.expect(count(*), 1, 'a person can change their own name') from changed;

reset role;
