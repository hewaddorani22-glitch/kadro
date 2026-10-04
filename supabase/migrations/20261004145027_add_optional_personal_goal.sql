-- Optional adult wishes only. Existing profiles/clients retain NULL and their
-- existing ownership, age/guardian safeguards, targets and completed state.
alter table public.profiles
  add column if not exists target_weight_kg numeric(5, 2),
  add column if not exists target_date date;

alter table public.profiles
  add constraint profiles_personal_goal_check check (
    (target_weight_kg is null and target_date is null)
    or (
      age is not null and age >= 18
      and target_weight_kg is not null and target_weight_kg between 40 and 200
      and (target_date is null or target_date between date '1900-01-01' and date '9999-12-31')
    )
  );

comment on column public.profiles.target_weight_kg is
  'Optional adult-entered desired weight in kg; no impact on nutrition formulas and no promised outcome.';
comment on column public.profiles.target_date is
  'Optional adult-entered desired calendar date; no inferred deadline and no prediction.';
-- Do not constrain the pre-existing goal column: older clients changing their
-- nutrition goal cannot clear fields they do not know. The app hides/clears
-- optional wishes for maintenance; stored wishes never affect nutrition.
-- Existing profiles RLS and owner-scoped policies remain authoritative.
