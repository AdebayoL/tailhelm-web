-- Core condition-agnostic tables, scoped to the dog's household.
--
-- The household, not the person, owns the dog. Every row a person can read or
-- write is reached through an active household_members row for that dog, so a
-- stranger or a removed member sees nothing. Adding a condition adds rows, not
-- tables.
--
-- Doses live only in plan_items and treatments, exactly as the owner typed them
-- from their vet's instructions. Nothing here calculates one.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  timezone text not null default 'Europe/London',
  quiet_hours jsonb,
  country text not null default 'GB' check (country = 'GB'),
  currency text not null default 'GBP' check (currency = 'GBP'),
  stripe_customer_id text unique,
  plan_status text not null default 'free' check (plan_status in ('free', 'plus', 'lapsed')),
  plan_ends_at timestamptz,
  renews boolean not null default false,
  created_at timestamptz not null default now()
);

-- One profile per person, created when they first sign in.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Dogs and households
-- ---------------------------------------------------------------------------

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  photo_url text,
  breed text,
  sex text check (sex in ('female', 'male')),
  date_of_birth date,
  vet_name text,
  vet_phone text,
  vet_email text,
  out_of_hours_phone text,
  insurance_ref text,
  status text not null default 'active' check (status in ('active', 'passed_away', 'archived')),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_email text,
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  invited_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (dog_id, profile_id),
  check (profile_id is not null or invited_email is not null),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index household_members_profile_idx on public.household_members (profile_id) where status = 'active';

-- Up to 3 people per dog, counting open invitations.
create function public.enforce_household_size() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'revoked' and (
    select count(*) from public.household_members
    where dog_id = new.dog_id and status <> 'revoked' and id <> new.id
  ) >= 3 then
    raise exception 'A household has at most 3 people' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger household_size
  before insert or update of status on public.household_members
  for each row execute function public.enforce_household_size();

-- Access checks. Security definer so policies on household_members can use
-- them without recursing into their own policies.
create function public.is_household_member(dog uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where dog_id = dog and profile_id = (select auth.uid()) and status = 'active'
  );
$$;

create function public.is_household_owner(dog uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where dog_id = dog and profile_id = (select auth.uid()) and status = 'active' and role = 'owner'
  );
$$;

-- A dog is created together with its owner's membership, so it is never orphaned.
create function public.create_dog(dog_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  new_id uuid;
begin
  if me is null then
    raise exception 'Sign in to add a dog' using errcode = 'insufficient_privilege';
  end if;
  insert into public.dogs (name) values (dog_name) returning id into new_id;
  insert into public.household_members (dog_id, profile_id, role, status)
    values (new_id, me, 'owner', 'active');
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conditions and packs (the published layer, read-only to people)
-- ---------------------------------------------------------------------------

create table public.conditions (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  status text not null default 'planned' check (status in ('planned', 'draft', 'live'))
);

create table public.condition_packs (
  condition_key text not null references public.conditions (key),
  version text not null check (version ~ '^\d+\.\d+\.\d+$'),
  pack_json jsonb not null,
  reviewed_by text,
  reviewed_on date,
  sources jsonb not null default '[]',
  published_at timestamptz,
  primary key (condition_key, version)
);

create table public.dog_conditions (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  condition_key text not null references public.conditions (key),
  pack_version text not null,
  variant text,
  diagnosed_on date,
  foreign key (condition_key, pack_version) references public.condition_packs (condition_key, version),
  unique (dog_id, condition_key)
);

create function public.can_access_dog_condition(dc uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_household_member((select dog_id from public.dog_conditions where id = dc));
$$;

-- ---------------------------------------------------------------------------
-- The prescribed layer
-- ---------------------------------------------------------------------------

-- Exactly as the vet prescribed. A dose changes only by adding a new row that
-- supersedes the old one, with its own "set by vet on" date, so history is
-- never overwritten.
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  dog_condition_id uuid not null references public.dog_conditions (id) on delete cascade,
  pack_key text not null,
  kind text not null check (kind in ('medicine', 'observation', 'task')),
  product text,
  strength text,
  dose_amount numeric check (dose_amount > 0),
  dose_unit text,
  schedule_kind text not null check (schedule_kind in ('fixed', 'interval', 'offset', 'series', 'event')),
  schedule_json jsonb not null,
  usual_times text[],
  set_by_vet_on date,
  vet_instructions text,
  active boolean not null default true,
  supersedes_id uuid references public.plan_items (id),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (schedule_json ->> 'kind' = schedule_kind),
  check ((dose_amount is null) = (dose_unit is null)),
  check (dose_amount is null or set_by_vet_on is not null)
);

create index plan_items_condition_idx on public.plan_items (dog_condition_id) where active;

-- Only "active" may change after a plan item is written.
create function public.plan_item_is_history() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') then
    raise exception 'A plan item is never edited; add a new one that supersedes it'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger plan_item_history
  before update on public.plan_items
  for each row execute function public.plan_item_is_history();

create table public.vials (
  id uuid primary key default gen_random_uuid(),
  plan_item_id uuid not null references public.plan_items (id) on delete cascade,
  batch text,
  expires_on date,
  opened_on date,
  discard_by date
);

-- One row per dose given. The tick is a lock across the household: one tick
-- per scheduled slot per local day. A deliberate extra dose needs explicit
-- confirmation ("Only if your vet told you to") and gets its own number.
create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  plan_item_id uuid not null references public.plan_items (id) on delete cascade,
  given_at timestamptz not null default now(),
  given_on date not null,
  slot text not null,
  extra_no smallint not null default 0 check (extra_no >= 0),
  extra_confirmed boolean not null default false,
  amount numeric check (amount > 0),
  unit text,
  given_by_profile uuid references public.profiles (id) default auth.uid(),
  given_by text,
  site text,
  vial_id uuid references public.vials (id),
  note text,
  source text not null default 'app' check (source in ('app', 'import')),
  unique (plan_item_id, given_on, slot, extra_no),
  check (extra_no = 0 or extra_confirmed),
  check ((amount is null) = (unit is null))
);

