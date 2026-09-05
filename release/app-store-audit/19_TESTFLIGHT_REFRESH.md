# Current TestFlight candidate audit, 2026-09-05

## Decision

Ready to build a replacement TestFlight candidate, not approved for App Review.
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
