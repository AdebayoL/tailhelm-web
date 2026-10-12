-- Phone notifications: reminder layer 2.
--
-- Each phone that allows notifications stores one push subscription for the
-- person signed in on it. Every notification sent is logged once, per person,
-- per reminder, so the scheduler can run as often as it likes without
-- sending anything twice. Notifications carry medicine names and times,
-- never a dose.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, profile_id, user_agent, created_at, last_sent_at) on public.push_subscriptions to authenticated;
create policy "own phones" on public.push_subscriptions for select to authenticated
  using (profile_id = (select auth.uid()));

-- Saves this phone for the person signed in. A phone that was saved for
-- someone else, such as after signing out and in as another person, moves
-- to the new person, so one phone never gets two people's reminders.
create function public.save_push_subscription(endpoint text, p256dh text, auth text, user_agent text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in to turn on notifications' using errcode = 'insufficient_privilege';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
    values (me, save_push_subscription.endpoint, save_push_subscription.p256dh, save_push_subscription.auth, save_push_subscription.user_agent)
  on conflict on constraint push_subscriptions_endpoint_key do update
    set profile_id = me, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

-- Forgets this phone for the person signed in, such as when they sign out.
create function public.forget_push_subscription(endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions s
   where s.endpoint = forget_push_subscription.endpoint and s.profile_id = (select auth.uid());
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.forget_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.forget_push_subscription(text) to authenticated;

-- The delivery log. "ref" names the reminder, such as a plan item, a date and
-- a time, so the unique key is what stops a second send.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dog_id uuid references public.dogs (id) on delete cascade,
  kind text not null check (kind in ('test', 'dose_due', 'dose_not_ticked', 'dose_ticked', 'injection_soon', 'injection_overdue', 'test_due')),
  ref text not null,
  channel text not null default 'push' check (channel in ('push')),
  title text not null,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'sending' check (status in ('sending', 'sent', 'no_device', 'failed')),
  detail text,
  unique (profile_id, kind, ref, channel)
);

create index notifications_profile_idx on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy "own notifications" on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));

-- The scheduler runs on the server with the secret key, as service_role, to
-- work out every household's reminders. It reads the plan and writes only
-- the delivery log and the phones it can no longer reach. Granted here
-- because this project does not grant new tables to the API roles itself.
grant select on public.profiles, public.dogs, public.household_members, public.dog_conditions,
  public.plan_items, public.treatments, public.anchors to service_role;
grant select, update, delete on public.push_subscriptions to service_role;
grant select, insert, update on public.notifications to service_role;
