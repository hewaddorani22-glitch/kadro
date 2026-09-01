-- Shared cache for USDA FoodData Central lookups.
--
-- Every analysed ingredient costs one USDA request, up to twelve per scan.
-- api.data.gov meters that per API key across the whole app, not per user, so
-- the food database — not the vision model — is the first thing that breaks
-- under load. USDA nutrient values are effectively static, so the same search
-- term never needs to be asked twice.
--
-- The table holds no personal data: search terms are English generic food names
-- produced by the model ("grilled chicken breast"), never user text. It still
-- carries RLS with no policies and no grants, so only the edge function's
-- service role can reach it.

create table public.usda_food_cache (
  search_term text primary key,
  -- NULL records a lookup that found nothing, so junk terms are not retried on
  -- every scan. Negative entries expire sooner than positive ones.
  fdc_id text,
  calories numeric(9, 2) not null default 0,
  protein numeric(9, 2) not null default 0,
  carbs numeric(9, 2) not null default 0,
  fat numeric(9, 2) not null default 0,
  fiber numeric(9, 2) not null default 0,
  hit_count integer not null default 0,
  fetched_at timestamptz not null default now()
);

alter table public.usda_food_cache enable row level security;

revoke all on table public.usda_food_cache from anon, authenticated;

create index usda_food_cache_fetched_at_idx on public.usda_food_cache (fetched_at);

comment on table public.usda_food_cache is
  'Generic USDA nutrient values keyed by normalized English search term. No user data.';
