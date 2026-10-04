begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- QA provenance remains QA after its temporary access override expires. Only
-- source/environment change; variant, enforcement and purchase priority still
-- use the original resolver rules. No assignment or entitlement is mutated.
create or replace function private.paywall_access_v1(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c private.paywall_config%rowtype; a private.paywall_assignments%rowtype;
  q private.paywall_qa_accounts%rowtype; e public.analysis_access%rowtype;
  v text; hard boolean; state text; valid_until timestamptz; access_clock timestamptz := now();
begin
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'cloud_identity_changed'; end if;
  select * into c from private.paywall_config where experiment='paywall_access_v1';
  if not found then raise exception 'access_configuration_unavailable'; end if;
  select * into a from private.paywall_assignments where user_id=p_user_id;
  select * into q from private.paywall_qa_accounts where user_id=p_user_id;
  v := coalesce(case when q.expires_at>access_clock then q.variant else null end,a.variant,'unassigned');
  hard := v='B' and c.enforcement_enabled;
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
    'reason',coalesce(a.reason,'configuration'),'enrollmentOpen',c.public_enabled);
end $$;
revoke all on function private.paywall_access_v1(uuid) from public,anon,authenticated;
grant execute on function private.paywall_access_v1(uuid) to service_role;

commit;
