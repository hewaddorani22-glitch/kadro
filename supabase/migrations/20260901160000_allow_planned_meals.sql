-- Meals chosen from Kandro's own recommendations.
--
-- The whole product promise is that the day re-plans after every meal, but
-- picking one of the three suggestions did nothing at all: no entry, no
-- calories. Logging one needs an origin the meals table accepts, and the
-- original constraint allowed only 'scan'.

alter table public.meals drop constraint if exists meals_origin_check;

alter table public.meals
  add constraint meals_origin_check check (origin in ('scan', 'plan'));

-- Weekly rate of change the user picked. The old model applied a flat
-- -350 / 0 / +250 kcal to everyone, which is not a target, just a number.
alter table public.profiles
  add column if not exists weekly_rate_kg numeric(3, 2) not null default 0.5
  check (weekly_rate_kg in (0.25, 0.50));
