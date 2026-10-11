-- One calendar link per calendar app, so Reminders can show Apple Calendar
-- and Google Calendar separately and remove one without stopping the other.
-- Links made before this count as "other", such as one pasted into Outlook.

alter table public.calendar_feeds
  add column app text not null default 'other' check (app in ('apple', 'google', 'other'));

drop index public.calendar_feeds_one_live;
create unique index calendar_feeds_one_live on public.calendar_feeds (dog_id, app) where revoked_at is null;

grant select (app) on public.calendar_feeds to authenticated;

-- Replaces the dog's link for one calendar app. The old link stops at once.
drop function public.new_calendar_feed(uuid, text);
create function public.new_calendar_feed(dog uuid, hash text, app text default 'other') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_household_member(dog) then
    raise exception 'Only the household can make a calendar link' using errcode = 'insufficient_privilege';
  end if;
  update public.calendar_feeds f set revoked_at = now() where f.dog_id = dog and f.app = new_calendar_feed.app and f.revoked_at is null;
  insert into public.calendar_feeds (dog_id, token_hash, created_by, app) values (dog, hash, (select auth.uid()), new_calendar_feed.app);
end;
$$;

-- Stops one calendar app's link, or every link when no app is named.
drop function public.revoke_calendar_feed(uuid);
create function public.revoke_calendar_feed(dog uuid, app text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_household_member(dog) then
    raise exception 'Only the household can stop a calendar link' using errcode = 'insufficient_privilege';
  end if;
  update public.calendar_feeds f set revoked_at = now()
   where f.dog_id = dog and f.revoked_at is null
     and (revoke_calendar_feed.app is null or f.app = revoke_calendar_feed.app);
end;
$$;

revoke all on function public.new_calendar_feed(uuid, text, text) from public, anon;
revoke all on function public.revoke_calendar_feed(uuid, text) from public, anon;
grant execute on function public.new_calendar_feed(uuid, text, text) to authenticated;
grant execute on function public.revoke_calendar_feed(uuid, text) to authenticated;
