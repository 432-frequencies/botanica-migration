-- Allows spiders and related arachnids to be stored as their own category.

alter table public.plant_discoveries
  drop constraint if exists plant_discoveries_category_check;

alter table public.plant_discoveries
  add constraint plant_discoveries_category_check
  check (category in ('plant', 'bird', 'rock', 'fungus', 'tree', 'insect', 'arachnid'));
