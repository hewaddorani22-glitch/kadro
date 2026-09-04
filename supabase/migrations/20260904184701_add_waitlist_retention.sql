-- One prior migration could not store ages 16/17 and rewrote them to exactly
-- 18. That destroys the information needed to distinguish those minors from
-- users who really declared 18. Fail closed for the entire ambiguous value:
-- affected existing users re-enter their age once, while every other age is
-- untouched. Clearing completed consent forces onboarding before analytics or
-- wellness processing can resume. This migration runs once, so new 18-year-old
-- profiles created afterwards are not affected.
update public.profiles
set age = null,
    privacy_version = null,
    wellness_consent_at = null,
    guardian_consent_at = null,
    guardian_consent_version = null,
    updated_at = now()
where age = 18;

-- Give confirmation and unsubscribe links independent, high-entropy tokens.
-- Existing rows are backfilled without exposing either token through the Data
-- API; public.waitlist remains RLS-protected and has no client grants/policies.
-- The previous implementation kept rows after an unsubscribe. Honour those
-- earlier choices before adding fresh tokens to the remaining active rows.
delete from public.waitlist
where unsubscribed_at is not null;

alter table public.waitlist
  add column if not exists unsubscribe_token text;

update public.waitlist
set unsubscribe_token = replace(id::text, '-', '') || left(replace(gen_random_uuid()::text, '-', ''), 16)
where unsubscribe_token is null;

alter table public.waitlist
  alter column unsubscribe_token set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'waitlist_unsubscribe_token_check'
      and conrelid = 'public.waitlist'::regclass
  ) then
    alter table public.waitlist
      add constraint waitlist_unsubscribe_token_check
      check (unsubscribe_token ~ '^[a-f0-9]{48}$');
  end if;
end
$$;

create unique index if not exists waitlist_unsubscribe_token_idx
  on public.waitlist (unsubscribe_token);

