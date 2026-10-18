-- Happening now: one tap starts a timer for a crisis.
--
-- A capture is an events row with capture_mode 'happening_now'. It is saved
-- when the timer starts, so the rest of the household sees it running, and
-- ended_at is filled in when someone taps "It has stopped". A dog has at most
-- one running at a time: if two people start it together, or one starts it
-- with no signal, the second joins the first instead of making two records.

create unique index events_one_happening_now on public.events (dog_id)
  where capture_mode = 'happening_now' and ended_at is null;
