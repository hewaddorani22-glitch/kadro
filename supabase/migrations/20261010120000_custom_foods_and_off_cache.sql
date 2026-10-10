begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- "Mein Produkt": foods a user saved from a photographed nutrition label (or
-- entered by hand), optionally linked to the barcode they scanned. Values are
-- per 100 g, exactly as the user confirmed them. Owner-only; deleted with the
-- account (FK to auth.users on delete cascade).
create table public.custom_foods (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  brand text check (brand is null or char_length(brand) between 1 and 60),
  barcode text check (barcode is null or barcode ~ '^[0-9]{7,14}$'),
  calories numeric(6, 1) not null check (calories between 0 and 950),
  protein numeric(5, 1) not null check (protein between 0 and 100),
  carbs numeric(5, 1) not null check (carbs between 0 and 100),
  sugar numeric(5, 1) check (sugar is null or sugar between 0 and 100),
  fat numeric(5, 1) not null check (fat between 0 and 100),
  saturated_fat numeric(5, 1) check (saturated_fat is null or saturated_fat between 0 and 100),
  fiber numeric(5, 1) check (fiber is null or fiber between 0 and 100),
  salt numeric(5, 1) check (salt is null or salt between 0 and 100),
  serving_g numeric(6, 1) check (serving_g is null or serving_g between 1 and 2000),
  package_g numeric(7, 1) check (package_g is null or package_g between 1 and 10000),
  origin text not null check (origin in ('label', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  -- The same physical limits the app checks before saving.
  constraint custom_foods_sugar_within_carbs check (sugar is null or sugar <= carbs + 0.5),
  constraint custom_foods_saturates_within_fat check (saturated_fat is null or saturated_fat <= fat + 0.5),
  constraint custom_foods_mass_within_100g check (protein + carbs + fat + coalesce(fiber, 0) + coalesce(salt, 0) <= 105)
);

-- One product per barcode per user; the newest confirmation replaces it.
create unique index custom_foods_user_barcode_idx on public.custom_foods (user_id, barcode) where barcode is not null;

alter table public.custom_foods enable row level security;
revoke all on table public.custom_foods from public, anon, authenticated;
grant select, insert, update, delete on table public.custom_foods to authenticated;

create policy custom_foods_select_own on public.custom_foods
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy custom_foods_insert_own on public.custom_foods
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy custom_foods_update_own on public.custom_foods
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy custom_foods_delete_own on public.custom_foods
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

-- A bounded personal list, not free storage: at most 500 products per account.
create function private.enforce_custom_food_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.custom_foods where user_id = new.user_id) >= 500 then
    raise exception 'custom_food_limit_reached' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function private.enforce_custom_food_limit() from public, anon, authenticated;
create trigger custom_foods_limit before insert on public.custom_foods
  for each row execute function private.enforce_custom_food_limit();

comment on table public.custom_foods is
  'User-owned products (Mein Produkt) from a photographed nutrition label or own entry; per 100 g; deleted with the account.';

-- Shared Open Food Facts barcode cache, like usda_food_cache: public product
-- records only (requested fields), never user data, never the user's barcode
-- history. A NULL product records "not found" (re-checked after 3 days,
-- found products after 30). Only the edge function's service role reaches it.
create table public.off_product_cache (
  barcode text primary key check (barcode ~ '^[0-9]{7,14}$'),
  product jsonb check (product is null or jsonb_typeof(product) = 'object'),
  fetched_at timestamptz not null default now()
);
alter table public.off_product_cache enable row level security;
revoke all on table public.off_product_cache from public, anon, authenticated;
create index off_product_cache_fetched_at_idx on public.off_product_cache (fetched_at);
comment on table public.off_product_cache is
  'Open Food Facts product records keyed by barcode (30 d found / 3 d not found). No user data.';

notify pgrst, 'reload schema';
commit;
