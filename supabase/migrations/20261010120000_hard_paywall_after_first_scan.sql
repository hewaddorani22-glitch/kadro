begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table private.paywall_config in share row exclusive mode;

-- Owner decision 2026-10-10: hard paywall after the first scan for NEW installs.
--
-- Mode `hard_after_first_scan` (private.paywall_config, enabled by this
-- migration):
--   * Cohort: auth users created at or after
--     paywall_config.hard_after_first_scan_starts_at. The cutoff is stored
--     ONCE when this migration runs (the transaction's now()), never
--     recomputed per call. Every account created earlier, every account with
--     a paywall assignment from before the cutoff and every live A/B or QA
--     variant keeps its current scope unchanged (3 free AI analyses, soft
--     paywall; paused B stays soft while enforcement_enabled=false).
--   * A cohort account gets exactly hard_after_first_scan_free_analyses (1)
--     free AI analysis and one free new meal. The first new meal is recorded
--     in private.paywall_free_meals (sticky: deleting the meal does not give
--     the free meal back). From then on paywall_access_v1 reports hard=true,
--     so the existing enforcement paths apply unchanged: the gateway answers
--     402 paywall_access_required for analysis/search/barcode,
--     authorize_meal_create_v1 and guard_new_paywall_meal require an active
--     entitlement for every further new meal. Saved meals stay correctable.
--   * Entitled = the existing RevenueCat entitlement in public.analysis_access
--     (state 'active'); a running App Store free trial gives access in
--     RevenueCat and therefore counts as entitled.
--   * Responses gain `mode` ('legacy' | 'hard_after_first_scan') and
--     `freeAnalyses`; existing keys and their meaning are unchanged.
--
-- Rollout order: release the app build that understands `mode` FIRST, then
-- apply this migration (the cutoff is the apply time). Older builds parse a
-- cohort record with hard=true as invalid and fall back to their free UI
-- while the server still enforces.
-- Switch off: update private.paywall_config set hard_after_first_scan=false
-- (the cohort returns to the legacy scope immediately; free-meal records stay
-- for analysis). Never move hard_after_first_scan_starts_at backwards: that
-- would pull existing accounts into the cohort.
do $hard_after_first_scan_guard$
begin
  if not exists(select 1 from private.paywall_config where experiment = 'paywall_access_v1') then
    raise exception 'paywall_config_missing';
  end if;
  -- Same bodies as 20261005004721 / 20261002210021; refuse silent drift.
  if md5(pg_get_functiondef('private.paywall_access_v1(uuid)'::regprocedure)) <> 'eef39a1b53aa4fbab36c4a895fecf8d7'
    or md5(pg_get_functiondef('private.guard_new_paywall_meal()'::regprocedure)) <> '72c220a810f3eb1f509272cb6f2a4d6d'
    or md5(pg_get_functiondef('private.reserve_analysis_access(uuid,uuid,integer,boolean)'::regprocedure)) <> 'bccbaab29512733f1b371b8bd27dae7e' then
    raise exception 'paywall_functions_changed_before_hard_after_first_scan';
  end if;
end $hard_after_first_scan_guard$;

alter table private.paywall_config
  add column hard_after_first_scan boolean not null default false,
  add column hard_after_first_scan_starts_at timestamptz,
  add column hard_after_first_scan_free_analyses integer not null default 1
    check (hard_after_first_scan_free_analyses between 1 and 3),
  add constraint paywall_config_hard_after_first_scan_cutoff
    check (not hard_after_first_scan or hard_after_first_scan_starts_at is not null);
comment on column private.paywall_config.hard_after_first_scan is
  'Owner decision 2026-10-10: accounts created at/after hard_after_first_scan_starts_at get hard_after_first_scan_free_analyses free AI analyses and one free meal, then need Kandro Pro (trial counts). Set false to return the cohort to the legacy scope.';
comment on column private.paywall_config.hard_after_first_scan_starts_at is
  'Cohort cutoff, stored once by 20261010120000. Never move it backwards.';

update private.paywall_config
set hard_after_first_scan = true,
    hard_after_first_scan_starts_at = coalesce(hard_after_first_scan_starts_at, pg_catalog.now())
where experiment = 'paywall_access_v1';

-- One row per cohort account: the single free meal. Functional, not analytics.
create table private.paywall_free_meals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  meal_id text not null check (char_length(meal_id) between 1 and 240),
  used_at timestamptz not null default now()
);
alter table private.paywall_free_meals enable row level security;
revoke all on private.paywall_free_meals from public, anon, authenticated;
grant all on private.paywall_free_meals to service_role;
comment on table private.paywall_free_meals is
  'hard_after_first_scan: the one free meal of a new-install account; deleted with the account.';

