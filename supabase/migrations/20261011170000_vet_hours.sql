-- The out-of-hours service's name, and both practices' opening hours as the
-- owner saved them. Emergency uses the hours only to choose which number to
-- show first; with none saved, the dog's own vet comes first.
--
-- Hours are {"always": true}, or {"week": [span or null, ...]} with seven
-- entries from Monday, each span ["08:00", "19:00"]; a span that closes
-- before it opens runs past midnight.

alter table public.dogs
  add column out_of_hours_name text,
  add column vet_hours jsonb check (vet_hours is null or jsonb_typeof(vet_hours) = 'object'),
  add column out_of_hours_hours jsonb check (out_of_hours_hours is null or jsonb_typeof(out_of_hours_hours) = 'object');
