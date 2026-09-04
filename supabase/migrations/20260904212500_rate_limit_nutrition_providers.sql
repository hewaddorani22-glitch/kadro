-- Short-lived abuse limits for free nutrition-provider routes.
--
-- Search and barcode do not consume a free analysis or a Pro allowance. They
-- can still exhaust the shared USDA/Open Food Facts capacity, so the Edge
-- Function claims one atomic per-user, source-network and global provider slot
-- before an outbound cache-miss request. No query or barcode is stored.

create schema if not exists private;
grant usage on schema private to service_role;

create table private.nutrition_provider_rate_limits (
  route text not null check (route in ('usda_search', 'usda_analysis', 'off_search', 'off_barcode', 'revenuecat')),
  subject_key text not null check (
    subject_key = 'global'
    or subject_key ~ '^user:[0-9a-f]{32}$'
    or subject_key ~ '^network:[0-9a-f]{64}$'
  ),
  window_started_at timestamptz not null,
  request_count smallint not null check (request_count between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (route, subject_key)
);

alter table private.nutrition_provider_rate_limits enable row level security;
revoke all on table private.nutrition_provider_rate_limits from public, anon, authenticated;

comment on table private.nutrition_provider_rate_limits is
  'Two-hour maximum retention for per-route abuse counters. Account and source-network values are pseudonyms; queries and barcodes are never stored.';

create index nutrition_provider_rate_limits_retention_idx
  on private.nutrition_provider_rate_limits (updated_at);

create function private.consume_nutrition_provider_quota(
  p_user_id uuid,
  p_route text,
  p_network_hash text,
  rate_clock timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_key text;
  network_key text;
  user_limit smallint;
  network_limit smallint;
  global_limit smallint;
  quota_window interval;
  subject_keys text[];
  subject_limits smallint[];
  subject_row private.nutrition_provider_rate_limits%rowtype;
  subject_active boolean;
  subject_index integer;
  retry_after integer;
begin
  if p_user_id is null
    or p_route not in ('usda_search', 'usda_analysis', 'off_search', 'off_barcode')
    or p_network_hash !~ '^[0-9a-f]{64}$'
  then
    return pg_catalog.jsonb_build_object('status', 'invalid_request');
  end if;

  -- USDA publishes 1,000 requests/hour/IP. Search and paid analysis have
  -- separate anchored windows totalling 400/hour; even the mathematical
  -- double burst across both window boundaries is 800, leaving 20% headroom.
  -- OFF publishes 10 searches and 15 product reads/minute/IP; its double-burst
  -- maxima are 8 and 14 respectively.
  if p_route = 'usda_search' then
    quota_window := interval '1 hour';
    user_limit := 20;
    network_limit := 40;
    global_limit := 100;
  elsif p_route = 'usda_analysis' then
    quota_window := interval '1 hour';
    user_limit := 60;
    network_limit := 120;
    global_limit := 300;
  elsif p_route = 'off_search' then
    quota_window := interval '1 minute';
    user_limit := 2;
    network_limit := 2;
    global_limit := 4;
  else
    quota_window := interval '1 minute';
    user_limit := 3;
    network_limit := 4;
    global_limit := 7;
  end if;
  user_key := 'user:' || pg_catalog.md5(p_user_id::text);
  network_key := 'network:' || p_network_hash;
  subject_keys := array['global', network_key, user_key];
  subject_limits := array[global_limit, network_limit, user_limit];

  -- Lock in one order for every caller, then inspect every counter before
  -- mutating either. A rejected request therefore consumes no provider slot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nutrition-provider:' || p_route || ':global', 9124401)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nutrition-provider:' || p_route || ':' || network_key, 9124401)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nutrition-provider:' || p_route || ':' || user_key, 9124401)
  );

  for subject_index in 1..pg_catalog.array_length(subject_keys, 1) loop
    select * into subject_row
    from private.nutrition_provider_rate_limits
    where route = p_route and subject_key = subject_keys[subject_index]
    for update;
    subject_active := found and subject_row.window_started_at > rate_clock - quota_window;
    if subject_active and subject_row.request_count >= subject_limits[subject_index] then
      retry_after := pg_catalog.greatest(
        1,
        pg_catalog.ceil(pg_catalog.extract(epoch from subject_row.window_started_at + quota_window - rate_clock))::integer
      );
      return pg_catalog.jsonb_build_object('status', 'rate_limited', 'retryAfter', retry_after);
    end if;
  end loop;

  for subject_index in 1..pg_catalog.array_length(subject_keys, 1) loop
    insert into private.nutrition_provider_rate_limits as limits (
      route, subject_key, window_started_at, request_count, updated_at
    ) values (
      p_route, subject_keys[subject_index], rate_clock, 1, rate_clock
    )
    on conflict (route, subject_key) do update
    set window_started_at = case
          when limits.window_started_at <= rate_clock - quota_window then rate_clock
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= rate_clock - quota_window then 1
          else limits.request_count + 1
        end,
        updated_at = rate_clock;
  end loop;

  return pg_catalog.jsonb_build_object('status', 'allowed');
end;
$$;

