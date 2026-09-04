-- Kandro is available from age 14. In Germany a child below 16 cannot give
-- the consent required for Kandro's wellness-data processing on their own.
-- The guardian columns are therefore server-owned and the consent constraint
-- prevents a modified client from bypassing the confirmation flow.

alter table public.profiles
  add column if not exists guardian_consent_at timestamptz,
  add column if not exists guardian_consent_version text;

alter table public.profiles
  drop constraint if exists profiles_age_check;

alter table public.profiles
  add constraint profiles_age_check
  check (age is null or age between 14 and 100);

alter table public.profiles
  drop constraint if exists profiles_minor_consent_check;

-- Old installations allowed consent to be stored before an age was saved.
-- The new boundary must not guess that such a profile is an adult: clear the
-- paired consent fields so the user supplies an age and accepts the current
-- notice on the next app launch.
update public.profiles
set privacy_version = null,
    wellness_consent_at = null,
    updated_at = now()
where age is null
  and (privacy_version is not null or wellness_consent_at is not null);

alter table public.profiles
  add constraint profiles_minor_consent_check
  check (
    wellness_consent_at is null
    or (
      age is not null
      and (
        age >= 16
        or (
          guardian_consent_at is not null
          and guardian_consent_version = '2026-09-04-guardian-v1'
        )
      )
    )
  );

comment on column public.profiles.guardian_consent_at is
  'Server-owned timestamp of verified guardian authorization for a user below 16.';
comment on column public.profiles.guardian_consent_version is
  'Version of the guardian notice confirmed through the emailed token.';

create table public.guardian_consent_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  guardian_email text check (guardian_email is null or char_length(guardian_email) between 6 and 254),
  language text not null default 'en' check (language in ('de', 'en')),
  notice_version text not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guardian_consent_requests enable row level security;
revoke all on table public.guardian_consent_requests from anon, authenticated;

comment on table public.guardian_consent_requests is
  'Private guardian email confirmations. No client policy; only the guardian-consent Edge Function may access it.';

create or replace function public.protect_guardian_consent_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.guardian_consent_at is not null or new.guardian_consent_version is not null then
        raise exception 'guardian consent fields are server managed';
      end if;
    elsif new.guardian_consent_at is distinct from old.guardian_consent_at
       or new.guardian_consent_version is distinct from old.guardian_consent_version then
      raise exception 'guardian consent fields are server managed';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_guardian_consent_fields() from public, anon, authenticated;

drop trigger if exists protect_guardian_consent_fields on public.profiles;
create trigger protect_guardian_consent_fields
before insert or update on public.profiles
for each row execute function public.protect_guardian_consent_fields();