-- The app's actual public launch date is an owner-supplied fact, not something
-- a migration may guess. It therefore starts NULL and must be set exactly when
-- launch is announced. The cleanup job becomes eligible six months later.
create table if not exists private.waitlist_release_state (
  singleton boolean primary key default true check (singleton),
  launched_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into private.waitlist_release_state (singleton, launched_at)
values (true, null)
on conflict (singleton) do nothing;

alter table private.waitlist_release_state enable row level security;
revoke all on table private.waitlist_release_state from public, anon, authenticated;

comment on table private.waitlist_release_state is
  'Owner-controlled actual Kandro launch time. Leave NULL before launch; set once when launch is publicly announced.';

-- A row in public.waitlist cannot be an attempt counter: repeated targeting of
-- the same address only updates that one row, and a separate count+write pair
-- races under concurrency. Keep short-lived, salted fingerprints in a private
-- table and consume both limits in one database transaction instead.
create table if not exists private.waitlist_rate_limits (
  kind text not null check (kind in ('ip', 'email')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 1),
  primary key (kind, key_hash)
);

alter table private.waitlist_rate_limits enable row level security;
revoke all on table private.waitlist_rate_limits from public, anon, authenticated;

comment on table private.waitlist_rate_limits is
  'Short-lived salted fingerprints used only for atomic waitlist abuse prevention.';

create or replace function private.consume_waitlist_rate_limit(
  p_ip_hash text,
  p_email_hash text,
  rate_clock timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ip_attempts integer;
  email_attempts integer;
begin
  if p_ip_hash is null
     or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_email_hash is null
     or p_email_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'invalid', 'allowed', false);
  end if;

  insert into private.waitlist_rate_limits as limits (
    kind, key_hash, window_started_at, attempt_count
  ) values (
    'email', p_email_hash, rate_clock, 1
  )
  on conflict (kind, key_hash) do update
  set attempt_count = case
        when limits.window_started_at <= excluded.window_started_at - interval '10 minutes' then 1
        else least(limits.attempt_count + 1, 2)
      end,
      window_started_at = case
        when limits.window_started_at <= excluded.window_started_at - interval '10 minutes'
          then excluded.window_started_at
        else limits.window_started_at
      end
  returning attempt_count into email_attempts;

  insert into private.waitlist_rate_limits as limits (
    kind, key_hash, window_started_at, attempt_count
  ) values (
    'ip', p_ip_hash, rate_clock, 1
  )
  on conflict (kind, key_hash) do update
  set attempt_count = case
        when limits.window_started_at <= excluded.window_started_at - interval '1 hour' then 1
        else least(limits.attempt_count + 1, 4)
      end,
      window_started_at = case
        when limits.window_started_at <= excluded.window_started_at - interval '1 hour'
          then excluded.window_started_at
        else limits.window_started_at
      end
  returning attempt_count into ip_attempts;

  return jsonb_build_object(
    'status', 'consumed',
    'allowed', email_attempts = 1 and ip_attempts <= 3
  );
end;
$$;

revoke all on function private.consume_waitlist_rate_limit(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function private.consume_waitlist_rate_limit(text, text, timestamptz)
  to service_role;

create or replace function public.consume_waitlist_rate_limit(
  p_ip_hash text,
  p_email_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.consume_waitlist_rate_limit(p_ip_hash, p_email_hash);
$$;

revoke all on function public.consume_waitlist_rate_limit(text, text)
  from public, anon, authenticated;
grant execute on function public.consume_waitlist_rate_limit(text, text) to service_role;

create or replace function private.purge_waitlist_rate_limits(
  retention_clock timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  delete from private.waitlist_rate_limits
  where window_started_at < retention_clock - interval '2 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_waitlist_rate_limits(timestamptz)
  from public, anon, authenticated;

-- Guardian email is a public-abuse target even though the request itself
-- requires an authenticated (possibly anonymous) Supabase user. A new
-- anonymous account must not bypass the recipient or network ceiling, and a
-- count-then-upsert in the Edge Function would race. Salted user, recipient
-- and network fingerprints are therefore consumed in the same transaction
-- that rotates the confirmation token.
create table if not exists private.guardian_request_rate_limits (
  kind text not null check (kind in ('user', 'email', 'ip')),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 1),
  primary key (kind, key_hash)
);

alter table private.guardian_request_rate_limits enable row level security;
revoke all on table private.guardian_request_rate_limits from public, anon, authenticated;

comment on table private.guardian_request_rate_limits is
  'Short-lived salted fingerprints used only for atomic guardian-email abuse prevention.';

create or replace function private.claim_guardian_consent_request(
  p_user_id uuid,
  p_age smallint,
  p_language text,
  p_notice_version text,
  p_token_hash text,
  p_user_hash text,
  p_ip_hash text,
  p_email_hash text,
  claim_clock timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_consent_at timestamptz;
  current_consent_version text;
  user_attempts integer;
  email_attempts integer;
  ip_attempts integer;
begin
  if p_user_id is null
     or p_age is null
     or p_age not in (14, 15)
     or p_language is null
     or p_language not in ('de', 'en')
     or p_notice_version is null
     or char_length(p_notice_version) not between 1 and 100
     or p_token_hash is null
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_user_hash is null
     or p_user_hash !~ '^[a-f0-9]{64}$'
     or p_ip_hash is null
     or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_email_hash is null
     or p_email_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Keep the same lock order as consume_guardian_consent: request first,
  -- profile second. Reversing those locks can deadlock a resend racing the
  -- guardian's confirmation click.
  perform 1
  from public.guardian_consent_requests
  where user_id = p_user_id
  for update;

  select guardian_consent_at, guardian_consent_version
  into current_consent_at, current_consent_version
  from public.profiles
  where user_id = p_user_id
  for update;

  if current_consent_at is not null
     and current_consent_version = p_notice_version then
    return jsonb_build_object('status', 'approved');
  end if;

  -- Per account: one delivery claim every ten minutes. The upsert serialises
  -- concurrent calls for the same fingerprint, so exactly one can receive 1.
  insert into private.guardian_request_rate_limits as limits (
    kind, key_hash, window_started_at, attempt_count
  ) values (
    'user', p_user_hash, claim_clock, 1
  )
  on conflict (kind, key_hash) do update
  set attempt_count = case
        when limits.window_started_at <= excluded.window_started_at - interval '10 minutes' then 1
        else least(limits.attempt_count + 1, 2)
      end,
      window_started_at = case
        when limits.window_started_at <= excluded.window_started_at - interval '10 minutes'
          then excluded.window_started_at
        else limits.window_started_at
      end
  returning attempt_count into user_attempts;

  if user_attempts <> 1 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- Per guardian recipient: at most three deliveries per rolling window,
  -- including attempts made through different anonymous app accounts.
  insert into private.guardian_request_rate_limits as limits (
    kind, key_hash, window_started_at, attempt_count
  ) values (
    'email', p_email_hash, claim_clock, 1
  )
  on conflict (kind, key_hash) do update
  set attempt_count = case
        when limits.window_started_at <= excluded.window_started_at - interval '1 hour' then 1
        else least(limits.attempt_count + 1, 4)
      end,
      window_started_at = case
        when limits.window_started_at <= excluded.window_started_at - interval '1 hour'
          then excluded.window_started_at
        else limits.window_started_at
      end
  returning attempt_count into email_attempts;

  if email_attempts > 3 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  -- Per source network: cap anonymous-account fan-out to ten deliveries/hour.
  insert into private.guardian_request_rate_limits as limits (
    kind, key_hash, window_started_at, attempt_count
  ) values (
    'ip', p_ip_hash, claim_clock, 1
  )
  on conflict (kind, key_hash) do update
  set attempt_count = case
        when limits.window_started_at <= excluded.window_started_at - interval '1 hour' then 1
        else least(limits.attempt_count + 1, 11)
      end,
      window_started_at = case
        when limits.window_started_at <= excluded.window_started_at - interval '1 hour'
          then excluded.window_started_at
        else limits.window_started_at
      end
  returning attempt_count into ip_attempts;

  if ip_attempts > 10 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.profiles (
    user_id, age, guardian_consent_at, guardian_consent_version,
    privacy_version, wellness_consent_at, updated_at
  ) values (
    p_user_id, p_age, null, null, null, null, claim_clock
  )
  on conflict (user_id) do update
  set age = excluded.age,
      guardian_consent_at = null,
      guardian_consent_version = null,
      privacy_version = null,
      wellness_consent_at = null,
      updated_at = excluded.updated_at;

  insert into public.guardian_consent_requests (
    user_id, guardian_email, language, notice_version, token_hash,
    requested_at, expires_at, confirmed_at, updated_at
  ) values (
    p_user_id, null, p_language, p_notice_version, p_token_hash,
    claim_clock, claim_clock + interval '48 hours', null, claim_clock
  )
  on conflict (user_id) do update
  set guardian_email = null,
      language = excluded.language,
      notice_version = excluded.notice_version,
      token_hash = excluded.token_hash,
      requested_at = excluded.requested_at,
      expires_at = excluded.expires_at,
      confirmed_at = null,
      updated_at = excluded.updated_at;

  return jsonb_build_object('status', 'claimed');
end;
$$;

revoke all on function private.claim_guardian_consent_request(
  uuid, smallint, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function private.claim_guardian_consent_request(
  uuid, smallint, text, text, text, text, text, text, timestamptz
) to service_role;

create or replace function public.claim_guardian_consent_request(
  p_user_id uuid,
  p_age smallint,
  p_language text,
  p_notice_version text,
  p_token_hash text,
  p_user_hash text,
  p_ip_hash text,
  p_email_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_guardian_consent_request(
    p_user_id, p_age, p_language, p_notice_version, p_token_hash,
    p_user_hash, p_ip_hash, p_email_hash
  );
$$;

revoke all on function public.claim_guardian_consent_request(
  uuid, smallint, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.claim_guardian_consent_request(
  uuid, smallint, text, text, text, text, text, text
) to service_role;

create or replace function private.purge_guardian_request_rate_limits(
  retention_clock timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  delete from private.guardian_request_rate_limits
  where window_started_at < retention_clock - interval '2 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_guardian_request_rate_limits(timestamptz)
  from public, anon, authenticated;

-- Older versions briefly persisted the guardian address before sending the
-- email. Remove any such historical values during rollout. New requests write
-- NULL from the outset, and the confirmation transaction below refuses to
-- approve a request unless this privacy invariant holds.
update public.guardian_consent_requests
set guardian_email = null
where guardian_email is not null;

-- The earlier trigger protected the server-owned guardian timestamps but not
-- the age boundary itself. Replace it for already-created projects so a user
-- recorded as 14/15 cannot directly rewrite the profile to 16 and then grant
-- their own consent. Initial age remains self-declared; this prevents a later
-- client-side privilege escalation from an existing minor profile.
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

    if tg_op = 'UPDATE' and old.age is not null and new.age is distinct from old.age then
      if new.age is null then
        raise exception 'declared age cannot be cleared by the client';
      elsif (old.age < 16) is distinct from (new.age < 16)
         or (old.age < 18) is distinct from (new.age < 18) then
        raise exception 'minor age boundary is server managed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.protect_guardian_consent_fields()
  from public, anon, authenticated;

-- Unconfirmed addresses are not useful indefinitely. Confirmed entries are
-- deleted no later than six months after the owner-recorded actual launch.
-- Calling with an explicit clock keeps the boundary independently testable.
create or replace function private.purge_waitlist(retention_clock timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_launch timestamptz;
  deleted_count integer := 0;
  step_count integer := 0;
begin
  delete from public.waitlist
  where confirmed_at is null
    and signed_up_at < retention_clock - interval '30 days';
  get diagnostics deleted_count = row_count;

  select launched_at
  into configured_launch
  from private.waitlist_release_state
  where singleton = true;

  if configured_launch is not null
     and retention_clock >= configured_launch + interval '6 months' then
    delete from public.waitlist;
    get diagnostics step_count = row_count;
    deleted_count := deleted_count + step_count;
  end if;

  return deleted_count;
end;
$$;

revoke all on function private.purge_waitlist(timestamptz) from public, anon, authenticated;

-- Guardian confirmation must be one atomic operation. Recording approval and
-- consuming its token in separate HTTP calls would permit a replay if the
-- second write failed. The private implementation runs in one transaction;
-- the exposed wrapper is callable only by the Edge Function's service role.
grant usage on schema private to service_role;

create or replace function private.consume_guardian_consent(
  p_token_hash text,
  p_notice_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending_user_id uuid;
  approved_user_id uuid;
begin
  select consent_request.user_id
  into pending_user_id
  from public.guardian_consent_requests as consent_request
  where consent_request.token_hash = p_token_hash
    and consent_request.notice_version = p_notice_version
    and consent_request.expires_at >= pg_catalog.now()
    and consent_request.guardian_email is null
  for update;

  if pending_user_id is null then
    return false;
  end if;

  update public.profiles
  set guardian_consent_at = pg_catalog.now(),
      guardian_consent_version = p_notice_version,
      updated_at = pg_catalog.now()
  where user_id = pending_user_id
    and age >= 14
    and age < 16
  returning user_id into approved_user_id;

  if approved_user_id is null then
    return false;
  end if;

  delete from public.guardian_consent_requests
  where user_id = pending_user_id
    and token_hash = p_token_hash;

  if not found then
    raise exception 'guardian consent token was not consumed';
  end if;

  return true;
end;
$$;

revoke all on function private.consume_guardian_consent(text, text) from public, anon, authenticated;
grant execute on function private.consume_guardian_consent(text, text) to service_role;

create or replace function public.consume_guardian_consent(
  p_token_hash text,
  p_notice_version text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.consume_guardian_consent(p_token_hash, p_notice_version);
$$;

revoke all on function public.consume_guardian_consent(text, text) from public, anon, authenticated;
grant execute on function public.consume_guardian_consent(text, text) to service_role;

-- An unconfirmed guardian request has no purpose after its 48-hour link
-- expires. The successful path deletes it immediately; this function removes
-- expired or abandoned requests without retaining the token hash indefinitely.
create or replace function private.purge_guardian_consent_requests(
  retention_clock timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer := 0;
begin
  delete from public.guardian_consent_requests
  where expires_at < retention_clock;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function private.purge_guardian_consent_requests(timestamptz) from public, anon, authenticated;

-- Supabase Cron is backed by pg_cron. The job executes inside Postgres, where
-- it can call the private function without exposing it through the Data API.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare
  existing_job bigint;
begin
  select jobid
  into existing_job
  from cron.job
  where jobname = 'kandro-waitlist-retention'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'kandro-waitlist-retention',
    '23 3 * * *',
    'select private.purge_waitlist();'
  );
end
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid
  into existing_job
  from cron.job
  where jobname = 'kandro-guardian-rate-limit-retention'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'kandro-guardian-rate-limit-retention',
    '41 * * * *',
    'select private.purge_guardian_request_rate_limits();'
  );
end
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid
  into existing_job
  from cron.job
  where jobname = 'kandro-waitlist-rate-limit-retention'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'kandro-waitlist-rate-limit-retention',
    '17 * * * *',
    'select private.purge_waitlist_rate_limits();'
  );
end
$$;

do $$
declare
  existing_job bigint;
begin
  select jobid
  into existing_job
  from cron.job
  where jobname = 'kandro-guardian-request-retention'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'kandro-guardian-request-retention',
    '31 3 * * *',
    'select private.purge_guardian_consent_requests();'
  );
end
$$;
