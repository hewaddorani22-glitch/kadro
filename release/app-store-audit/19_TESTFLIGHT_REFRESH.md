# Current TestFlight candidate audit, 2026-09-05

## Decision

Replacement TestFlight candidate built successfully, not approved for App Review.
Historical 90/100 and Build 8 sign-off are not current candidate evidence.

## Checks performed

- Full production preflight passed: regression suite, TypeScript, Expo Doctor
  18/18, web export, remote EAS production wiring and production release checks.
- Supabase migration dry-run reports upToDate; no database mutation performed.
- Production uses the hosted analysis gateway, the iOS RevenueCat public SDK
  key and EU PostHog configuration. No laptop endpoint or private keys bundled.
- Focused source review covered account linking/deletion, telemetry consent,
  paywall disclosure, scanner lifecycle, correction arithmetic, adolescent
  targets, empty meals and completed-day recommendations. This is not a claim
  of exhaustive runtime coverage of every line or platform.
- The owner-reported and follow-up defects are documented in 18_BUILD8_FEEDBACK.

## Apple guidelines mapped to remaining evidence

- 2.1 completeness: exact new binary must be installed and exercised on iPhone.
- 2.3 metadata: existing localized listing/screenshots validators pass; final
  App Store Connect visual comparison is not freshly verified.
- 3.1.1/3.1.2: native IAP, restore and renewal disclosures are present; actual
  Apple sandbox purchase/restore remains a physical-device gate.
- 1.4 / 5.1: wellness estimates, correction, consent, deletion, minors and
  analytics boundaries are implemented; no clinical accuracy guarantee.
- 4 design: browser layout/interaction regressions are checked; native camera,
  VoiceOver, Dynamic Type and keyboard behavior are not fully established.

## DSA: correction and live access limitation

Apple's DSA requirement concerns verified trader details for EU distribution.
It must not be described as a universal App Review or TestFlight prohibition.
The current account status is UNKNOWN: computer-use service failed to start on
two attempts. Prior "In Review" evidence is historical, not a fresh reading.
No trader setting, declaration or legal submission was changed.

Sources consulted 2026-09-05:
- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
- https://developer.apple.com/news/?id=6agg0lja

## Native tooling

Full Xcode/iOS simulator is absent. EAS remote build is available and the latest
completed candidate before this run is 1.0.0 (8), source 9a95530. A new build and
upload do not constitute an App Review submission. Final App Review remains
explicitly unauthorized.

## Replacement candidate evidence

- Version 1.0.0 (9), source commit `bbe4bb835ca8d406c786279a63afd22181a60d59`.
- EAS build `5f6ed099-8360-4c1d-85f3-1677640e938d`: FINISHED.
- TestFlight upload `bda54533-58de-48e0-89e3-4c88ea652865`: FINISHED, no error.
- Apple confirms Build 9 exists, ID `b5bdc836-8412-4b19-9df5-aecebec94b32`,
  processingState VALID, internalBuildState IN_BETA_TESTING, autoNotifyEnabled
  true. External state is READY_FOR_BETA_SUBMISSION; no external beta review or
  public App Review was submitted. Verified via Apple API on 2026-09-05.
- iOS JavaScript export passed; this is not a local native/simulator test.
- Apple API confirms version 1.0.0 remains PREPARE_FOR_SUBMISSION. Both de-DE
  and en-US descriptions, keywords and localized support/marketing URLs exist.
- Apple TestFlight crash and feedback queries returned zero records. This does
  not exclude usability defects or unreported crashes.
- Eight public EN/DE landing, privacy, terms and support URLs returned HTTP 200.
- npm production audit: 26 transitive findings (17 moderate, 9 high, 0 critical).
  No untested force/major SDK upgrade performed. Findings remain a release risk
  to assess, not a clean dependency bill of health.

## Exact Build 9 owner test

1. Open camera from each meal entry, close using X, repeat and close during a
   capture; no frozen overlay or late navigation should occur.
2. Search pancakes, add a result, edit 110.3 / 110,3 grams, cancel/save/reopen,
   then change recognized piece count. Initial recognition remains an estimate.
3. Check light default on a fresh install and persisted dark preference;
   keyboard, large text, VoiceOver and small-screen controls remain usable.
4. Record/delete meals, restart and verify daily totals/history; exercise
   account confirmation, sync and deletion without losing control of navigation.
5. Complete sandbox purchase, restore and free/Pro boundary tests. Simulator
   or web checks do not replace these native tests.

App Review remains NO_GO until the exact candidate passes these gates and the
remaining operational/listing evidence is checked. No review was submitted.
