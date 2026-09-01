-- Per-user daily quota for the hosted analysis gateway.
--
-- The gateway spends real money on every vision call, so a public endpoint
-- needs a ceiling that cannot be raised from the client. The table is written
-- only through consume_analysis_quota(); it carries RLS with no policies and no
-- client grants, so a signed-in user can never read or edit anyone's counters,
-- including their own.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.analysis_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.analysis_usage enable row level security;

revoke all on table public.analysis_usage from anon, authenticated;

-- The privileged write lives outside the schemas exposed by the Data API. Its
-- only caller is the fixed-argument public wrapper below, so a client can never
-- choose another user or inflate the configured limit.
create function private.consume_analysis_quota()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  calling_user uuid := (select auth.uid());
  used integer;
begin
  if calling_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  insert into public.analysis_usage as usage (user_id, usage_date, request_count)
  values (calling_user, (pg_catalog.now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = usage.request_count + 1,
        updated_at = pg_catalog.now()
  returning usage.request_count into used;

  return used;
end;
$$;

revoke all on function private.consume_analysis_quota() from public, anon, authenticated;
grant execute on function private.consume_analysis_quota() to authenticated;

-- PostgREST can only call exposed schemas. This invoker-rights wrapper exposes
-- no arguments and delegates the single allowed operation to the private
-- implementation.
create function public.consume_analysis_quota()
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.consume_analysis_quota();
$$;

revoke all on function public.consume_analysis_quota() from public, anon, authenticated;
grant execute on function public.consume_analysis_quota() to authenticated;

-- Yesterday's counters carry no product value once the day rolls over.
create index analysis_usage_date_idx on public.analysis_usage (usage_date);
