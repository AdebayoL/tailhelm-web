-- Household members see each other's names, so a tick can read "Given 08:04
-- by Sam". Profiles stay private: this returns only a display name, and only
-- for people in a household the caller belongs to.

create function public.household_names(dog uuid)
returns table (profile_id uuid, name text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1))
  from public.household_members m
  join public.profiles p on p.id = m.profile_id
  where m.dog_id = dog
    and public.is_household_member(dog);
$$;

revoke all on function public.household_names(uuid) from public, anon;
grant execute on function public.household_names(uuid) to authenticated;
