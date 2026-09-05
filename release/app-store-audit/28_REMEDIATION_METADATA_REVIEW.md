# Review remediation and live metadata check, 2026-09-05

## Decision: CONDITIONAL_NO_GO, 85/100

This is an evidence-weighted readiness assessment, not an Apple score or an
85% chance of acceptance. The historic 90/100 score does not certify this
candidate. Hard gates override the numerical score.

| Area | Score | Evidence and limitation |
| --- | ---: | --- |
| Guidelines and business model | 18/20 | Honest estimates, minor safeguards and IAP flow; DSA state not freshly verified |
| Build, stability and runtime QA | 16/20 | Full local verify and targeted regressions; Build 12 VALID, but does not contain this patch; exact new binary and physical pass missing |
| Privacy and consent | 18/20 | Consent/privacy regression checks and public DE/EN policies; full native cleanup and current ASC privacy declaration not re-audited here |
| Code/security/dependencies | 13/15 | Five confirmed findings corrected, negative-path tests and deployed barcode check; npm audit still reports 27 dependency findings |
| Login/deletion/subscriptions | 8/10 | Production configuration check passes; disposable QA account deletion succeeds; full native StoreKit matrix still open |
| UI/UX/accessibility | 8/10 | Targeted mobile-width browser weight flow plus existing validators; not a fresh native all-screen/VoiceOver/Dynamic Type certification |
| Metadata/site | 4/5 | Live draft bilingual text and screenshot checks, links 200; final comparison against exact submission binary remains |
| **Total** | **85/100** | **Suitable to produce the next test candidate, not yet to submit confidently** |

## Corrected code paths

1. Barcode: a record with macros but absent calories no longer becomes a
   high-confidence 0 kcal meal. Both handlers use the same complete-label
   parser; genuine zero labels remain valid. Decimals and per-100g references
   survive correction. The app independently rejects incomplete old replies.
2. Progress weights: kg storage retains two decimals, enough for 0.1 lb
   round-trips. This fixes 219.2 lb becoming 219.1 lb after saving.
3. Weight range: input and save boundary agree on 35–350 kg. No silent
   conversion of an accepted 30 kg input into 35 kg. Invalid or failed saves
   stay in the dialog with an error.
4. Offline profile edits: `editedAt` is stamped for manual setup, weight and
   unit changes. Hydration compares it instead of the old onboarding date.
   Missing cloud age remains authoritative; existing-account login still uses
   its separate cloud-authoritative path. This is timestamp-based same-account
   reconciliation, not a general multi-device conflict-resolution guarantee.
5. Unit preferences: persistence no longer depends on React executing a state
   updater synchronously. It saves an explicit current-profile snapshot.

`scripts/validate-review-regressions.mjs` executes the real handler functions,
React callback bodies, unit utilities and hydration function with mocked
boundaries. Cases cover absent/null/blank/negative/non-finite nutrients, true
zeros, old partial client replies, decimals, a tenth-pound sweep, range
rejection, delayed state processing and the age-authority guard. These are
behavior tests, not native UI tests.

## Live backend and production configuration

- Targeted Playwright browser pass at 402×874: in Verlauf, entered `219,2`
  lb, saved, reopened. Display and input both remain `219,2`; persisted
  weight is 99.43 kg with a fresh `editedAt`. A fictional local QA profile
  was used and cloud requests were intentionally blocked. Expected network
  console errors are not evidence of an online cloud test. The first direct
  reload of `/onboarding` hit the simple test server's missing SPA fallback;
  navigating from its root loaded the exported app correctly.
- Playwright skill informed real UI interactions and refreshed snapshots;
  this was a browser-weight-flow check, not native camera or StoreKit QA.

- Deployed only `nutrition` to the existing linked Supabase project.
- `node scripts/validate-barcode-live.mjs`: HTTP 200 for 8000500310427;
  515 kcal, 7.9 g protein, 64 g carbs, 24.8 g fat per 100 g. This checks the
  deployed path, not universal food-database accuracy. No paid model call.
