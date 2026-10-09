-- OWNER ACTION, production write. Run only after the matching app build
-- (with automatic enrollment) is the one new users download.
-- New installs created after starts_at are split 50/50 into A (soft paywall,
-- 3 free analyses) and B (hard paywall, 7-day trial, no close button).
-- Paused on 2026-10-09 by migration 20261009100300_pause_paywall_access_test.sql
-- (public_enabled=false, enforcement_enabled=false). A restart needs both flags.
update private.paywall_config
   set public_enabled = true, enforcement_enabled = true, starts_at = now()
 where experiment = 'paywall_access_v1';

-- Pause new enrollments only (existing B users stay hard-walled):
-- update private.paywall_config set public_enabled = false where experiment = 'paywall_access_v1';
-- Pause the whole test (soft paywall for everyone, assignments kept):
-- update private.paywall_config set public_enabled = false, enforcement_enabled = false where experiment = 'paywall_access_v1';
-- Inspect the split:
-- select variant, reason, count(*) from private.paywall_assignments group by 1,2 order by 1,2;
