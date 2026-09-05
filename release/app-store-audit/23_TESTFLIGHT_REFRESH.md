# TestFlight refresh, 2026-09-05

## Scope and decision

The owner requested another verification pass across app, landing page and release configuration, followed by a new TestFlight build. App Review submission remains prohibited. This is an internal TestFlight candidate, not a declaration that all native hardware tests or legal gates have passed.

The route/interaction coverage and previous fixes are recorded in `22_FULL_APP_QA.md`. This follow-up checks the current complete validation gate, production wiring, public website and live backend boundary before packaging the candidate.

## Additional corrections

- Waitlist status and submission now have bounded timeouts. A failed status check reveals the form with an honest localized error instead of hiding it forever. The server remains authoritative about accepting addresses. A failed or stalled submission releases the button for another attempt.
- Executable browser-script regression cases cover EN/DE success, closure, rejection and timeouts without sending real mail.
- Both landing pages now describe the guest account, 14–15 guardian confirmation, under-18 target limitations, temporary failed-photo retention and at-home recipe scope accurately.

## Evidence before build

- `npm install` and full `npm run verify` passed. Final log: `/tmp/kandro-build10-final-verify.log`.
- Remote EAS environment validation and production release checks passed: hosted Supabase, iOS RevenueCat, EU PostHog and legal configuration.
- Linked Supabase migration dry-run: up to date. SQL lint: no schema errors.
- Live disposable-account deletion: profile cascade and refresh-token revocation passed.
- Separate disposable account: search rejected before consent and after withdrawal (403). Search with current consent returned 200 and sensible leading results for Banane, Haferflocken and pancakes.
- Live description `200 g Rindergulasch mit 100 g Apfelmus` returned 200, the matching title and two editable ingredients, without image warnings. Its 327 kcal is a database-backed estimate, not independent proof of recipe accuracy.
- All disposable accounts created by these tests were deleted.
- Mobile EN/DE landing pages: 375 px viewport and scroll width both 375; accepting waitlist forms visible/enabled. Rendered image proportions match the originals. Selected hero and story screenshots inspected in `output/playwright/build10-site-*.png`.
- App Store Connect before refresh: Build 9 VALID / internal IN_BETA_TESTING, version 1.0.0 PREPARE_FOR_SUBMISSION, EN/DE metadata present.

## Still requires the exact iPhone build

StoreKit purchase/restore/entitlement refresh, camera/flash/barcode, native keyboard and decimal edits, accessibility, first-launch/guardian email delivery, native deletion cleanup and real-food accuracy remain device/operational tests. Browser previews and automated checks do not replace them. DSA status is not freshly verified by this pass.

Build and Apple-processing results will be appended after the candidate is uploaded. No public-release approval is implied by a successful TestFlight upload.

## Follow-up findings: Build 11 supersedes Build 10

Build 10 from `8b6ba79` reached VALID / IN_BETA_TESTING. Further browser QA found two defects, so it is not the final candidate:

- Decimal portions were accepted locally but `meal_items.amount_g` and `base_amount_g` were integers. Saving 40.3 g produced a cloud 400. Migration `20260905141007_preserve_decimal_meal_grams.sql` is deployed, preserving one decimal with existing range constraints and RLS. `node scripts/validate-cloud-portions-live.mjs` passed real insert/read-back of 40.3/110.3, integer compatibility and rejection of out-of-range values, then deleted its disposable account.
- A cold `/result` route could mount the save effect with initial demo state. The parent route guard now blocks confirm/result until analysis is ready, and the persistence boundary independently rejects missing drafts. Browser reproduction after correction: meal count remained 3 before and after a cold result navigation, which redirected to scan. A deliberately selected demo still reached confirm and result normally.

Full `npm run verify` passed after both corrections (`/tmp/kandro-build11-verify.log`). First-launch adult onboarding and explicit consent were exercised through the browser against the live backend, as were search, decimal correction and confirmation. This remains web runtime evidence, not native hardware evidence.

Supabase security advisors returned warnings, not an all-clear: anonymous-user policies require interpretation because guest users are intentionally authenticated, and leaked-password protection / MFA options remain hardening items. Do not convert this into a claim of zero security warnings.

The cron-table advisor findings were checked against live privileges: both `anon` and `authenticated` lack USAGE on the cron schema. Table SELECT grants alone therefore do not provide access through those roles.