revoke all on function private.consume_nutrition_provider_quota(uuid, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function private.consume_nutrition_provider_quota(uuid, text, text, timestamptz)
  to service_role;

create function public.consume_nutrition_provider_quota(
  p_user_id uuid,
  p_route text,
  p_network_hash text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.consume_nutrition_provider_quota(p_user_id, p_route, p_network_hash);
$$;

revoke all on function public.consume_nutrition_provider_quota(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_nutrition_provider_quota(uuid, text, text)
  to service_role;

-- RevenueCat's Customer Information endpoint is shared by public entitlement
-- refreshes, stale-access checks and signed webhook reconciliation. A public
-- refresh therefore claims user + source-network + project-wide slots, while
-- a verified webhook claims the same project-wide circuit breaker only.
create function private.consume_revenuecat_provider_quota(
  p_user_id uuid default null,
  p_network_hash text default null,
  p_request_units smallint default 1,
  rate_clock timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_key text;
  network_key text;
  subject_keys text[] := array['global'];
  subject_limits smallint[] := array[200::smallint];
  subject_row private.nutrition_provider_rate_limits%rowtype;
  subject_active boolean;
  subject_index integer;
  retry_after integer;
  quota_window constant interval := interval '1 minute';
begin
  if (p_user_id is null) <> (p_network_hash is null)
    or (p_network_hash is not null and p_network_hash !~ '^[0-9a-f]{64}$')
    or p_request_units not between 1 and 8
  then
    return pg_catalog.jsonb_build_object('status', 'invalid_request');
  end if;

  if p_user_id is not null then
    user_key := 'user:' || pg_catalog.md5(p_user_id::text);
    network_key := 'network:' || p_network_hash;
    subject_keys := subject_keys || array[network_key, user_key];
    subject_limits := subject_limits || array[10::smallint, 3::smallint];
  end if;

  -- RevenueCat publishes 480 Customer Information requests/minute/project.
  -- The anchored 200/minute project window has a mathematical boundary burst
  -- of 400, preserving 80 requests/minute of headroom for provider variance.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('nutrition-provider:revenuecat:global', 9124401)
  );
  if network_key is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('nutrition-provider:revenuecat:' || network_key, 9124401)
    );
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('nutrition-provider:revenuecat:' || user_key, 9124401)
    );
  end if;

  for subject_index in 1..pg_catalog.array_length(subject_keys, 1) loop
    select * into subject_row
    from private.nutrition_provider_rate_limits
    where route = 'revenuecat' and subject_key = subject_keys[subject_index]
    for update;
    subject_active := found and subject_row.window_started_at > rate_clock - quota_window;
    if subject_active and subject_row.request_count + p_request_units > subject_limits[subject_index] then
      retry_after := pg_catalog.greatest(
        1,
        pg_catalog.ceil(pg_catalog.extract(epoch from subject_row.window_started_at + quota_window - rate_clock))::integer
      );
      return pg_catalog.jsonb_build_object('status', 'rate_limited', 'retryAfter', retry_after);
    end if;
  end loop;

  for subject_index in 1..pg_catalog.array_length(subject_keys, 1) loop
    insert into private.nutrition_provider_rate_limits as limits (
      route, subject_key, window_started_at, request_count, updated_at
    ) values (
      'revenuecat', subject_keys[subject_index], rate_clock, p_request_units, rate_clock
    )
    on conflict (route, subject_key) do update
    set window_started_at = case
          when limits.window_started_at <= rate_clock - quota_window then rate_clock
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= rate_clock - quota_window then p_request_units
          else limits.request_count + p_request_units
        end,
        updated_at = rate_clock;
  end loop;

  return pg_catalog.jsonb_build_object('status', 'allowed');
end;
$$;

revoke all on function private.consume_revenuecat_provider_quota(uuid, text, smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function private.consume_revenuecat_provider_quota(uuid, text, smallint, timestamptz)
  to service_role;

create function public.consume_revenuecat_provider_quota(
  p_user_id uuid,
  p_network_hash text,
  p_request_units smallint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.consume_revenuecat_provider_quota(p_user_id, p_network_hash, p_request_units);
$$;

revoke all on function public.consume_revenuecat_provider_quota(uuid, text, smallint)
  from public, anon, authenticated;
grant execute on function public.consume_revenuecat_provider_quota(uuid, text, smallint)
  to service_role;

create function private.purge_nutrition_provider_rate_limits(
  retention_clock timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_rows integer;
begin
  delete from private.nutrition_provider_rate_limits
  -- This job runs hourly. A one-hour deletion threshold therefore keeps every
  -- pseudonymous counter for less than the disclosed two-hour maximum.
  where updated_at < retention_clock - interval '1 hour';
  get diagnostics deleted_rows = row_count;
  return deleted_rows;
end;
$$;

revoke all on function private.purge_nutrition_provider_rate_limits(timestamptz)
  from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'kandro-nutrition-provider-rate-limit-retention'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'kandro-nutrition-provider-rate-limit-retention',
    '17 * * * *',
    'select private.purge_nutrition_provider_rate_limits();'
  );
end;
$$;