- The disposable QA account was deleted in the test's `finally` block.
- `npm run validate:release:production:remote`: PASS. This validates current
  EAS production configuration, not the environment embedded in an old IPA.
- Supabase skill influenced the shared server boundary, explicit failure
  behavior and scoped deployment. No schema or RLS permissions changed.

## Live App Store Connect findings and changes

Read-only inspection first; then only draft descriptions and the two named
`04-log.png` images were changed. No build selection, release, or review
submission was performed.

- Version 1.0.0 remains `PREPARE_FOR_SUBMISSION`; selected build is **null**.
- Build 12 is `VALID`. It predates the nutrition, US-stepper and current
  client changes; do not mistake its status for this source revision passing.
- App names: 30 characters each. Subtitles: DE 28, EN 21.
- Keywords: DE 94, EN 92 characters. Promotional text: DE 129, EN 110.
- Updated descriptions: DE 3012, EN 2630 characters; below 4000.
- Added the three-free-analysis rule, Pro requirement, monthly/annual renewal,
  cancellation and Terms/Privacy/Apple standard EULA links.
- Photo wording now distinguishes discarded originals from temporary local
  compressed retries. It no longer implies every failed request deletes its
  retry image immediately.
- Five screenshots per locale, all Apple asset states `COMPLETE`. Locally
  verified 1320×2868 PNGs without alpha. Visual review caught a contradiction:
  252 g banana at 89 kcal/100 g was shown as 244 kcal. Changed to 224 kcal and
  corrected the rounded fat value to 1 g. The displayed reference was also
  corrected to USDA FDC 173944, verified directly against USDA: 89 kcal,
  1.09 g protein, 22.84 g carbs and 0.33 g fat per 100 g, including a 126 g
  reference serving. Only these two existing assets were
  replaced, after Apple finished processing the replacements, preserving
  position 4 of 5. Old assets remain recoverable from Git history.
- Current age questionnaire includes wellness topics and age assurance, not
  medical treatment, ads or chat. The configured Apple rating override is
  13+; the app's actual eligibility remains 14+ and is disclosed in both
  descriptions. These are different concepts, not permission for age 13.
- Review notes exist in ASC, explain loginless access, consent, minors,
  subscription IDs and the test route. Contact details were not reproduced.
- Start, support, privacy and terms pages: DE/EN all HTTP 200 with correct
  document languages. This is not a fresh legal opinion on all territories.
- Browser access to the account-level DSA screen failed. No claim that its
  former `In Review` status is still current. Verify before EU distribution;
  do not describe it as a universal TestFlight or global review prohibition.

## Remaining release gates

1. Build a new signed candidate from the corrected commit and install that
   exact version. No new TestFlight build was requested or created here.
2. Physical iPhone pass: repeated camera opens/scans, difficult/missing food
   results, weights in kg/lb/stone, offline edits followed by reconnect,
   account deletion, keyboard dismissal and saved history.
3. Complete Apple sandbox purchase/restore/cancel/pending/expiry/refund matrix.
4. VoiceOver, largest Dynamic Type and actual touch target behavior.
5. Recheck DSA, current App Privacy answers, both subscription associations,
   screenshots and reviewer access against the final binary, then select it.
6. Owner approves the final draft before any Add/Submit for Review action.

Dependency note: `npm audit` reports 18 moderate and 9 high, zero critical.
High findings are in the Expo/Metro/image-size/PostCSS dependency chain; npm's
offered aggregate fix jumps to Expo 57. No unapproved SDK migration or blind
`audit fix --force` was performed. This is an open maintenance/risk item, not
a claim that all advisories are irrelevant.

## Official references consulted

- [Apple App Review Guidelines, especially 2.1, 2.3, 3.1.2 and 5.1](https://developer.apple.com/app-store/review/guidelines/)
- [Apple subscription disclosure requirements](https://developer.apple.com/app-store/subscriptions/)
- [Apple DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)
- [Supabase upsert semantics](https://supabase.com/docs/reference/javascript/upsert)
- [Supabase scoped Function deployment](https://supabase.com/docs/guides/functions/deploy)
