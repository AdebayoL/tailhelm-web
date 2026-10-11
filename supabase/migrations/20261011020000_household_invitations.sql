-- Invitations to a dog's household. The owner invites by email; the person
-- signs in with that email (the 6-digit code proves they hold it), sees the
-- invitation and accepts or declines it. A member may leave; the owner may
-- remove a member or cancel an invitation (the "owner removes" policy).

-- One open invitation per address per dog.
create unique index household_open_invite_idx
  on public.household_members (dog_id, lower(invited_email))
  where status = 'invited';

-- The signed-in person's open invitations, with the dog's name and the owner's name.
create function public.my_invitations()
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
    and (select auth.uid()) is not null
    and (m.profile_id = (select auth.uid())
         or lower(m.invited_email) = lower((select u.email from auth.users u where u.id = (select auth.uid()))))
  order by m.invited_at;
$$;

-- Accepts an invitation addressed to the signed-in person and returns the dog.
-- Someone removed earlier and invited back gets their old membership back.
create function public.accept_invitation(invitation uuid) returns uuid
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

create function public.decline_invitation(invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  update public.household_members m set status = 'revoked', revoked_at = now()
   where m.id = invitation and m.status = 'invited'
     and (m.profile_id = me
          or lower(m.invited_email) = lower((select u.email from auth.users u where u.id = me)));
end;
$$;

-- A member leaves a household. The owner cannot, so a dog is never left without one.
create function public.leave_household(dog uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.household_members set status = 'revoked', revoked_at = now()
   where dog_id = dog and profile_id = (select auth.uid()) and role = 'member' and status = 'active';
end;
$$;

revoke all on function public.my_invitations() from public, anon;
revoke all on function public.accept_invitation(uuid) from public, anon;
revoke all on function public.decline_invitation(uuid) from public, anon;
revoke all on function public.leave_household(uuid) from public, anon;
grant execute on function public.my_invitations() to authenticated;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;
