begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Why an AI analysis returned its reservation. 57% of analyses end refunded;
-- without a reason the failed and the correction-required paths look alike.
-- Only fixed gateway codes are stored: never provider text, prompts or input.
alter table public.analysis_requests
  add column failure_code text
    check (failure_code is null or failure_code ~ '^[a-z][a-z0-9_]{0,63}$');
comment on column public.analysis_requests.failure_code is
  'Fixed gateway code recorded with a refund (e.g. provider_timeout, correction_required). Null unless state = refunded.';

-- A refunded request id can be reserved again by the same client retry. The
-- reason belongs only to the refunded state and is cleared on any other one,
-- so reserve/start/complete keep their existing, md5-unguarded bodies.
create function private.clear_analysis_failure_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.state <> 'refunded' then new.failure_code := null; end if;
  return new;
end $$;
revoke all on function private.clear_analysis_failure_code() from public, anon, authenticated;
create trigger clear_analysis_failure_code
  before update on public.analysis_requests
  for each row when (new.state <> 'refunded' and new.failure_code is not null)
  execute function private.clear_analysis_failure_code();

-- New three-argument overload. The two-argument contract stays callable for
-- older gateway versions and keeps its signature, grants and result shape.
create function private.refund_analysis_request(
  p_user_id uuid,
  p_request_id uuid,
  p_failure_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
  code text := case when p_failure_code ~ '^[a-z][a-z0-9_]{0,63}$' then p_failure_code else 'unknown' end;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 4901721)
  );
  update public.analysis_requests
  set state = 'refunded',
      refunded_at = pg_catalog.now(),
      result_json = null,
      failure_code = code,
      updated_at = pg_catalog.now()
  where user_id = p_user_id
    and request_id = p_request_id
    and state in ('reserved', 'started');
  get diagnostics changed = row_count;
  return pg_catalog.jsonb_build_object('status', case when changed = 1 then 'refunded' else 'unchanged' end);
end;
$$;

create or replace function private.refund_analysis_request(
  p_user_id uuid,
  p_request_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.refund_analysis_request(p_user_id, p_request_id, 'unspecified');
$$;

create function public.refund_analysis_request(p_user_id uuid, p_request_id uuid, p_failure_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.refund_analysis_request(p_user_id, p_request_id, p_failure_code);
$$;

revoke all on function private.refund_analysis_request(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.refund_analysis_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refund_analysis_request(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.refund_analysis_request(uuid, uuid, text) to service_role;
grant execute on function private.refund_analysis_request(uuid, uuid) to service_role;
grant execute on function public.refund_analysis_request(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
commit;
