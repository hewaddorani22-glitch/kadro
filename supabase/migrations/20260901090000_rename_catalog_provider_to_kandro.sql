-- Rename the internal catalog provider from "kadro-catalog" to "kandro-catalog".
-- The app was renamed to Kandro; this keeps the stored source_provider values in
-- sync with src/types/nutrition.ts without invalidating rows written before the
-- rename.

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'meal_items'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) like '%source_provider%';

  if constraint_name is not null then
    execute format('alter table public.meal_items drop constraint %I', constraint_name);
  end if;
end
$$;

-- Accept both spellings while existing rows are migrated.
alter table public.meal_items
  add constraint meal_items_source_provider_check
  check (source_provider in ('usda', 'open-food-facts', 'kandro-catalog', 'kadro-catalog', 'demo'));

update public.meal_items
   set source_provider = 'kandro-catalog'
 where source_provider = 'kadro-catalog';

-- Now that no legacy rows remain, narrow the constraint to the current values.
alter table public.meal_items
  drop constraint meal_items_source_provider_check;

alter table public.meal_items
  add constraint meal_items_source_provider_check
  check (source_provider in ('usda', 'open-food-facts', 'kandro-catalog', 'demo'));
