begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Owner decision 04.10.2026: any food must be loggable. A user-entered food
-- ("Selbst eintragen") is stored with source_provider 'manual'. Existing rows
-- and the other providers are unchanged; values keep all existing range checks.
alter table public.meal_items drop constraint meal_items_source_provider_check;
alter table public.meal_items add constraint meal_items_source_provider_check
  check (source_provider in ('usda', 'bls', 'open-food-facts', 'kandro-catalog', 'demo', 'manual'));
notify pgrst, 'reload schema';
commit;
