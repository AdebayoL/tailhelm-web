-- The day-31 moment, and who pays for Plus.
--
-- On the day the household's first record leaves a free account's 30 days,
-- Today shows each person the month they kept, once. day31_seen_at is when
-- this person closed it ("Not now", "Close" or "Choose Plus"); after that it
-- never appears for them again. Each person marks only their own row, through
-- mark_day31_seen, since members cannot change household rows themselves.
--
-- dog_plus_payer names the member whose Plus the household is on, so the Dog
-- tab can say "Plus, paid by Adebayo" to everyone else. It says nothing about
-- billing; each person reads only their own profile for that.

alter table public.household_members add column day31_seen_at timestamptz;

create function public.mark_day31_seen(dog uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.household_members
     set day31_seen_at = coalesce(day31_seen_at, now())
   where dog_id = dog
     and profile_id = auth.uid()
     and status = 'active';
$$;

create function public.dog_plus_payer(dog uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.profile_id
    from public.household_members m
    join public.profiles p on p.id = m.profile_id
   where public.is_household_member(dog)
     and m.dog_id = dog
     and m.status = 'active'
     and p.plan_status = 'plus'
     and (p.plan_ends_at is null or p.plan_ends_at > now())
   order by (m.role = 'owner') desc, m.invited_at
   limit 1;
$$;

revoke all on function public.mark_day31_seen(uuid) from public, anon;
grant execute on function public.mark_day31_seen(uuid) to authenticated;
revoke all on function public.dog_plus_payer(uuid) from public, anon;
grant execute on function public.dog_plus_payer(uuid) to authenticated;
