begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table private.paywall_config in share row exclusive mode;
lock table private.paywall_assignments in share row exclusive mode;
-- Owner explicitly confirms the earlier Claude design on 5 October 2026:
-- eligible new adults may be anonymous; no required account linking.
-- This restores the saved pre-intervention functions, not a new experiment.
do $owner_restore_guard$
begin
 if md5(pg_get_functiondef('private.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean)'::regprocedure)) <> '45bed68e77545166a62a2e076f7e4945'
  or md5(pg_get_functiondef('private.paywall_access_v1(uuid)'::regprocedure)) <> '1730ebca4289060a22ee35cd893845e9' then
  raise exception 'unexpected_paywall_functions_before_owner_restore';
 end if;
end $owner_restore_guard$;
CREATE OR REPLACE FUNCTION private.enroll_paywall_access_v1(p_user_id uuid, p_first_use boolean, p_age_confirmed boolean, p_trial_eligible boolean, p_product text, p_seven_days boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    when p_first_use is distinct from true then 'prior_use'
    when e.entitlement_checked_at is null or e.entitlement_checked_at<now()-interval '24 hours' then 'offer'
    when e.entitlement_active and (e.entitlement_expires_at is null or e.entitlement_expires_at>now()) then 'pro'
    when p_trial_eligible is distinct from true or p_seven_days is distinct from true or p_product is distinct from c.monthly_product then 'offer'
    else 'eligible' end;
  chosen := case when why='eligible' then case when get_byte(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()),0)<128 then 'A' else 'B' end else 'excluded' end;
  insert into private.paywall_assignments(user_id,variant,reason) values(p_user_id,chosen,why);
  return private.paywall_access_v1(p_user_id);
end $function$;
CREATE OR REPLACE FUNCTION private.paywall_access_v1(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$;
-- Remove only the extra temporary access exception introduced by the agent.
-- Keep original assignment, reason, timestamp, purchase state and QA overrides.
update private.paywall_assignments set preserve_free_access=false
where experiment='paywall_access_v1' and preserve_free_access;
comment on column private.paywall_assignments.preserve_free_access is 'Historical compatibility column; unused by owner-restored paywall_access_v1 as of 2026-10-05.';
-- Keep the existing experiment start, product and enforcement configuration.
update private.paywall_config set public_enabled=true where experiment='paywall_access_v1';
revoke all on function private.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean) from public,anon,authenticated;
grant execute on function private.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean) to service_role;
revoke all on function private.paywall_access_v1(uuid) from public,anon,authenticated;
grant execute on function private.paywall_access_v1(uuid) to service_role;
commit;
