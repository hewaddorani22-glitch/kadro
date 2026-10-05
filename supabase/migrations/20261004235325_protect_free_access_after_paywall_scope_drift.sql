begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table private.paywall_config in share row exclusive mode;
lock table private.paywall_assignments in share row exclusive mode;
do $protection_guard$
begin
  if not exists(select 1 from private.paywall_config where experiment='paywall_access_v1' and not public_enabled) then
    raise exception 'pause_public_enrollment_before_free_protection';
  end if;
  if md5(pg_get_functiondef('private.enroll_paywall_access_v1(uuid,boolean,boolean,boolean,text,boolean)'::regprocedure)) <> '45bed68e77545166a62a2e076f7e4945'
    or md5(pg_get_functiondef('private.paywall_access_v1(uuid)'::regprocedure)) <> 'eef39a1b53aa4fbab36c4a895fecf8d7' then
    raise exception 'paywall_functions_changed_before_free_protection';
  end if;
end $protection_guard$;
-- This flag never changes a user's original A/B assignment, reason or date.
-- It grants the existing free scope, never a Pro entitlement or unlimited AI.
alter table private.paywall_assignments add column preserve_free_access boolean not null default false;
comment on column private.paywall_assignments.preserve_free_access is 'Sticky existing-free-access protection after an out-of-scope public assignment; original experiment denominator is retained.';
update private.paywall_assignments a set preserve_free_access=true
from auth.users u
where u.id=a.user_id and a.experiment='paywall_access_v1' and a.reason='eligible' and a.variant in ('A','B')
  and (u.is_anonymous is distinct from false or u.email_confirmed_at is null)
  and not exists(select 1 from private.paywall_qa_accounts q where q.user_id=a.user_id and q.expires_at>now());
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
  -- Preserve the original experiment assignment/denominator while keeping
  -- previously granted free access after an out-of-scope public assignment.
  -- A currently active explicit QA override remains independently testable.
  hard := v='B' and c.enforcement_enabled
    and not (coalesce(a.preserve_free_access,false)
      and not (q.user_id is not null and q.expires_at>access_clock));
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
end $function$
;
commit;
