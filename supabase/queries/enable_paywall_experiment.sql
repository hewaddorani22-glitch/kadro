-- OWNER ACTION, production write. Run only after the matching app build
-- (with automatic enrollment) is the one new users download.
-- New installs created after starts_at are split 50/50 into A (soft paywall,
-- 3 free analyses) and B (hard paywall, 7-day trial, no close button).
update private.paywall_config
   set public_enabled = true, starts_at = now()
 where experiment = 'paywall_access_v1';

-- Pause new enrollments (existing A/B assignments stay as they are):
-- update private.paywall_config set public_enabled = false where experiment = 'paywall_access_v1';
-- Inspect the split:
-- select variant, reason, count(*) from private.paywall_assignments group by 1,2 order by 1,2;
