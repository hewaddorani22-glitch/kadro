-- Mifflin-St Jeor has a male and a female constant 166 kcal apart. Kandro used
-- the midpoint because onboarding never asked, which cost roughly 115 kcal a
-- day in a fixed direction for every user — about a fifth of a 0.5 kg weekly
-- goal, always the same way for the same person.
--
-- 'unspecified' keeps that midpoint and stays the default, so nobody is forced
-- to answer and existing rows keep the behaviour they were created with.
alter table public.profiles
  add column if not exists sex text not null default 'unspecified';

alter table public.profiles
  drop constraint if exists profiles_sex_check;

alter table public.profiles
  add constraint profiles_sex_check
  check (sex in ('female', 'male', 'unspecified'));

comment on column public.profiles.sex is
  'Biological sex for the resting-energy estimate only. Optional: unspecified uses the midpoint of the two Mifflin-St Jeor constants.';
