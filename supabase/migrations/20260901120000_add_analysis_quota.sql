-- Per-user daily quota for the hosted analysis gateway.
--
-- The gateway spends real money on every vision call, so a public endpoint
-- needs a ceiling that cannot be raised from the client. The table is written
-- only through consume_analysis_quota(); it carries RLS with no policies and no
-- client grants, so a signed-in user can never read or edit anyone's counters,
-- including their own.

create table public.analysis_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.analysis_usage enable row level security;

revoke all on table public.analysis_usage from anon, authenticated;

-- Counts one request for the calling user and returns the running total for
-- today. The caller decides what the limit is, so the limit itself is never
-- something the client can pass in and inflate.
create function public.consume_analysis_quota()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  calling_user uuid := auth.uid();
  used integer;
begin
  if calling_user is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  insert into public.analysis_usage as usage (user_id, usage_date, request_count)
  values (calling_user, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = usage.request_count + 1,
        updated_at = now()
  returning usage.request_count into used;

  return used;
end;
$$;

revoke all on function public.consume_analysis_quota() from public, anon;
grant execute on function public.consume_analysis_quota() to authenticated;

-- Yesterday's counters carry no product value once the day rolls over.
create index analysis_usage_date_idx on public.analysis_usage (usage_date);
