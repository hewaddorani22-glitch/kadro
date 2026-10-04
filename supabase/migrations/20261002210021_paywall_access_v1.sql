begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Functional access records, not analytics. No customer is enrolled by deployment.
create table private.paywall_config (
  experiment text primary key check (experiment = 'paywall_access_v1'),
  public_enabled boolean not null default false,
  enforcement_enabled boolean not null default true,
  starts_at timestamptz,
  monthly_product text not null default 'com.hewaddorani.kandro.pro.monthly',
  check (not public_enabled or starts_at is not null)
);
insert into private.paywall_config(experiment) values ('paywall_access_v1');
create table private.paywall_assignments (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experiment text not null default 'paywall_access_v1' references private.paywall_config(experiment),
  variant text not null check (variant in ('A','B','excluded')),
  reason text not null check (reason in ('eligible','configuration','identity','age','existing','pro','offer','fallback','prior_use')),
  assigned_at timestamptz not null default now()
);
-- Explicit, expiring synthetic identities only. Never populated from client input.
create table private.paywall_qa_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  variant text not null check (variant in ('A','B')),
  environment text not null check (environment in ('local','testflight','review')),
  purpose text not null check (char_length(purpose) between 10 and 200),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
-- Permits are bound to a single meal ID before local creation. They survive
-- expiry solely for that already-authorized pending create; never reusable IDs.
create table private.paywall_meal_permits (
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null check (char_length(meal_id) between 1 and 240),
  granted_at timestamptz not null default now(),
  primary key(user_id,meal_id)
);
alter table private.paywall_config enable row level security;
alter table private.paywall_assignments enable row level security;
alter table private.paywall_qa_accounts enable row level security;
alter table private.paywall_meal_permits enable row level security;
revoke all on private.paywall_config, private.paywall_assignments, private.paywall_qa_accounts, private.paywall_meal_permits from public,anon,authenticated;
grant all on private.paywall_config, private.paywall_assignments, private.paywall_qa_accounts, private.paywall_meal_permits to service_role;

