-- Logging a cycle treatment (a DOCP injection) and starting its cycle happen
-- together or not at all. The treatment is the record; the anchor is what the
-- countdown and the blood-test offsets count from.
--
-- Runs as the caller, so row-level security still decides who may log.

create function public.log_cycle_treatment(
  item uuid,
  on_date date,
  at timestamptz,
  amount numeric,
  unit text,
  given_by text default null,
  site text default null,
  note text default null,
  vial uuid default null,
  new_vial jsonb default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  condition uuid;
  kind text;
  latest date;
  next_cycle integer;
  treatment uuid;
begin
  select p.dog_condition_id, p.schedule_kind into condition, kind
  from public.plan_items p
  where p.id = item and p.active;
  if condition is null then
    raise exception 'No such medicine on the plan' using errcode = 'P0002';
  end if;
  if kind <> 'interval' then
    raise exception 'Only an injection on a cycle is logged this way' using errcode = '22023';
  end if;

  select max(a.anchored_on), coalesce(max(a.cycle_no), 0) + 1 into latest, next_cycle
  from public.anchors a
  where a.dog_condition_id = condition;
  if latest is not null and on_date <= latest then
    raise exception 'An injection is already logged on or after %', latest using errcode = '23514';
  end if;

  if new_vial is not null then
    insert into public.vials (plan_item_id, batch, expires_on, opened_on)
    values (item, nullif(new_vial ->> 'batch', ''), (new_vial ->> 'expires_on')::date, (new_vial ->> 'opened_on')::date)
    returning id into vial;
  end if;

  insert into public.treatments (plan_item_id, given_at, given_on, slot, amount, unit, given_by, site, vial_id, note)
  values (item, at, on_date, 'injection', amount, unit, given_by, site, vial, note)
  returning id into treatment;

  insert into public.anchors (dog_condition_id, treatment_id, anchored_on, cycle_no)
  values (condition, treatment, on_date, next_cycle);

  return treatment;
end;
$$;

revoke all on function public.log_cycle_treatment(uuid, date, timestamptz, numeric, text, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.log_cycle_treatment(uuid, date, timestamptz, numeric, text, text, text, text, uuid, jsonb) to authenticated;
