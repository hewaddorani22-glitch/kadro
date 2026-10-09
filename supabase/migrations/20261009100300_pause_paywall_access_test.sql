begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table private.paywall_config in share row exclusive mode;

-- Owner decision 2026-10-09: the paywall_access_v1 A/B test is paused. With
-- about ten enrolled users the result cannot be interpreted, and the hard
-- wall cost activation. Everyone gets the soft paywall / free scope again.
--
-- public_enabled=false alone only stops new enrollment: paywall_access_v1()
-- computes hard := variant = 'B' and enforcement_enabled, so already assigned
-- B users would stay hard-walled. Turning enforcement off makes hard=false for
-- every user, which the gateway, meal guard, meal permits and app all honor
-- (reserve_analysis_access, guard_new_paywall_meal, authorize_meal_create_v1,
-- accessPolicy.resolveAccess). Assignments, reasons and dates stay untouched
-- for later analysis; no function body changes, so existing md5 guards hold.
-- An active Pro entitlement is still reported as active, never downgraded.
do $pause_guard$
begin
  if not exists(select 1 from private.paywall_config where experiment = 'paywall_access_v1') then
    raise exception 'paywall_config_missing';
  end if;
  if position('c.enforcement_enabled' in pg_get_functiondef('private.paywall_access_v1(uuid)'::regprocedure)) = 0 then
    raise exception 'paywall_access_v1_ignores_enforcement_flag';
  end if;
end $pause_guard$;

update private.paywall_config
set public_enabled = false,
    enforcement_enabled = false
where experiment = 'paywall_access_v1';

comment on table private.paywall_config is
  'paywall_access_v1 paused 2026-10-09 (public_enabled=false, enforcement_enabled=false): soft paywall for all users. Re-enable only by explicit owner decision.';

commit;
