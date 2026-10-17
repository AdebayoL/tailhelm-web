-- Tailhelm Plus, for the history line.
--
-- Plus belongs to the person who pays for it: plan_status and plan_ends_at on
-- their profile, which nobody can change for themselves (only the service
-- role can, which is where payments will set it). Until payments exist,
-- everyone is on free.
--
-- A dog has Plus when anyone active in its household has it, so the whole
-- household sees the dog's full history. Each person reads only their own
-- profile, so this answers for the household without showing anyone's plan.
-- Free or Plus, nothing is ever deleted: the line decides only how far back
-- the screens reach.

create function public.dog_has_plus(dog uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_household_member(dog) and exists (
    select 1
    from public.household_members m
    join public.profiles p on p.id = m.profile_id
    where m.dog_id = dog
      and m.status = 'active'
      and p.plan_status = 'plus'
      and (p.plan_ends_at is null or p.plan_ends_at > now())
  );
$$;

revoke all on function public.dog_has_plus(uuid) from public, anon;
grant execute on function public.dog_has_plus(uuid) to authenticated;
