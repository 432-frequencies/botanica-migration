-- Adds a lightweight observation context so discoveries can distinguish
-- real-field observations from domestic/private/off-context scans.
alter table public.plant_discoveries
  add column if not exists observation_context text not null default 'unknown';

update public.plant_discoveries
set observation_context = 'unknown'
where observation_context is null
   or observation_context not in ('wild', 'domestic', 'unknown');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plant_discoveries_observation_context_check'
      and conrelid = 'public.plant_discoveries'::regclass
  ) then
    alter table public.plant_discoveries
      add constraint plant_discoveries_observation_context_check
      check (observation_context in ('wild', 'domestic', 'unknown'));
  end if;
end $$;

create index if not exists plant_discoveries_observation_context_created_at_idx
  on public.plant_discoveries (observation_context, created_at desc)
  where photo_url is not null;