create table public.anchors (
  id uuid primary key default gen_random_uuid(),
  dog_condition_id uuid not null references public.dog_conditions (id) on delete cascade,
  treatment_id uuid not null unique references public.treatments (id) on delete cascade,
  anchored_on date not null,
  cycle_no integer not null check (cycle_no > 0),
  unique (dog_condition_id, cycle_no)
);

-- ---------------------------------------------------------------------------
-- What the owner records
-- ---------------------------------------------------------------------------

create table public.observation_series (
  id uuid primary key default gen_random_uuid(),
  dog_condition_id uuid not null references public.dog_conditions (id) on delete cascade,
  type_key text not null,
  started_at timestamptz not null,
  note text
);

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  dog_condition_id uuid not null references public.dog_conditions (id) on delete cascade,
  type_key text not null,
  taken_at timestamptz not null,
  values_json jsonb not null,
  ranges_json jsonb,
  derived_json jsonb,
  cycle_no integer,
  days_since_anchor integer,
  series_id uuid references public.observation_series (id) on delete set null,
  photo_url text,
  note text,
  recorded_by uuid references public.profiles (id) default auth.uid()
);

create index observations_condition_idx on public.observations (dog_condition_id, taken_at);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  kind text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_s integer check (duration_s >= 0),
  severity text,
  note text,
  capture_mode text check (capture_mode in ('logged', 'happening_now')),
  thresholds_passed_json jsonb,
  detail_complete boolean not null default false,
  recorded_by uuid references public.profiles (id) default auth.uid(),
  check (ended_at is null or ended_at >= started_at)
);

create index events_dog_idx on public.events (dog_id, started_at);

create table public.consents (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (profile_id, kind, version)
);

-- ---------------------------------------------------------------------------
-- Access: row-level security on every table, and only the grants each needs
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.dogs enable row level security;
alter table public.household_members enable row level security;
alter table public.conditions enable row level security;
alter table public.condition_packs enable row level security;
alter table public.dog_conditions enable row level security;
alter table public.plan_items enable row level security;
alter table public.vials enable row level security;
alter table public.treatments enable row level security;
alter table public.anchors enable row level security;
alter table public.observation_series enable row level security;
alter table public.observations enable row level security;
alter table public.events enable row level security;
alter table public.consents enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_dog(text) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.can_access_dog_condition(uuid) to authenticated;

-- Profiles: each person reads and edits only their own, and never their plan or billing fields.
grant select on public.profiles to authenticated;
grant update (display_name, timezone, quiet_hours) on public.profiles to authenticated;
create policy "own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "edit own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Dogs: created through create_dog; read and edited by the household.
grant select, update on public.dogs to authenticated;
create policy "household reads dog" on public.dogs for select to authenticated
  using (public.is_household_member(id));
create policy "household edits dog" on public.dogs for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

-- Household: members see who else is in it, an invited person sees their
-- invitation, and only the owner invites or removes. A removed member sees nothing.
grant select, insert, update on public.household_members to authenticated;
create policy "household sees members" on public.household_members for select to authenticated
  using (public.is_household_member(dog_id) or (profile_id = (select auth.uid()) and status = 'invited'));
create policy "owner invites" on public.household_members for insert to authenticated
  with check (public.is_household_owner(dog_id) and role = 'member' and status = 'invited');
create policy "owner removes" on public.household_members for update to authenticated
  using (public.is_household_owner(dog_id) and role = 'member')
  with check (public.is_household_owner(dog_id) and role = 'member');