create function private.paywall_access_v1(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.paywall_config%rowtype; a private.paywall_assignments%rowtype;
  q private.paywall_qa_accounts%rowtype; e public.analysis_access%rowtype;
  v text; hard boolean; state text; valid_until timestamptz; access_clock timestamptz := now();
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'cloud_identity_changed'; end if;
  select * into c from private.paywall_config where experiment='paywall_access_v1';
  if not found then raise exception 'access_configuration_unavailable'; end if;
  select * into a from private.paywall_assignments where user_id=p_user_id;
  select * into q from private.paywall_qa_accounts where user_id=p_user_id and expires_at>access_clock;
  v := coalesce(q.variant,a.variant,'unassigned');
  hard := v='B' and c.enforcement_enabled;
  select * into e from public.analysis_access where user_id=p_user_id;
  -- Same 24h freshness / 30h bounded stale grace as analysis access. A known
  -- expiry is never extended, and a newer negative observation always wins.
  valid_until := least(e.entitlement_expires_at,e.entitlement_checked_at+interval '30 hours');
  state := case
    when e.entitlement_active and e.entitlement_checked_at is not null and valid_until>access_clock then 'active'
    when not hard then 'free'
    when e.entitlement_checked_at>=access_clock-interval '24 hours'
      and (not e.entitlement_active or e.entitlement_expires_at<=access_clock) then 'inactive'
    else 'unknown' end;
  return jsonb_build_object('experiment','paywall_access_v1','variant',v,'source',case when q.user_id is not null then 'qa' else 'public' end,
    'environment',coalesce(q.environment,'production'),'hard',hard,'access',state,'validUntil',case when state='active' then valid_until else null end,
    'reason',coalesce(a.reason,'configuration'),'enrollmentOpen',c.public_enabled);
end $$;
revoke all on function private.paywall_access_v1(uuid) from public,anon,authenticated;
grant execute on function private.paywall_access_v1(uuid) to service_role;
create function public.resolve_paywall_access_v1(p_user_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.paywall_access_v1(p_user_id); $$;
revoke all on function public.resolve_paywall_access_v1(uuid) from public,anon,authenticated;
grant execute on function public.resolve_paywall_access_v1(uuid) to service_role;

-- First normal use freezes the pre-experiment contract, including old clients
-- created after the configured start. Later account linking cannot enroll them.
create function private.record_paywall_prior_use_v1(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'cloud_identity_changed'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paywall:'||p_user_id::text,0));
  insert into private.paywall_assignments(user_id,variant,reason) values(p_user_id,'excluded','prior_use') on conflict do nothing;
  return private.paywall_access_v1(p_user_id);
end $$;
revoke all on function private.record_paywall_prior_use_v1(uuid) from public,anon,authenticated;
grant execute on function private.record_paywall_prior_use_v1(uuid) to service_role;
create function public.record_paywall_prior_use_v1(p_user_id uuid) returns jsonb
language sql security invoker set search_path='' as $$select private.record_paywall_prior_use_v1(p_user_id);$$;
revoke all on function public.record_paywall_prior_use_v1(uuid) from public,anon,authenticated;
grant execute on function public.record_paywall_prior_use_v1(uuid) to service_role;

create function private.enroll_paywall_access_v1(p_user_id uuid,p_first_use boolean,p_age_confirmed boolean,p_trial_eligible boolean,p_product text,p_seven_days boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.paywall_config%rowtype; u auth.users%rowtype; p public.profiles%rowtype; e public.analysis_access%rowtype; why text; chosen text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paywall:'||p_user_id::text,0));
  if exists(select 1 from private.paywall_assignments where user_id=p_user_id) then return private.paywall_access_v1(p_user_id); end if;
  select * into c from private.paywall_config where experiment='paywall_access_v1';
  select * into u from auth.users where id=p_user_id;
  if u.id is null then raise exception 'cloud_identity_changed'; end if;
  select * into p from public.profiles where user_id=p_user_id;
  select * into e from public.analysis_access where user_id=p_user_id;
  why := case
    when c.experiment is null or not c.public_enabled or c.starts_at is null then 'configuration'
    when u.created_at<c.starts_at or exists(select 1 from public.meals where user_id=p_user_id)
      or coalesce(e.free_completed,0)>0 then 'existing'
    when p.age is null or p.age<18 or p_age_confirmed is distinct from true then 'age'
    when u.is_anonymous is distinct from false or u.email_confirmed_at is null then 'identity'
    when p_first_use is distinct from true then 'prior_use'
    when e.entitlement_checked_at is null or e.entitlement_checked_at<now()-interval '24 hours' then 'offer'
    when e.entitlement_active and (e.entitlement_expires_at is null or e.entitlement_expires_at>now()) then 'pro'
    when p_trial_eligible is distinct from true or p_seven_days is distinct from true or p_product is distinct from c.monthly_product then 'offer'
    else 'eligible' end;
  chosen := case when why='eligible' then case when get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)<128 then 'A' else 'B' end else 'excluded' end;
  insert into private.paywall_assignments(user_id,variant,reason) values(p_user_id,chosen,why);
  return private.paywall_access_v1(p_user_id);
end $$;
revoke all on function private.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean) from public,anon,authenticated;
grant execute on function private.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean) to service_role;
create function public.enroll_paywall_access_v1(p_user_id uuid,p_first_use boolean,p_age_confirmed boolean,p_trial_eligible boolean,p_product text,p_seven_days boolean)
returns jsonb language sql security invoker set search_path='' as $$ select private.enroll_paywall_access_v1(p_user_id,p_first_use,p_age_confirmed,p_trial_eligible,p_product,p_seven_days); $$;
revoke all on function public.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean) to service_role;

-- An outage fallback can only exclude an unassigned identity. It cannot erase
-- B, buy Pro, change another account, or force an experiment variant.
create function private.exclude_paywall_access_v1() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'cloud_identity_changed'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paywall:'||auth.uid()::text,0));
  insert into private.paywall_assignments(user_id,variant,reason) values(auth.uid(),'excluded','fallback') on conflict do nothing;
end $$;
revoke all on function private.exclude_paywall_access_v1() from public,anon;
grant execute on function private.exclude_paywall_access_v1() to authenticated;
create function public.exclude_paywall_access_v1() returns void language sql security invoker set search_path='' as $$select private.exclude_paywall_access_v1();$$;
revoke all on function public.exclude_paywall_access_v1() from public,anon;
grant execute on function public.exclude_paywall_access_v1() to authenticated;

