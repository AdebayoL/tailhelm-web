-- People who signed in before the profiles table existed have no profile,
-- because the trigger only fires for new sign-ups. Create theirs. Safe to run
-- more than once.
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;
