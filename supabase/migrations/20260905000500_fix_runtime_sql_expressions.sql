-- Correct special SQL expressions that PostgreSQL does not expose as
-- schema-qualified functions. The original migrations are fixed for clean
-- installs; this migration repairs databases that already applied them.

do $$
declare
  target regprocedure;
  definition text;
begin
  foreach target in array array[
    'private.mark_analysis_request_started(uuid,uuid)'::regprocedure,
    'private.apply_revenuecat_entitlement_batch(text,text,text,bigint,uuid[],boolean[],timestamp with time zone[],timestamp with time zone)'::regprocedure,
    'private.consume_nutrition_provider_quota(uuid,text,text,timestamp with time zone)'::regprocedure,
    'private.consume_revenuecat_provider_quota(uuid,text,smallint,timestamp with time zone)'::regprocedure
  ]
  loop
    select pg_catalog.pg_get_functiondef(target) into definition;
    definition := replace(definition, 'pg_catalog.coalesce(', 'coalesce(');
    definition := replace(definition, 'pg_catalog.greatest(', 'greatest(');
    execute definition;
  end loop;
end;
$$;

-- CREATE OR REPLACE keeps the existing ACL, but restate the intended grants
-- so a future ownership/default-privilege change cannot widen access.
revoke all on function private.mark_analysis_request_started(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.apply_revenuecat_entitlement_batch(text, text, text, bigint, uuid[], boolean[], timestamptz[], timestamptz)
  from public, anon, authenticated;
revoke all on function private.consume_nutrition_provider_quota(uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function private.consume_revenuecat_provider_quota(uuid, text, smallint, timestamptz)
  from public, anon, authenticated;

grant execute on function private.mark_analysis_request_started(uuid, uuid) to service_role;
grant execute on function private.apply_revenuecat_entitlement_batch(text, text, text, bigint, uuid[], boolean[], timestamptz[], timestamptz) to service_role;
grant execute on function private.consume_nutrition_provider_quota(uuid, text, text, timestamptz) to service_role;
grant execute on function private.consume_revenuecat_provider_quota(uuid, text, smallint, timestamptz) to service_role;

notify pgrst, 'reload schema';
