alter table public.profiles
  add column privacy_version text,
  add column wellness_consent_at timestamptz,
  add constraint profiles_privacy_consent_pair_check check (
    (privacy_version is null and wellness_consent_at is null)
    or (privacy_version is not null and wellness_consent_at is not null)
  );

comment on column public.profiles.privacy_version is 'Version of the in-app privacy notice accepted for wellness-data processing.';
comment on column public.profiles.wellness_consent_at is 'Timestamp of the user’s explicit wellness-data processing consent.';
