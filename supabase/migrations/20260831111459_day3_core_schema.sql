create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Alex',
  goal text not null default 'lose' check (goal in ('lose', 'maintain', 'gain')),
  age smallint check (age is null or age between 16 and 100),
  height_cm numeric(5, 2) check (height_cm is null or height_cm between 120 and 230),
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 35 and 350),
  activity_level text not null default 'light' check (activity_level in ('low', 'light', 'moderate', 'high')),
  preferences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_targets (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_date date not null,
  calories integer not null check (calories between 1200 and 6000),
  protein integer not null check (protein between 20 and 400),
  carbs integer not null check (carbs between 20 and 800),
  fat integer not null check (fat between 15 and 250),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, target_date)
);

create table public.meals (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  title text not null check (char_length(title) between 1 and 160),
  meal_type text not null check (meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  eaten_at timestamptz not null,
  meal_date date not null,
  calories integer not null check (calories between 0 and 10000),
  protein integer not null check (protein between 0 and 1000),
  carbs integer not null check (carbs between 0 and 2000),
  fat integer not null check (fat between 0 and 1000),
  fiber integer not null default 0 check (fiber between 0 and 500),
  confidence text not null check (confidence in ('high', 'medium')),
  origin text not null default 'scan' check (origin = 'scan'),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.meal_items (
  user_id uuid not null,
  meal_id text not null,
  id text not null,
  name text not null check (char_length(name) between 1 and 160),
  amount_g integer not null check (amount_g between 1 and 5000),
  base_amount_g integer not null check (base_amount_g between 1 and 5000),
  portion_factor numeric(6, 3) not null check (portion_factor > 0 and portion_factor <= 20),
  calories integer not null check (calories between 0 and 10000),
  protein integer not null check (protein between 0 and 1000),
  carbs integer not null check (carbs between 0 and 2000),
  fat integer not null check (fat between 0 and 1000),
  fiber integer not null default 0 check (fiber between 0 and 500),
  confidence text not null check (confidence in ('high', 'medium')),
  optional boolean not null default false,
  included boolean not null default true,
  source_provider text not null check (source_provider in ('usda', 'open-food-facts', 'kadro-catalog', 'demo')),
  source_reference_id text,
  source_label text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, meal_id, id),
  foreign key (user_id, meal_id) references public.meals (user_id, id) on delete cascade
);

create table public.recommendations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  recommendation_date date not null,
  context text not null check (context in ('home', 'supermarket', 'eating-out')),
  remaining_calories integer not null check (remaining_calories >= 0),
  remaining_protein integer not null check (remaining_protein >= 0),
  remaining_carbs integer not null check (remaining_carbs >= 0),
  remaining_fat integer not null check (remaining_fat >= 0),
  suggestion_ids text[] not null check (cardinality(suggestion_ids) = 3),
  created_at timestamptz not null default now()
);

create table public.recommendation_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  context text not null check (context in ('home', 'supermarket', 'eating-out')),
  suggestion_id text not null,
  action text not null check (action in ('accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index meals_user_date_eaten_idx on public.meals (user_id, meal_date, eaten_at);
create index recommendations_user_date_created_idx on public.recommendations (user_id, recommendation_date, created_at desc);
create index recommendation_feedback_user_created_idx on public.recommendation_feedback (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.daily_targets enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_feedback enable row level security;

revoke all on table public.profiles, public.daily_targets, public.meals, public.meal_items, public.recommendations, public.recommendation_feedback from anon, authenticated;
grant select, insert, update on table public.profiles, public.daily_targets to authenticated;
grant select, insert, update, delete on table public.meals, public.meal_items to authenticated;
grant select, insert on table public.recommendations, public.recommendation_feedback to authenticated;
grant usage on sequence public.recommendations_id_seq, public.recommendation_feedback_id_seq to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy daily_targets_select_own on public.daily_targets
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy daily_targets_insert_own on public.daily_targets
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy daily_targets_update_own on public.daily_targets
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy meals_select_own on public.meals
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy meals_insert_own on public.meals
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy meals_update_own on public.meals
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy meals_delete_own on public.meals
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy meal_items_select_own on public.meal_items
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy meal_items_insert_own on public.meal_items
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy meal_items_update_own on public.meal_items
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy meal_items_delete_own on public.meal_items
  for delete to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy recommendations_select_own on public.recommendations
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy recommendations_insert_own on public.recommendations
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy recommendation_feedback_select_own on public.recommendation_feedback
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy recommendation_feedback_insert_own on public.recommendation_feedback
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
