-- The private calendar feed: reminder layer 1. Each dog has at most one live
-- feed. The link carries a random token; only its SHA-256 hash is stored, so
-- the link cannot be read back from the database, only replaced.

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  revoked_at timestamptz
);

create unique index calendar_feeds_one_live on public.calendar_feeds (dog_id) where revoked_at is null;

alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon, authenticated;
grant select (id, dog_id, created_by, created_at, last_fetched_at, revoked_at) on public.calendar_feeds to authenticated;
create policy "household sees feeds" on public.calendar_feeds for select to authenticated
  using (public.is_household_member(dog_id));

-- Replaces the dog's feed with a new one. The old link stops at once.
create function public.new_calendar_feed(dog uuid, hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_household_member(dog) then
    raise exception 'Only the household can make a calendar link' using errcode = 'insufficient_privilege';
  end if;
  update public.calendar_feeds set revoked_at = now() where dog_id = dog and revoked_at is null;
  insert into public.calendar_feeds (dog_id, token_hash, created_by) values (dog, hash, (select auth.uid()));
end;
$$;

create function public.revoke_calendar_feed(dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_household_member(dog) then
    raise exception 'Only the household can stop a calendar link' using errcode = 'insufficient_privilege';
  end if;
  update public.calendar_feeds set revoked_at = now() where dog_id = dog and revoked_at is null;
end;
$$;

-- What a calendar app fetches, with no sign-in: the dog's name, the owner's
-- time zone, the plan's schedules and the latest injection. Never a dose.
-- A stopped link, or a dog no longer active, returns an empty plan so the
-- calendar clears its alarms. An unknown token returns null.
create function public.calendar_feed(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  feed public.calendar_feeds;
  d public.dogs;
begin
  if token is null or length(token) < 32 then
    return null;
  end if;
  select * into feed from public.calendar_feeds
   where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  if not found then
    return null;
  end if;
  select * into d from public.dogs where id = feed.dog_id;
  if feed.revoked_at is not null or d.status <> 'active' then
    return jsonb_build_object('dog_name', d.name, 'live', false);
  end if;
  update public.calendar_feeds set last_fetched_at = now() where id = feed.id;
  return jsonb_build_object(
    'dog_name', d.name,
    'live', true,
    'time_zone', coalesce((
      select p.timezone from public.household_members m join public.profiles p on p.id = m.profile_id
       where m.dog_id = d.id and m.role = 'owner' and m.status = 'active' limit 1), 'Europe/London'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'product', i.product, 'schedule', i.schedule_json) order by i.created_at)
        from public.plan_items i join public.dog_conditions c on c.id = i.dog_condition_id
       where c.dog_id = d.id and i.active), '[]'::jsonb),
    'anchor', (
      select jsonb_build_object('anchored_on', a.anchored_on, 'cycle_no', a.cycle_no)
        from public.anchors a join public.dog_conditions c on c.id = a.dog_condition_id
       where c.dog_id = d.id
       order by a.anchored_on desc, a.cycle_no desc limit 1)
  );
end;
$$;

revoke all on function public.new_calendar_feed(uuid, text) from public, anon;
revoke all on function public.revoke_calendar_feed(uuid) from public, anon;
revoke all on function public.calendar_feed(text) from public;
grant execute on function public.new_calendar_feed(uuid, text) to authenticated;
grant execute on function public.revoke_calendar_feed(uuid) to authenticated;
grant execute on function public.calendar_feed(text) to anon, authenticated;