create function private.authorize_meal_create_v1(p_meal_id text) returns void
language plpgsql security definer set search_path='' as $$
declare access jsonb;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'cloud_identity_changed'; end if;
  if p_meal_id is null or char_length(p_meal_id) not between 1 and 240 then raise exception 'invalid_meal_id'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paywall-permits:'||auth.uid()::text,0));
  if exists(select 1 from public.meals where user_id=auth.uid() and id=p_meal_id)
    or exists(select 1 from private.paywall_meal_permits where user_id=auth.uid() and meal_id=p_meal_id) then return; end if;
  access := private.paywall_access_v1(auth.uid());
  if (access->>'hard')::boolean and access->>'access'<>'active' then raise exception 'paywall_access_required'; end if;
  if (access->>'hard')::boolean then
    -- Bound unconsumed receipts without expiring a legitimate offline save.
    -- Completed/deleted IDs are already covered by the existing sync ledger.
    if (select count(*) from private.paywall_meal_permits p
      where p.user_id=auth.uid() and not exists(select 1 from private.meal_sync_state s
        where s.user_id=p.user_id and s.meal_id=p.meal_id)) >= 64 then
      raise exception 'pending_meal_limit';
    end if;
    insert into private.paywall_meal_permits(user_id,meal_id) values(auth.uid(),p_meal_id) on conflict do nothing;
  end if;
end $$;
revoke all on function private.authorize_meal_create_v1(text) from public,anon;
grant execute on function private.authorize_meal_create_v1(text) to authenticated;
create function public.authorize_meal_create_v1(p_meal_id text) returns void language sql security invoker set search_path='' as $$select private.authorize_meal_create_v1(p_meal_id);$$;
revoke all on function public.authorize_meal_create_v1(text) from public,anon;
grant execute on function public.authorize_meal_create_v1(text) to authenticated;

create function private.guard_new_paywall_meal() returns trigger
language plpgsql security definer set search_path='' as $$
declare access jsonb;
begin
  -- Existing meal corrections and deletions keep their original owner policies.
  if exists(select 1 from public.meals where user_id=new.user_id and id=new.id) then return new; end if;
  access := private.record_paywall_prior_use_v1(new.user_id);
  if (access->>'hard')::boolean and not exists(select 1 from private.paywall_meal_permits where user_id=new.user_id and meal_id=new.id) then
    if access->>'access'<>'active' then raise exception 'paywall_access_required'; end if;
    insert into private.paywall_meal_permits(user_id,meal_id) values(new.user_id,new.id) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.guard_new_paywall_meal() from public,anon,authenticated;
create trigger guard_new_paywall_meal before insert on public.meals for each row execute function private.guard_new_paywall_meal();

