-- Trends shows every number with its source: which scale a weight came from,
-- and when a lab report or note was typed in, as distinct from the day it is
-- about.

-- Weights only: the clinic's scale or a home scale. Scales differ, so Trends
-- joins clinic weights into a line and leaves home weights as separate points.
alter table public.observations
  add column scale text check (scale in ('clinic', 'home')),
  add constraint observations_scale_is_for_weights check (scale is null or type_key = 'weight');

-- When the record was typed in. Rows saved before this migration stay empty
-- rather than carry a made-up time.
alter table public.observations add column created_at timestamptz;
alter table public.observations alter column created_at set default now();
alter table public.events add column created_at timestamptz;
alter table public.events alter column created_at set default now();
