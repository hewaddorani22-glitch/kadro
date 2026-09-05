# App QA and review gate, 2026-09-05

## Decision

**CONDITIONAL_NO_GO for submission.** Local verification passes, but this is not a native device certification or a guarantee of Apple approval. No App Review submission or new TestFlight build was initiated in this pass. Current App Store Connect evidence shows Build 9 VALID / internal IN_BETA_TESTING and version 1.0.0 PREPARE_FOR_SUBMISSION. Build 9 does not contain the fixes below.

Code inspected and verified: `f69e81e` on `audit/app-store-release-gate-20260904`. Another concurrent worker committed both this pass's changes and its search changes in that commit.

## Corrections in this pass

1. Removed the nutrition goal from the optional `plan edited` analytics event. Scrubbing also removes `goal` from legacy queued properties. The event now only records completion.
2. Free-trial advertising now requires confirmed iOS introductory-offer eligibility. Unknown eligibility and eligibility lookup failures display regular pricing, not a promised free trial.
3. Added a local-day hook with foreground refresh and a 30-second check. Today and progress recompute after midnight without requiring an app restart. Meal history filtering is synchronous to avoid an asynchronous reload overwriting a newly saved meal.
4. Fixed the consent pause icon's dark-theme color pairing.
5. Added explicit inch/pound units to onboarding stepper accessibility labels.
6. Fixed demo ingredient names being captured before the selected language loaded. Demo items now resolve their names using the current dictionary when requested.
7. Enabled CI push triggers for `audit/**`, not just main. This is configuration coverage, not evidence of a completed remote CI run.
8. Corrected review notes: the app has a logging streak. It is not a reward for a calorie deficit.

## Browser UX coverage

Tests used an isolated local browser fixture, disconnected from the owner's cloud account. No owner data was deleted and no real purchase was made.

| Area | Evidence and limits |
| --- | --- |
| Onboarding | Traversed the 11-step flow, explicit Next behavior, age gate, units, activity and vegan preference. Consent dialog and its recoverable error were observed. Successful first-launch cloud consent was not proven because this fixture deliberately disables cloud access. |
| Today and Plan | Navigation, context selection, meal suggestions and recipe opened. Saved meal totals reconciled after animations settled: 2,410 target minus 595 logged = 1,815 remaining. |
| Scan, confirmation, result | Browser permission/empty state and demo flow exercised. Decimal gram correction of 110.3 g persisted through confirmation/result. Correct German demo ingredient names verified after the fix. Physical camera and barcode recognition are not covered. |
| Progress | Logged meal retained after reload, logging streak and protein summary rendered. A 78.3 kg fixture weight entry saved and appeared in the profile. |
| Profile | Language and theme changes exercised. English dark-mode layout inspected at 320 px width. |
| Paywall | Narrow dark-mode presentation inspected; native offerings, purchase, restore and trial eligibility still require StoreKit testing. |
| Day summary | Narrow dark-mode presentation inspected. A previously saved German meal name remains German after changing UI language; historical meal data is not automatically translated. |
| Consent and account deletion | Screens and safeguards inspected. Actual withdrawal/deletion and native local-data cleanup were not performed on the owner's account. |
| Privacy, terms, sources | Routes opened and narrow-layout screenshots inspected. This is not a jurisdiction-by-jurisdiction legal opinion. |

Screenshots: `output/playwright/qa-*-en-dark.png`, plus `qa-recipe-de.png`. These demonstrate selected rendered states, not every scroll position, keyboard state or accessibility configuration.

## Automated and operational evidence

- `npm install` completed.
- Final `npm run verify` completed successfully, including Expo Doctor (18/18), regression validators and web export. Log: `/tmp/kandro-qa-final2-verify.log`.
- New executable checks cover the day-change hook, offer mapping and language-dependent demo items. Privacy checks pin the analytics boundary.
- An intermediate verification failure occurred while concurrent search code and its validator were changing. The final complete run passed after those changes stabilized.
- `git diff --check` passed.
- Supabase linked migration dry-run reported no pending migrations; linked SQL lint reported no schema errors. These were read-only checks, not a new deployment.
- Public EN/DE home, privacy, terms and support URLs returned HTTP 200 after their expected redirects.

## Remaining release gates

1. Build the corrected candidate, then test that exact binary on a real iPhone. Xcode Simulator was unavailable on this machine; browser checks do not substitute for it.
2. Complete purchase / restore / reinstall / cancellation and entitlement-refresh checks in Apple Sandbox. Confirm no trial is advertised to an ineligible account.
3. Test camera close, permission denial/recovery, flash/barcode, decimal keyboard dismissal, fractional lb-to-kg stepping, rapid touches, VoiceOver and largest Dynamic Type natively.
4. Complete successful first-launch consent, withdrawal, account deletion and local cleanup on a disposable cloud test account.
5. Recheck DSA status in App Store Connect. The account UI tool was unavailable, so historical `In Review` is not fresh evidence. DSA compliance concerns EU distribution; it should not be described as a blanket prohibition on all TestFlight or all App Review.
6. Review the exact binary against metadata, privacy declarations, first subscriptions and reviewer instructions. Nutrition accuracy still needs measured real-meal evaluation; plausible examples do not prove universal accuracy.
7. International use by minors needs particular care. Existing age/guardian gating and wellness positioning are not a guarantee of compliance in every country.

Owner approval remains required before Add for Review and separately before Submit for Review.

## Official references

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): completeness, accurate metadata, purchases, privacy and explicit third-party AI data-sharing permission.
- [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- [EU DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/).
- [RevenueCat subscription offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers).
