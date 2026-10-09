begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Aggregate growth funnel from data the backend already holds, so product
-- decisions do not depend on opt-in client analytics. Counts only: no user
-- ids, ages, meals or free text leave these views. Owner-rights views in the
-- unexposed private schema; readable by service_role / the SQL editor only.
-- See docs/GROWTH_FUNNEL.md for the exact definitions and retention limits.
create view private.growth_funnel_daily as
with cohort as (
  select u.id, u.created_at, (u.created_at at time zone 'Europe/Berlin')::date as signup_day
  from auth.users u
), facts as (
  select c.signup_day,
    p.user_id is not null as with_profile,
    p.age,
    -- analysis_requests rows are purged 30 days after completion/refund;
    -- the lifetime free ledger keeps older successes visible.
    coalesce(a.free_completed, 0) > 0
      or exists(select 1 from public.analysis_requests r where r.user_id = c.id and r.state = 'completed') as ai_success,
    coalesce(a.free_completed, 0) > 0
      or exists(select 1 from public.analysis_requests r where r.user_id = c.id) as tried_ai,
    exists(select 1 from public.meals m where m.user_id = c.id) as saved_meal,
    exists(select 1 from public.meals m where m.user_id = c.id
      and m.saved_at < c.created_at + interval '24 hours') as meal_within_24h,
    exists(select 1 from public.meals m where m.user_id = c.id
      and (m.saved_at at time zone 'Europe/Berlin')::date >= c.signup_day + 1) as meal_day1_plus,
    exists(select 1 from public.meals m where m.user_id = c.id
      and (m.saved_at at time zone 'Europe/Berlin')::date >= c.signup_day + 7) as meal_day7_plus,
    exists(select 1 from private.paywall_exposures e where e.user_id = c.id) as paywall_shown,
    -- RevenueCat app_user_id is the Supabase user id (Purchases.logIn(user.id)),
    -- so webhook rows map 1:1. INITIAL_PURCHASE covers both a trial start and a
    -- direct first purchase; period_type is not stored, so they are not split.
    -- SANDBOX (TestFlight/App Review) is excluded. Rows are purged after 90 days.
    exists(select 1 from public.revenuecat_webhook_events w where w.user_id = c.id
      and w.event_type = 'INITIAL_PURCHASE' and w.environment = 'PRODUCTION') as trial_or_purchase
  from cohort c
  left join public.profiles p on p.user_id = c.id
  left join public.analysis_access a on a.user_id = c.id
)
select signup_day,
  count(*)::integer as new_users,
  count(*) filter (where age >= 18)::integer as adults,
  count(*) filter (where age < 18)::integer as minors,
  count(*) filter (where with_profile)::integer as with_profile,
  count(*) filter (where tried_ai)::integer as tried_ai,
  count(*) filter (where ai_success)::integer as ai_success,
  count(*) filter (where saved_meal)::integer as saved_meal,
  count(*) filter (where meal_within_24h)::integer as meal_within_24h,
  count(*) filter (where meal_day1_plus)::integer as meal_day1_plus,
  count(*) filter (where meal_day7_plus)::integer as meal_day7_plus,
  count(*) filter (where paywall_shown)::integer as paywall_shown,
  count(*) filter (where trial_or_purchase)::integer as trial_or_purchase
from facts
group by signup_day;

comment on view private.growth_funnel_daily is
  'Signup-day (Europe/Berlin) funnel counts. Service-role/SQL editor only. See docs/GROWTH_FUNNEL.md.';

-- Refund reasons per Berlin day. Rows refunded before 2026-10-09 (or by an
-- older gateway) have no code and appear as unrecorded / unspecified.
create view private.ai_failure_daily as
select (r.refunded_at at time zone 'Europe/Berlin')::date as day,
  coalesce(r.failure_code, 'unrecorded') as failure_code,
  count(*)::integer as count
from public.analysis_requests r
where r.state = 'refunded' and r.refunded_at is not null
group by 1, 2;

comment on view private.ai_failure_daily is
  'Refunded AI analyses per Europe/Berlin day and gateway failure code. Ledger rows are purged after 30 days.';

revoke all on private.growth_funnel_daily, private.ai_failure_daily from public, anon, authenticated;
grant select on private.growth_funnel_daily, private.ai_failure_daily to service_role;

commit;
