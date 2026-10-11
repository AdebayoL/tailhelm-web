-- The care team screen shows when each person joined, when they last
-- recorded anything, and what became of past invitations. An invitation
-- stays open for 7 days. After that it cannot be accepted and no longer
-- holds a place; the owner can send it again.

alter table public.household_members
  add column joined_at timestamptz,
  add column declined_at timestamptz,
  add constraint household_members_declined_is_revoked check (declined_at is null or status = 'revoked');

-- An owner joined when they added the dog. Members who joined before this
-- change have no recorded date.
update public.household_members set joined_at = invited_at where role = 'owner';

create function public.invitation_is_open(invited timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select invited > now() - interval '7 days';
$$;

-- Stamps the moment someone joins: the owner adding the dog, or a person
-- accepting an invitation, including someone invited back.
create function public.stamp_household_join() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

create trigger household_join
  before insert or update of status on public.household_members
  for each row execute function public.stamp_household_join();

-- Up to 3 people per dog, counting invitations still open. Sending an
-- invitation again re-opens it, so the check runs then too.
create or replace function public.enforce_household_size() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.status = 'active' or (new.status = 'invited' and public.invitation_is_open(new.invited_at))) and (
    select count(*) from public.household_members
    where dog_id = new.dog_id and id <> new.id
      and (status = 'active' or (status = 'invited' and public.invitation_is_open(invited_at)))
  ) >= 3 then
    raise exception 'A household has at most 3 people' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger household_size on public.household_members;
create trigger household_size
  before insert or update of status, invited_at on public.household_members
  for each row execute function public.enforce_household_size();

create or replace function public.my_invitations()
returns table (id uuid, dog_id uuid, dog_name text, invited_by text, invited_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, d.id, d.name,
    (select coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
       from public.household_members o
       join public.profiles p on p.id = o.profile_id
      where o.dog_id = d.id and o.role = 'owner' and o.status = 'active'
      limit 1),
    m.invited_at
  from public.household_members m
  join public.dogs d on d.id = m.dog_id
  where m.status = 'invited'
    and public.invitation_is_open(m.invited_at)
    and (select auth.uid()) is not null
    and (m.profile_id = (select auth.uid())
         or lower(m.invited_email) = lower((select u.email from auth.users u where u.id = (select auth.uid()))))
  order by m.invited_at;
$$;

create or replace function public.accept_invitation(invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  my_email text;
  inv public.household_members;
begin
  if me is null then
    raise exception 'Sign in to accept an invitation' using errcode = 'insufficient_privilege';
  end if;
  select u.email into my_email from auth.users u where u.id = me;
  select * into inv from public.household_members m
   where m.id = invitation and m.status = 'invited'
     and public.invitation_is_open(m.invited_at)
     and (m.profile_id = me or lower(m.invited_email) = lower(my_email))
   for update;
  if not found then
    raise exception 'This invitation is no longer open' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.household_members m where m.dog_id = inv.dog_id and m.profile_id = me and m.id <> inv.id) then
    -- The invitation goes first, so the household size check does not count it twice.
    delete from public.household_members where id = inv.id;
    update public.household_members set status = 'active', revoked_at = null
     where dog_id = inv.dog_id and profile_id = me and status = 'revoked';
  else
    update public.household_members set profile_id = me, status = 'active' where id = inv.id;
  end if;
  return inv.dog_id;
end;
$$;

create or replace function public.decline_invitation(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  update public.household_members m set status = 'revoked', revoked_at = now(), declined_at = now()
   where m.id = invitation and m.status = 'invited'
     and (m.profile_id = me
          or lower(m.invited_email) = lower((select u.email from auth.users u where u.id = me)));
end;
$$;

-- When each person last recorded a dose, a check, a note or an event.
-- Security invoker, so it sees only what the caller's household can see.
create function public.household_last_recorded(dog uuid)
returns table (profile_id uuid, recorded_at timestamptz)
language sql stable set search_path = '' as $$
  select r.who, max(r.recorded) from (
    select t.given_by_profile, t.given_at
      from public.treatments t
      join public.plan_items p on p.id = t.plan_item_id
      join public.dog_conditions c on c.id = p.dog_condition_id
     where c.dog_id = dog
    union all
    select o.recorded_by, coalesce(o.created_at, o.taken_at)
      from public.observations o
      join public.dog_conditions c on c.id = o.dog_condition_id
     where c.dog_id = dog
    union all
    select e.recorded_by, coalesce(e.created_at, e.started_at)
      from public.events e
     where e.dog_id = dog
  ) r (who, recorded)
  where r.who is not null
  group by r.who;
$$;

revoke all on function public.invitation_is_open(timestamptz) from public, anon, authenticated;
revoke all on function public.stamp_household_join() from public, anon, authenticated;
revoke all on function public.household_last_recorded(uuid) from public, anon;
grant execute on function public.household_last_recorded(uuid) to authenticated;
