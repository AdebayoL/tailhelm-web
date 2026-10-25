-- Noticed: what Tailhelm finds in a dog's own records without being asked.
--
-- Once a day the reminder scheduler, on the server as service_role, tests
-- each dog's records against six fixed rule families and saves at most one
-- observation a week, with the exact records behind it, so "Why am I seeing
-- this?" can always be answered. Only the scheduler writes one. The household
-- reads them, and can mark one seen, dismiss it or add it to the 90-day
-- summary; any member can switch Noticed off for the dog. Alerts never pass
-- through here, so they work the same whether Noticed is on or off.

alter table public.dogs add column noticed_off boolean not null default false;

create table public.observations_noticed (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  rule_family text not null check (rule_family in
    ('cycle_position', 'interval_change', 'co_occurrence', 'direction', 'absence', 'plain_record')),
  rule_key text not null,
  -- The finding itself, so the same one is never saved twice.
  fingerprint text not null,
  computed_on date not null,
  window_start date not null,
  window_end date not null,
  -- The rule in plain words and the records it used.
  evidence_json jsonb not null,
  copy text not null check (length(copy) > 0),
  shown_at timestamptz,
  opened_at timestamptz,
  dismissed_at timestamptz,
  dismissed_by uuid references public.profiles (id) on delete set null,
  added_to_report_at timestamptz,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dog_id, fingerprint),
  check (window_start <= window_end)
);

create index observations_noticed_latest on public.observations_noticed (dog_id, computed_on desc);

-- A member's marks carry the time they were made and who made them. Seen and
-- opened are kept from the first time; dismissed and added can be undone.
create function public.noticed_marks() returns trigger
language plpgsql set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return new;
  end if;
  new.shown_at := coalesce(old.shown_at, case when new.shown_at is not null then now() end);
  new.opened_at := coalesce(old.opened_at, case when new.opened_at is not null then now() end);
  if new.dismissed_at is null then
    new.dismissed_by := null;
  elsif old.dismissed_at is null then
    new.dismissed_at := now();
    new.dismissed_by := me;
  else
    new.dismissed_at := old.dismissed_at;
    new.dismissed_by := old.dismissed_by;
  end if;
  if new.added_to_report_at is null then
    new.added_by := null;
  elsif old.added_to_report_at is null then
    new.added_to_report_at := now();
    new.added_by := me;
  else
    new.added_to_report_at := old.added_to_report_at;
    new.added_by := old.added_by;
  end if;
  return new;
end;
$$;

create trigger noticed_marks before update on public.observations_noticed
  for each row execute function public.noticed_marks();

alter table public.observations_noticed enable row level security;
revoke all on public.observations_noticed from anon, authenticated;
grant select on public.observations_noticed to authenticated;
grant update (shown_at, opened_at, dismissed_at, added_to_report_at) on public.observations_noticed to authenticated;
create policy "household reads noticed" on public.observations_noticed for select to authenticated
  using (public.is_household_member(dog_id));
create policy "household marks noticed" on public.observations_noticed for update to authenticated
  using (public.is_household_member(dog_id)) with check (public.is_household_member(dog_id));

-- The day each dog was last looked at, so a dog is looked at once a day
-- however often the scheduler runs. The scheduler's alone.
create table public.noticed_runs (
  dog_id uuid primary key references public.dogs (id) on delete cascade,
  day date not null
);

alter table public.noticed_runs enable row level security;
revoke all on public.noticed_runs from anon, authenticated;

-- Claims up to how_many dogs not yet looked at today, longest waiting first:
-- active dogs with Noticed on. Two runs at once never claim the same dog.
create function public.claim_noticed(today date, how_many int) returns table (dog_id uuid)
language sql set search_path = '' as $$
  insert into public.noticed_runs as r (dog_id, day)
  select d.id, today
  from public.dogs d
  left join public.noticed_runs n on n.dog_id = d.id
  where d.status = 'active' and not d.noticed_off and (n.day is null or n.day < today)
  order by n.day nulls first, d.id
  limit how_many
  on conflict on constraint noticed_runs_pkey do update set day = excluded.day where r.day < excluded.day
  returning r.dog_id;
$$;

revoke all on function public.claim_noticed(date, int) from public, anon, authenticated;
revoke all on function public.noticed_marks() from public, anon, authenticated;
grant execute on function public.claim_noticed(date, int) to service_role;

-- What the scheduler reads to look at a dog's records, and what it writes.
grant select on public.observations, public.events to service_role;
grant select, insert, update on public.noticed_runs to service_role;
grant select, insert on public.observations_noticed to service_role;
