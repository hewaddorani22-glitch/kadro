-- BLS 4.0 is the authoritative source for curated German composite dishes.
-- Keep the provider in the same source trail as USDA and Open Food Facts.

alter table public.meal_items
  drop constraint if exists meal_items_source_provider_check;

alter table public.meal_items
  add constraint meal_items_source_provider_check
  check (source_provider in ('usda', 'bls', 'open-food-facts', 'kandro-catalog', 'demo'));
