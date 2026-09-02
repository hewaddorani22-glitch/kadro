-- Kandro asked every user for their height in centimetres and their weight in
-- kilograms. That is fine in Germany and a wall in the United States and the
-- United Kingdom, where the question arrives at onboarding step five, before
-- anyone has seen what the app does.
--
-- Measurements stay in cm and kg in this table. Only the display changes, so
-- switching units can never move somebody's targets.
alter table public.profiles
  add column if not exists unit_system text not null default 'metric';

alter table public.profiles
  drop constraint if exists profiles_unit_system_check;

alter table public.profiles
  add constraint profiles_unit_system_check
  check (unit_system in ('metric', 'us', 'uk'));

comment on column public.profiles.unit_system is
  'Display units for body measurements: metric (cm/kg), us (ft-in/lb), uk (ft-in/stone). Storage stays metric.';
