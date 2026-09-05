-- Server-authoritative access control for paid AI analysis.
--
-- Search and barcode routes never call these functions. Photo and description
-- analysis reserve one idempotent request before reaching a paid provider.
-- Only a successful, structured response commits a lifetime free analysis.
-- RevenueCat state is written exclusively by Edge Functions using service_role.

create schema if not exists private;
grant usage on schema private to service_role;

create table public.analysis_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  free_completed smallint not null default 0
    check (free_completed between 0 and 3),
  entitlement_active boolean not null default false,
  entitlement_expires_at timestamptz,
  entitlement_seen_at timestamptz,
  entitlement_checked_at timestamptz,
  entitlement_refresh_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.analysis_requests (
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  request_date date not null default ((now() at time zone 'utc')::date),
  state text not null check (state in ('reserved', 'started', 'completed', 'refunded')),
  access_kind text not null check (access_kind in ('free', 'pro')),
  reserved_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz,
  result_json jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, request_id),
  check (result_json is null or jsonb_typeof(result_json) = 'object')
);

create table public.revenuecat_webhook_events (
  event_id text not null check (char_length(event_id) between 1 and 255),
  event_type text not null check (char_length(event_type) between 1 and 80),
  environment text not null check (environment in ('SANDBOX', 'PRODUCTION', 'UNKNOWN')),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_timestamp_ms bigint not null check (event_timestamp_ms > 0),
  received_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.analysis_global_usage (
  usage_date date primary key,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.analysis_access enable row level security;
alter table public.analysis_requests enable row level security;
alter table public.revenuecat_webhook_events enable row level security;
alter table public.analysis_global_usage enable row level security;

revoke all on table public.analysis_access from public, anon, authenticated;
revoke all on table public.analysis_requests from public, anon, authenticated;
revoke all on table public.revenuecat_webhook_events from public, anon, authenticated;
revoke all on table public.analysis_global_usage from public, anon, authenticated;

-- The primary key starts with user_id, which covers per-user lookups and FK
-- cascades. These partial/retention indexes match the other hot predicates.
create index analysis_requests_daily_pro_idx
  on public.analysis_requests (user_id, request_date)
  where access_kind = 'pro' and state in ('reserved', 'started', 'completed');
create index analysis_requests_retention_idx
  on public.analysis_requests (updated_at);
create index revenuecat_webhook_events_retention_idx
  on public.revenuecat_webhook_events (received_at);
create index revenuecat_webhook_events_user_idx
  on public.revenuecat_webhook_events (user_id);

create function private.reserve_analysis_access(
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
  if access_row.free_completed + pending_free < 3 then
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

create function private.mark_analysis_request_started(
  p_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );
  update public.analysis_requests
  set state = 'started',
      started_at = coalesce(started_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  where user_id = p_user_id
    and request_id = p_request_id
    and state in ('reserved', 'started');
  get diagnostics changed = row_count;
  return pg_catalog.jsonb_build_object('status', case when changed = 1 then 'started' else 'invalid_state' end);
end;
$$;

create function private.complete_analysis_request(
  p_user_id uuid,
  p_request_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.analysis_requests%rowtype;
  access_row public.analysis_access%rowtype;
  now_utc timestamptz := pg_catalog.now();
begin
  if p_result is null
    or pg_catalog.jsonb_typeof(p_result) <> 'object'
    or pg_catalog.octet_length(p_result::text) > 262144 then
    return pg_catalog.jsonb_build_object('status', 'invalid_result');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );
  select * into request_row
  from public.analysis_requests
  where user_id = p_user_id and request_id = p_request_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('status', 'missing_request');
  end if;
  if request_row.state = 'completed' then
    return pg_catalog.jsonb_build_object('status', 'completed');
  end if;
  if request_row.state not in ('reserved', 'started') then
    return pg_catalog.jsonb_build_object('status', 'invalid_state');
  end if;

  if request_row.access_kind = 'free' then
    select * into access_row
    from public.analysis_access
    where user_id = p_user_id
    for update;
    if not found or access_row.free_completed >= 3 then
      return pg_catalog.jsonb_build_object('status', 'free_limit_invariant');
    end if;
    update public.analysis_access
    set free_completed = free_completed + 1,
        updated_at = now_utc
    where user_id = p_user_id;
  end if;

  update public.analysis_requests
  set state = 'completed',
      completed_at = now_utc,
      result_json = p_result,
      updated_at = now_utc
  where user_id = p_user_id and request_id = p_request_id;

  return pg_catalog.jsonb_build_object('status', 'completed');
end;
$$;

create function private.refund_analysis_request(
  p_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );
  update public.analysis_requests
  set state = 'refunded',
      refunded_at = pg_catalog.now(),
      result_json = null,
      updated_at = pg_catalog.now()
  where user_id = p_user_id
    and request_id = p_request_id
    and state in ('reserved', 'started');
  get diagnostics changed = row_count;
  return pg_catalog.jsonb_build_object('status', case when changed = 1 then 'refunded' else 'unchanged' end);
end;
$$;

create function private.sync_revenuecat_entitlement(
  p_user_id uuid,
  p_active boolean,
  p_expires_at timestamptz,
  p_checked_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
  access_row public.analysis_access%rowtype;
begin
  if p_checked_at is null then
    return pg_catalog.jsonb_build_object('status', 'invalid_check');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );
  insert into public.analysis_access as access (
    user_id,
    entitlement_active,
    entitlement_expires_at,
    entitlement_seen_at,
    entitlement_checked_at,
    updated_at
  ) values (
    p_user_id,
    p_active,
    p_expires_at,
    case when p_active then p_checked_at else null end,
    p_checked_at,
    pg_catalog.now()
  )
  on conflict (user_id) do update
    set entitlement_active = excluded.entitlement_active,
        entitlement_expires_at = excluded.entitlement_expires_at,
        entitlement_seen_at = case
          when excluded.entitlement_active then excluded.entitlement_seen_at
          else access.entitlement_seen_at
        end,
        entitlement_checked_at = excluded.entitlement_checked_at,
        updated_at = excluded.updated_at
    where access.entitlement_checked_at is null
       or access.entitlement_checked_at <= excluded.entitlement_checked_at;
  get diagnostics changed = row_count;
  select *
  into access_row
  from public.analysis_access
  where user_id = p_user_id;
  return pg_catalog.jsonb_build_object(
    'status',
    case when changed = 1 then 'synced' else 'stale' end,
    'active',
    access_row.entitlement_active
      and (access_row.entitlement_expires_at is null or access_row.entitlement_expires_at > pg_catalog.now())
  );
end;
$$;

create function private.claim_revenuecat_refresh(
  p_user_id uuid,
  p_cooldown_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
  now_utc timestamptz := pg_catalog.now();
  access_row public.analysis_access%rowtype;
begin
  if p_user_id is null or p_cooldown_seconds is null or p_cooldown_seconds not between 5 and 300 then
    return pg_catalog.jsonb_build_object('status', 'invalid_refresh');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );
  insert into public.analysis_access (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  update public.analysis_access
  set entitlement_refresh_at = now_utc
  where user_id = p_user_id
    and (
      entitlement_refresh_at is null
      or entitlement_refresh_at <= now_utc - pg_catalog.make_interval(secs => p_cooldown_seconds)
    );
  get diagnostics changed = row_count;
  select * into access_row from public.analysis_access where user_id = p_user_id;
  return pg_catalog.jsonb_build_object(
    'status',
    case when changed = 1 then 'claimed' else 'rate_limited' end,
    'active',
    access_row.entitlement_active
      and (access_row.entitlement_expires_at is null or access_row.entitlement_expires_at > now_utc)
  );
end;
$$;

create function private.consume_global_analysis_quota(p_daily_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
  today_utc date := (pg_catalog.now() at time zone 'utc')::date;
begin
  if p_daily_limit is null or p_daily_limit < 1 or p_daily_limit > 1000000 then
    return pg_catalog.jsonb_build_object('status', 'invalid_limit');
  end if;
  delete from public.analysis_global_usage where usage_date < today_utc - 35;
  insert into public.analysis_global_usage as usage (usage_date, request_count, updated_at)
  values (today_utc, 1, pg_catalog.now())
  on conflict (usage_date) do update
    set request_count = usage.request_count + 1,
        updated_at = excluded.updated_at
    where usage.request_count < p_daily_limit
  returning request_count into used;
  return pg_catalog.jsonb_build_object(
    'status',
    case when used is null then 'limit_reached' else 'allowed' end
  );
end;
$$;

create function private.apply_revenuecat_entitlement_batch(
  p_event_id text,
  p_event_type text,
  p_environment text,
  p_event_timestamp_ms bigint,
  p_user_ids uuid[],
  p_active boolean[],
  p_expires_at timestamptz[],
  p_checked_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  observation_count integer;
  lock_user_id uuid;
  changed integer;
  applied_count integer := 0;
  stale_count integer := 0;
  duplicate_count integer := 0;
  ignored_count integer := 0;
begin
  observation_count := pg_catalog.cardinality(p_user_ids);

  if p_event_id is null or pg_catalog.char_length(p_event_id) not between 1 and 255
    or p_event_id <> pg_catalog.btrim(p_event_id)
    or p_event_type is null or pg_catalog.char_length(p_event_type) not between 1 and 80
    or p_event_type <> pg_catalog.btrim(p_event_type)
    or p_environment not in ('SANDBOX', 'PRODUCTION', 'UNKNOWN')
    or (p_environment = 'UNKNOWN' and p_event_type <> 'TRANSFER')
    or p_event_timestamp_ms is null or p_event_timestamp_ms <= 0
    or p_checked_at is null or not pg_catalog.isfinite(p_checked_at)
    or p_checked_at < pg_catalog.now() - interval '15 minutes'
    or p_checked_at > pg_catalog.now() + interval '5 minutes'
    or observation_count is null or observation_count not between 1 and 8
    or coalesce(pg_catalog.array_ndims(p_user_ids), 0) <> 1
    or coalesce(pg_catalog.array_ndims(p_active), 0) <> 1
    or coalesce(pg_catalog.array_ndims(p_expires_at), 0) <> 1
    or pg_catalog.cardinality(p_active) <> observation_count
    or pg_catalog.cardinality(p_expires_at) <> observation_count then
    return pg_catalog.jsonb_build_object('status', 'invalid_event');
  end if;

  if (
    select pg_catalog.count(*) <> pg_catalog.count(distinct item.user_id)
    from pg_catalog.unnest(p_user_ids) as item(user_id)
  ) then
    return pg_catalog.jsonb_build_object('status', 'invalid_event');
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(p_user_ids) with ordinality as users(user_id, position)
    join pg_catalog.unnest(p_active) with ordinality as states(active, position)
      using (position)
    join pg_catalog.unnest(p_expires_at) with ordinality as expiries(expires_at, position)
      using (position)
    where users.user_id is null
      or states.active is null
      or (
        states.active
        and (
          expiries.expires_at is null
          or not pg_catalog.isfinite(expiries.expires_at)
          or expiries.expires_at <= p_checked_at
        )
      )
      or (not states.active and expiries.expires_at is not null)
  ) then
    return pg_catalog.jsonb_build_object('status', 'invalid_event');
  end if;

  -- Serialize concurrent deliveries of the same RevenueCat event even when
  -- their alias lists differ, then take every customer lock in UUID order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id, 7311093)
  );

  -- One RPC means one PostgreSQL transaction. Acquire every per-customer lock
  -- in deterministic order so a TRANSFER and concurrent refresh cannot
  -- deadlock or leave only one side committed.
  for lock_user_id in
    select value from pg_catalog.unnest(p_user_ids) as ids(value)
    order by value
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(lock_user_id::text, 4901721)
    );
  end loop;

  if exists (
    select 1
    from public.revenuecat_webhook_events as recorded
    where recorded.event_id = p_event_id
      and (
        recorded.event_type <> p_event_type
        or recorded.environment <> p_environment
        or recorded.event_timestamp_ms <> p_event_timestamp_ms
      )
  ) then
    return pg_catalog.jsonb_build_object('status', 'event_conflict');
  end if;

  for row_index in 1..observation_count loop
    -- RevenueCat aliases can include customers already deleted locally. A
    -- signed event for such an id is acknowledged but never recreates auth or
    -- account state.
    if not exists (select 1 from auth.users where id = p_user_ids[row_index]) then
      ignored_count := ignored_count + 1;
      continue;
    end if;

    insert into public.revenuecat_webhook_events (
      event_id,
      event_type,
      environment,
      user_id,
      event_timestamp_ms
    ) values (
      p_event_id,
      p_event_type,
      p_environment,
      p_user_ids[row_index],
      p_event_timestamp_ms
    )
    on conflict (event_id, user_id) do nothing;
    get diagnostics changed = row_count;
    if changed = 0 then
      duplicate_count := duplicate_count + 1;
    end if;

    -- A duplicate webhook is still a reconciliation trigger: the REST lookup
    -- above intentionally observed current RevenueCat state. Applying a newer
    -- checkedAt lets retries converge without trusting event ordering.
    insert into public.analysis_access as access (
      user_id,
      entitlement_active,
      entitlement_expires_at,
      entitlement_seen_at,
      entitlement_checked_at,
      updated_at
    ) values (
      p_user_ids[row_index],
      p_active[row_index],
      p_expires_at[row_index],
      case when p_active[row_index] then p_checked_at else null end,
      p_checked_at,
      pg_catalog.now()
    )
    on conflict (user_id) do update
      set entitlement_active = excluded.entitlement_active,
          entitlement_expires_at = excluded.entitlement_expires_at,
          entitlement_seen_at = case
            when excluded.entitlement_active then excluded.entitlement_seen_at
            else access.entitlement_seen_at
          end,
          entitlement_checked_at = excluded.entitlement_checked_at,
          updated_at = excluded.updated_at
      where access.entitlement_checked_at is null
         or access.entitlement_checked_at <= excluded.entitlement_checked_at;
    get diagnostics changed = row_count;
    if changed = 1 then
      applied_count := applied_count + 1;
    else
      stale_count := stale_count + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'status',
    case
      when applied_count > 0 then 'applied'
      when stale_count > 0 then 'stale'
      when duplicate_count > 0 then 'duplicate'
      else 'ignored_user'
    end,
    'applied', applied_count,
    'stale', stale_count,
    'duplicates', duplicate_count,
    'ignored', ignored_count,
    'observations', observation_count
  );
end;
$$;

-- Result replay closes the response-loss/idempotency gap, but the structured
-- nutrition result is wellness data. Clear it globally after 22 hours; the
-- two-hour margin keeps the hard wall below 24 hours if an hourly run is
-- delayed. Request tombstones keep only IDs
-- and state long enough to reject a very late duplicate.
create function private.purge_analysis_ledger(retention_clock timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleared_results integer := 0;
  deleted_requests integer := 0;
  deleted_events integer := 0;
begin
  update public.analysis_requests
  set result_json = null,
      updated_at = retention_clock
  where state = 'completed'
    and completed_at < retention_clock - interval '22 hours'
    and result_json is not null;
  get diagnostics cleared_results = row_count;

  delete from public.analysis_requests
  where state in ('completed', 'refunded')
    and updated_at < retention_clock - interval '30 days';
  get diagnostics deleted_requests = row_count;

  delete from public.revenuecat_webhook_events
  where received_at < retention_clock - interval '90 days';
  get diagnostics deleted_events = row_count;

  return pg_catalog.jsonb_build_object(
    'clearedResults', cleared_results,
    'deletedRequests', deleted_requests,
    'deletedEvents', deleted_events
  );
end;
$$;

-- Private implementations are inaccessible to app users. Public wrappers are
-- invoker-rights and callable only by the service_role used inside Edge
-- Functions. None accepts values from a client without Edge validation.
revoke all on function private.reserve_analysis_access(uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke all on function private.mark_analysis_request_started(uuid, uuid) from public, anon, authenticated;
revoke all on function private.complete_analysis_request(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function private.refund_analysis_request(uuid, uuid) from public, anon, authenticated;
revoke all on function private.sync_revenuecat_entitlement(uuid, boolean, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.claim_revenuecat_refresh(uuid, integer) from public, anon, authenticated;
revoke all on function private.consume_global_analysis_quota(integer) from public, anon, authenticated;
revoke all on function private.apply_revenuecat_entitlement_batch(text, text, text, bigint, uuid[], boolean[], timestamptz[], timestamptz) from public, anon, authenticated;
revoke all on function private.purge_analysis_ledger(timestamptz) from public, anon, authenticated;

grant execute on function private.reserve_analysis_access(uuid, uuid, integer, boolean) to service_role;
grant execute on function private.mark_analysis_request_started(uuid, uuid) to service_role;
grant execute on function private.complete_analysis_request(uuid, uuid, jsonb) to service_role;
grant execute on function private.refund_analysis_request(uuid, uuid) to service_role;
grant execute on function private.sync_revenuecat_entitlement(uuid, boolean, timestamptz, timestamptz) to service_role;
grant execute on function private.claim_revenuecat_refresh(uuid, integer) to service_role;
grant execute on function private.consume_global_analysis_quota(integer) to service_role;
grant execute on function private.apply_revenuecat_entitlement_batch(text, text, text, bigint, uuid[], boolean[], timestamptz[], timestamptz) to service_role;

create function public.reserve_analysis_access(
  p_user_id uuid,
  p_request_id uuid,
  p_pro_daily_limit integer,
  p_allow_stale_grace boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reserve_analysis_access(p_user_id, p_request_id, p_pro_daily_limit, p_allow_stale_grace);
$$;

create function public.mark_analysis_request_started(p_user_id uuid, p_request_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.mark_analysis_request_started(p_user_id, p_request_id);
$$;

create function public.complete_analysis_request(p_user_id uuid, p_request_id uuid, p_result jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.complete_analysis_request(p_user_id, p_request_id, p_result);
$$;

create function public.refund_analysis_request(p_user_id uuid, p_request_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.refund_analysis_request(p_user_id, p_request_id);
$$;

create function public.sync_revenuecat_entitlement(
  p_user_id uuid,
  p_active boolean,
  p_expires_at timestamptz,
  p_checked_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.sync_revenuecat_entitlement(p_user_id, p_active, p_expires_at, p_checked_at);
$$;

create function public.claim_revenuecat_refresh(p_user_id uuid, p_cooldown_seconds integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_revenuecat_refresh(p_user_id, p_cooldown_seconds);
$$;

create function public.consume_global_analysis_quota(p_daily_limit integer)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.consume_global_analysis_quota(p_daily_limit);
$$;

create function public.apply_revenuecat_entitlement_batch(
  p_event_id text,
  p_event_type text,
  p_environment text,
  p_event_timestamp_ms bigint,
  p_user_ids uuid[],
  p_active boolean[],
  p_expires_at timestamptz[],
  p_checked_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.apply_revenuecat_entitlement_batch(
    p_event_id,
    p_event_type,
    p_environment,
    p_event_timestamp_ms,
    p_user_ids,
    p_active,
    p_expires_at,
    p_checked_at
  );
$$;

revoke all on function public.reserve_analysis_access(uuid, uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.mark_analysis_request_started(uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_analysis_request(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.refund_analysis_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.sync_revenuecat_entitlement(uuid, boolean, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_revenuecat_refresh(uuid, integer) from public, anon, authenticated;
revoke all on function public.consume_global_analysis_quota(integer) from public, anon, authenticated;
revoke all on function public.apply_revenuecat_entitlement_batch(text, text, text, bigint, uuid[], boolean[], timestamptz[], timestamptz) from public, anon, authenticated;

grant execute on function public.reserve_analysis_access(uuid, uuid, integer, boolean) to service_role;
grant execute on function public.mark_analysis_request_started(uuid, uuid) to service_role;
grant execute on function public.complete_analysis_request(uuid, uuid, jsonb) to service_role;
grant execute on function public.refund_analysis_request(uuid, uuid) to service_role;
grant execute on function public.sync_revenuecat_entitlement(uuid, boolean, timestamptz, timestamptz) to service_role;
grant execute on function public.claim_revenuecat_refresh(uuid, integer) to service_role;
grant execute on function public.consume_global_analysis_quota(integer) to service_role;
grant execute on function public.apply_revenuecat_entitlement_batch(text, text, text, bigint, uuid[], boolean[], timestamptz[], timestamptz) to service_role;

-- pg_cron is enabled by the immediately preceding waitlist-retention
-- migration. Do not repeat CREATE EXTENSION here: on hosted Supabase an
-- existing pg_cron installation can carry dependent grants, and attempting
-- to reconcile its requested schema again fails with SQLSTATE 2BP01.
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare
  existing_job bigint;
begin
  select jobid
  into existing_job
  from cron.job
  where jobname = 'kandro-analysis-ledger-retention'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'kandro-analysis-ledger-retention',
    '47 * * * *',
    'select private.purge_analysis_ledger();'
  );
end
$$;
