-- Kandro's onboarding and terms are 18+. Keep the database boundary aligned
-- so a stale or modified client cannot create a minor profile.
update public.profiles
set age = 18,
    updated_at = now()
where age between 16 and 17;

alter table public.profiles
  drop constraint if exists profiles_age_check;

alter table public.profiles
  add constraint profiles_age_check
  check (age is null or age between 18 and 100);
