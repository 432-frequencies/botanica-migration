-- iOS/TestFlight release readiness migration.
-- Safe to run in Supabase SQL Editor. The statements are idempotent.

-- 1. Observation context: protects the quality of field observations.
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

-- Allow arachnids as first-class observations instead of forcing them into insects.
alter table public.plant_discoveries
  drop constraint if exists plant_discoveries_category_check;

alter table public.plant_discoveries
  add constraint plant_discoveries_category_check
  check (category in ('plant', 'bird', 'rock', 'fungus', 'tree', 'insect', 'arachnid'));

-- 2. Safety status: avoids unsafe edible/toxic assumptions.
alter table public.plant_discoveries
  add column if not exists edibility_status text not null default 'unknown',
  add column if not exists safety_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plant_discoveries_edibility_status_check'
      and conrelid = 'public.plant_discoveries'::regclass
  ) then
    alter table public.plant_discoveries
      add constraint plant_discoveries_edibility_status_check
      check (edibility_status in ('edible', 'toxic', 'non_edible', 'unknown'));
  end if;
end $$;

update public.plant_discoveries
set edibility_status = case
  when is_toxic is true then 'toxic'
  when is_edible is true then 'edible'
  else 'unknown'
end
where edibility_status is null or edibility_status = 'unknown';

update public.plant_discoveries
set safety_notes = case
  when category = 'arachnid' then 'Observe sans manipuler. En cas de morsure douloureuse, nettoie, applique du froid et demande un avis medical.'
  when category = 'insect' then 'Observe sans manipuler si l''espece pique, mord ou irrite. En cas de reaction forte, demande un avis medical.'
  when category = 'fungus' then 'Information indicative: ne jamais consommer un champignon sans verification experte locale.'
  else 'Information indicative - ne pas consommer sans verification experte.'
end
where safety_notes is null
  and category in ('plant', 'tree', 'fungus', 'insect', 'arachnid')
  and edibility_status in ('edible', 'toxic', 'unknown');