-- B reaches the verified Pro path before free quota selection.
create or replace function private.reserve_analysis_access(
  p_user_id uuid,
  p_request_id uuid,
  p_pro_daily_limit integer,
  p_allow_stale_grace boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_utc timestamptz := pg_catalog.now();
  today_utc date := (pg_catalog.now() at time zone 'utc')::date;
  request_row public.analysis_requests%rowtype;
  access_row public.analysis_access%rowtype;
  pending_free integer := 0;
  used_pro integer := 0;
  selected_access text;
  entitlement_current boolean;
  entitlement_fresh boolean;
  entitlement_in_grace boolean;
begin
  if p_user_id is null or p_request_id is null then
    return pg_catalog.jsonb_build_object('status', 'invalid_request');
  end if;
  if p_pro_daily_limit is null or p_pro_daily_limit < 1 or p_pro_daily_limit > 1000 then
    return pg_catalog.jsonb_build_object('status', 'invalid_limit');
  end if;

  -- Every mutation for one customer takes the same transaction-scoped lock.
  -- External provider calls happen outside SQL, so this lock is held only for
  -- the short reservation/transition transaction.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );

  -- A killed Edge invocation must not hold a credit forever. The provider
  -- attempt remains counted by analysis_usage, even when this access
  -- reservation is refunded.
  update public.analysis_requests
  set state = 'refunded',
      refunded_at = now_utc,
      result_json = null,
      updated_at = now_utc
  where user_id = p_user_id
    and state in ('reserved', 'started')
    and reserved_at < now_utc - interval '15 minutes';

  update public.analysis_requests
  set result_json = null,
      updated_at = now_utc
  where user_id = p_user_id
    and state = 'completed'
    and completed_at < now_utc - interval '22 hours'
    and result_json is not null;

  delete from public.analysis_requests
  where user_id = p_user_id
    and state in ('completed', 'refunded')
    and updated_at < now_utc - interval '30 days';

  select * into request_row
  from public.analysis_requests
  where user_id = p_user_id and request_id = p_request_id;

  if found and request_row.state = 'completed' then
    if request_row.result_json is not null then
      return pg_catalog.jsonb_build_object(
        'status', 'replay',
        'accessKind', request_row.access_kind,
        'result', request_row.result_json
      );
    end if;
    return pg_catalog.jsonb_build_object('status', 'request_completed');
  end if;

  if found and request_row.state in ('reserved', 'started') then
    return pg_catalog.jsonb_build_object('status', 'in_progress');
  end if;

  insert into public.analysis_access (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into access_row
  from public.analysis_access
  where user_id = p_user_id
  for update;

  select pg_catalog.count(*)::integer into pending_free
  from public.analysis_requests
  where user_id = p_user_id
    and access_kind = 'free'
    and state in ('reserved', 'started');

  -- Lifetime free access is reserved before consulting RevenueCat. Counting
  -- outstanding reservations prevents concurrent requests from exceeding 3.
  if access_row.free_completed + pending_free < 3
    and not coalesce((private.paywall_access_v1(p_user_id)->>'hard')::boolean,false) then
    selected_access := 'free';
  else
    entitlement_current := access_row.entitlement_active
      and (access_row.entitlement_expires_at is null or access_row.entitlement_expires_at > now_utc);
    entitlement_fresh := entitlement_current
      and access_row.entitlement_checked_at >= now_utc - interval '24 hours';
    entitlement_in_grace := entitlement_current
      and access_row.entitlement_checked_at >= now_utc - interval '30 hours';

    if entitlement_fresh or (p_allow_stale_grace and entitlement_in_grace) then
      select pg_catalog.count(*)::integer into used_pro
      from public.analysis_requests
      where user_id = p_user_id
        and request_date = today_utc
        and access_kind = 'pro'
        and state in ('reserved', 'started', 'completed');

      if used_pro >= p_pro_daily_limit then
        return pg_catalog.jsonb_build_object('status', 'daily_limit_reached');
      end if;
      selected_access := 'pro';
    elsif access_row.entitlement_checked_at is null
      or access_row.entitlement_checked_at < now_utc - interval '24 hours'
      or (
        access_row.entitlement_active
        and access_row.entitlement_expires_at is not null
        and access_row.entitlement_expires_at <= now_utc
      ) then
      return pg_catalog.jsonb_build_object(
        'status', 'verification_required',
        'graceEligible', entitlement_in_grace
      );
    else
      return pg_catalog.jsonb_build_object('status', 'subscription_required');
    end if;
  end if;

  insert into public.analysis_requests (
    user_id,
    request_id,
    request_date,
    state,
    access_kind,
    reserved_at,
    started_at,
    completed_at,
    refunded_at,
    result_json,
    updated_at
  ) values (
    p_user_id,
    p_request_id,
    today_utc,
    'reserved',
    selected_access,
    now_utc,
    null,
    null,
    null,
    null,
    now_utc
  )
  on conflict (user_id, request_id) do update
    set request_date = excluded.request_date,
        state = 'reserved',
        access_kind = excluded.access_kind,
        reserved_at = excluded.reserved_at,
        started_at = null,
        completed_at = null,
        refunded_at = null,
        result_json = null,
        updated_at = excluded.updated_at
    where public.analysis_requests.state = 'refunded';

  return pg_catalog.jsonb_build_object(
    'status', 'reserved',
    'accessKind', selected_access
  );
end;
$$;
notify pgrst, 'reload schema';
commit;