-- The published layer is the same for everyone and changes only by release.
grant select on public.conditions, public.condition_packs to authenticated;
create policy "anyone signed in reads conditions" on public.conditions for select to authenticated using (true);
create policy "anyone signed in reads packs" on public.condition_packs for select to authenticated using (true);

-- Everything about a dog is the household's.
grant select, insert, update on public.dog_conditions to authenticated;
create policy "household reads" on public.dog_conditions for select to authenticated
  using (public.is_household_member(dog_id));
create policy "household adds" on public.dog_conditions for insert to authenticated
  with check (public.is_household_member(dog_id));
create policy "household edits" on public.dog_conditions for update to authenticated
  using (public.is_household_member(dog_id)) with check (public.is_household_member(dog_id));

grant select, insert, update (active) on public.plan_items to authenticated;
create policy "household reads" on public.plan_items for select to authenticated
  using (public.can_access_dog_condition(dog_condition_id));
create policy "household adds" on public.plan_items for insert to authenticated
  with check (public.can_access_dog_condition(dog_condition_id));
create policy "household retires" on public.plan_items for update to authenticated
  using (public.can_access_dog_condition(dog_condition_id))
  with check (public.can_access_dog_condition(dog_condition_id));

create function public.can_access_plan_item(item uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_access_dog_condition((select dog_condition_id from public.plan_items where id = item));
$$;
revoke all on function public.can_access_plan_item(uuid) from public, anon;
grant execute on function public.can_access_plan_item(uuid) to authenticated;

grant select, insert, update on public.vials to authenticated;
create policy "household reads" on public.vials for select to authenticated
  using (public.can_access_plan_item(plan_item_id));
create policy "household adds" on public.vials for insert to authenticated
  with check (public.can_access_plan_item(plan_item_id));
create policy "household edits" on public.vials for update to authenticated
  using (public.can_access_plan_item(plan_item_id)) with check (public.can_access_plan_item(plan_item_id));

-- A tick is recorded as the person who made it, and only they can undo it.
grant select, insert, delete on public.treatments to authenticated;
create policy "household reads" on public.treatments for select to authenticated
  using (public.can_access_plan_item(plan_item_id));
create policy "household ticks" on public.treatments for insert to authenticated
  with check (public.can_access_plan_item(plan_item_id) and given_by_profile = (select auth.uid()));
create policy "undo own tick" on public.treatments for delete to authenticated
  using (public.can_access_plan_item(plan_item_id) and given_by_profile = (select auth.uid()));

grant select, insert, delete on public.anchors to authenticated;
create policy "household reads" on public.anchors for select to authenticated
  using (public.can_access_dog_condition(dog_condition_id));
create policy "household adds" on public.anchors for insert to authenticated
  with check (public.can_access_dog_condition(dog_condition_id));
create policy "household removes" on public.anchors for delete to authenticated
  using (public.can_access_dog_condition(dog_condition_id));

grant select, insert, update, delete on public.observation_series, public.observations to authenticated;
create policy "household reads" on public.observation_series for select to authenticated
  using (public.can_access_dog_condition(dog_condition_id));
create policy "household adds" on public.observation_series for insert to authenticated
  with check (public.can_access_dog_condition(dog_condition_id));
create policy "household edits" on public.observation_series for update to authenticated
  using (public.can_access_dog_condition(dog_condition_id)) with check (public.can_access_dog_condition(dog_condition_id));
create policy "household removes" on public.observation_series for delete to authenticated
  using (public.can_access_dog_condition(dog_condition_id));

create policy "household reads" on public.observations for select to authenticated
  using (public.can_access_dog_condition(dog_condition_id));
create policy "household adds" on public.observations for insert to authenticated
  with check (public.can_access_dog_condition(dog_condition_id));
create policy "household edits" on public.observations for update to authenticated
  using (public.can_access_dog_condition(dog_condition_id)) with check (public.can_access_dog_condition(dog_condition_id));
create policy "household removes" on public.observations for delete to authenticated
  using (public.can_access_dog_condition(dog_condition_id));

grant select, insert, update, delete on public.events to authenticated;
create policy "household reads" on public.events for select to authenticated
  using (public.is_household_member(dog_id));
create policy "household adds" on public.events for insert to authenticated
  with check (public.is_household_member(dog_id));
create policy "household edits" on public.events for update to authenticated
  using (public.is_household_member(dog_id)) with check (public.is_household_member(dog_id));
create policy "household removes" on public.events for delete to authenticated
  using (public.is_household_member(dog_id));

-- Consents are a record: added, never changed.
grant select, insert on public.consents to authenticated;
create policy "own consents" on public.consents for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "record own consent" on public.consents for insert to authenticated
  with check (profile_id = (select auth.uid()));
