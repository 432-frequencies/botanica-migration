-- Verifies the release-critical plant_discoveries columns after migration.

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'plant_discoveries'
  and column_name in ('observation_context', 'edibility_status', 'safety_notes')
order by column_name;

select
  observation_context,
  count(*) as discoveries
from public.plant_discoveries
group by observation_context
order by discoveries desc;

select
  edibility_status,
  count(*) as discoveries
from public.plant_discoveries
group by edibility_status
order by discoveries desc;

select
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid = 'public.plant_discoveries'::regclass
  and conname = 'plant_discoveries_category_check';
