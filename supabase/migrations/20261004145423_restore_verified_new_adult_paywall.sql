begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Pause enrollment separately first. Drain enrollment transactions before
-- verifying that the inadvertently widened period created no public cohort.
lock table private.paywall_config in share row exclusive mode;
lock table private.paywall_assignments in access exclusive mode;
do $restore_guard$
begin
  if not exists(select 1 from private.paywall_config where experiment='paywall_access_v1' and not public_enabled) then
    raise exception 'pause_public_enrollment_before_restore';
  end if;
  if exists(select 1 from private.paywall_assignments a
    where a.experiment='paywall_access_v1' and a.variant in ('A','B')
      and not exists(select 1 from private.paywall_qa_accounts q where q.user_id=a.user_id and q.expires_at>now())) then
    raise exception 'public_cohort_requires_explicit_preservation_review';
  end if;
end $restore_guard$;
-- Restore the authorized conservative eligibility contract. Existing excluded
-- assignments and explicit QA cohorts remain unchanged; purchases retain priority.
create or replace function private.enroll_paywall_access_v1(p_user_id uuid,p_first_use boolean,p_age_confirmed boolean,p_trial_eligible boolean,p_product text,p_seven_days boolean)
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

commit;