create or replace function private.paywall_access_v1(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.paywall_config%rowtype; a private.paywall_assignments%rowtype;
  q private.paywall_qa_accounts%rowtype; e public.analysis_access%rowtype; u auth.users%rowtype;
  v text; hard boolean; first_scan boolean; state text; valid_until timestamptz; access_clock timestamptz := now();
begin
  select * into u from auth.users where id=p_user_id;
  if u.id is null then raise exception 'cloud_identity_changed'; end if;
  select * into c from private.paywall_config where experiment='paywall_access_v1';
  if not found then raise exception 'access_configuration_unavailable'; end if;
  select * into a from private.paywall_assignments where user_id=p_user_id;
  select * into q from private.paywall_qa_accounts where user_id=p_user_id;
  v := coalesce(case when q.expires_at>access_clock then q.variant else null end,a.variant,'unassigned');
  -- New installs only: created after the stored cutoff, no pre-cutoff
  -- assignment, not a live A/B or QA variant.
  first_scan := coalesce(c.hard_after_first_scan,false) and c.hard_after_first_scan_starts_at is not null
    and u.created_at>=c.hard_after_first_scan_starts_at and v not in ('A','B')
    and (a.user_id is null or a.assigned_at>=c.hard_after_first_scan_starts_at);
  hard := (v='B' and c.enforcement_enabled)
    or (first_scan and exists(select 1 from private.paywall_free_meals f where f.user_id=p_user_id));
  select * into e from public.analysis_access where user_id=p_user_id;
  -- Preserve the same freshness/expiry rules and purchased-rights priority.
  valid_until := least(e.entitlement_expires_at,e.entitlement_checked_at+interval '30 hours');
  state := case
    when e.entitlement_active and e.entitlement_checked_at is not null and valid_until>access_clock then 'active'
    when not hard then 'free'
    when e.entitlement_checked_at>=access_clock-interval '24 hours'
      and (not e.entitlement_active or e.entitlement_expires_at<=access_clock) then 'inactive'
    else 'unknown' end;
  return jsonb_build_object('experiment','paywall_access_v1','variant',v,'source',case when q.user_id is not null then 'qa' else 'public' end,
    'environment',coalesce(q.environment,'production'),'hard',hard,'access',state,'validUntil',case when state='active' then valid_until else null end,
    'reason',coalesce(a.reason,'configuration'),'enrollmentOpen',c.public_enabled,
    'mode',case when first_scan then 'hard_after_first_scan' else 'legacy' end,
    'freeAnalyses',case when first_scan then c.hard_after_first_scan_free_analyses else 3 end);
end $$;
revoke all on function private.paywall_access_v1(uuid) from public,anon,authenticated;
grant execute on function private.paywall_access_v1(uuid) to service_role;

-- Unchanged hard path; the cohort's first new meal claims the free slot.
create or replace function private.guard_new_paywall_meal() returns trigger
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
  if access->>'mode'='hard_after_first_scan' and not (access->>'hard')::boolean then
    -- Serialize with concurrent saves/permits of the same account: exactly
    -- one meal can claim the free slot; any other needs an entitlement.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('paywall-permits:'||new.user_id::text,0));
    insert into private.paywall_free_meals(user_id,meal_id) values(new.user_id,new.id) on conflict (user_id) do nothing;
    if access->>'access'<>'active'
      and not exists(select 1 from private.paywall_free_meals where user_id=new.user_id and meal_id=new.id) then
      raise exception 'paywall_access_required';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_new_paywall_meal() from public,anon,authenticated;

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
  paywall jsonb;
  free_limit integer;
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
  -- outstanding reservations prevents concurrent requests from exceeding the
  -- allowance: 3 for every existing account, 1 (configurable) for an install
  -- in the hard_after_first_scan cohort.
  paywall := private.paywall_access_v1(p_user_id);
  free_limit := case when paywall->>'mode' = 'hard_after_first_scan'
    then coalesce((paywall->>'freeAnalyses')::integer, 1) else 3 end;
  if access_row.free_completed + pending_free < free_limit
    and not coalesce((paywall->>'hard')::boolean,false) then
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
