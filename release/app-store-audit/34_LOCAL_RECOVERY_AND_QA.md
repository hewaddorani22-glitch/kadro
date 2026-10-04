# Local recovery and QA — 2026-09-06

Status: **NO_GO for App Review**. No backend deployment, TestFlight upload or review submission in this recovery session.

Subsequent update: the user approved the server rollout after this recovery phase. Version 50 and its passed live/readback checks are documented in `35_NUTRITION_DEPLOYMENT_QA.md`; deployment statements below describe the earlier recovery phase.

## Source provenance

The original iCloud repository still has unreadable `dataless` directories. This checkout is a separate GitHub clone outside Documents/iCloud, based on remote branch `audit/app-store-release-gate-20260904` at `633d688e6a6247a6e1cc66f85788c157b6e12863`. Its parent `50d80b8d5f5fdd40a71190ce03c4fefe8d5e7d37` is the recorded Build 14 runtime base. `git fsck --full` passed.

All 65 files present in both the readable recovery backup and GitHub are identical. Another 59 backup-only files remain in the backup; 12 Git metadata files were not compared as source. The six uncommitted source files reported by the previous task were unavailable. Changes here reconstruct the documented intent; they do **not** prove recovery of every original local edit. Original repository, `app` link and archived chat remain unchanged. `app-lokal` in the wrapper links to this checkout.

## Local candidate changes

- Whole-term BLS family aliases for crispy muesli, remoulade and paprika potato chips. No invented nutrient values or quantity changes.
- Medium confidence and `estimatedReference` provenance, with one localized German/English disclosure. No new server warning code that legacy Build 14 could display untranslated.
- A generic English lookup must agree with the named family; conflicting light, sugar-free, banana/tortilla, milk/yogurt variants are not assigned ordinary family values. A less-specific `muesli` query cannot let a composite yogurt/fruit dish override a named dry crunchy-muesli ingredient.
- Granola uses the existing baked-granola row `X0A3000`, rather than the classic crunchy-muesli row. Fruit and chocolate muesli retain separate rows.
- No automatic Milka LU mapping to the wholemeal-biscuit bar `S581300`: it does not establish the packaged product's nutrition.
- Fix confirmed native Result bug: after editing a saved 579 kcal meal to 554 kcal, the old code displayed 1841 remaining instead of 1866 and lost the confirmed edit on reload. Projection now replaces the matching saved ID, and Result arrival persists the revision once. Behavioral regressions exercise new/saved/edited meals, unrelated entries and over-budget totals.

## Automated validation

`npm install` passed. Public production configuration was pulled from EAS into ignored `.env.local`. The initial configuration-free `verify` run failed because generated website legal pages require provider environment values. With `DOTENV_CONFIG_PATH=.env.local`, the full suite passed, including Expo Doctor (18/18) and web export. Targeted food-identity, source-value, gram-scaling, decomposed-umlaut and bilingual-warning regressions also passed. Production release-configuration checks passed. Final post-edit verification is tracked in the wrapper's current-status document.

## Browser UI observations

These are browser observations, **not native iPhone certification**. Used synthetic profile “Kandro QA”, age 29, male, maintenance, 178 cm, 78.4 kg, lightly active.

- Age confirmation blocks progress until selected; adult path skips guardian step.
- Exact comma weight input saves 78.4 kg; US switch displays 172.8 lb. Returning to metric retains 78.4 kg.
- Target: 2420 kcal / 125 g protein. Explicit processing consent appears before the first scan.
- Demo confirms four ingredients totalling 710 kcal. Changing chicken from 180 g to 100 g changes its value from 297 to 165 kcal and total to 578 kcal; other ingredient quantities remain 220/70/30 g.
- Result and Today show 578 consumed and 1842 remaining. Exactly one logged meal persists after leaving Result and fully reloading the page.
- Home context shows exactly three recommendations. English and dark appearance persist after reload. Browser paywall correctly labels preview prices and states nothing is charged; this is not a StoreKit purchase test.
- No excess scroll was reproduced in this browser demo flow. This does not clear the native scrolling report.
- After the incomplete live draft was abandoned, Today still contained only the 578 kcal demo. The synthetic browser QA account was deleted through the app's explicit confirmation flow; UI reported successful deletion and cloud sync remaining off. No existing user account was used for this deletion test.

## Native simulator observations

Runtime: iPhone 17 Pro, iOS 26.5, Expo Go SDK 54, using the local candidate and a separate synthetic adult profile “QA”. These checks exercise native React Native controls, but Expo Go uses RevenueCat browser mode and cannot establish StoreKit correctness or standalone/TestFlight stability.

- Adult onboarding, comma weight 78.4 kg, target 2420 kcal / 125 g protein, processing consent and the denied-camera recovery screen worked.
- Demo ingredient amount 180 → 100.5 g changed chicken 297 → 166 kcal and meal 710 → 579 kcal. The native decimal keyboard was shown; Save/Cancel remained visible above it and saving closed the keyboard.
- Replacing avocado with searched BLS banana `F503100` at 110.3 g retained the other quantities and yielded 554 kcal. An accidental removal dialog was cancelled without deleting an ingredient.
- Repeated real touch swipes reached a stable bottom on Confirm and Result before and after replacement. No growing empty scroll area was reproduced in these demo flows. Original reported photo flow remains unverified.
- The stale-budget bug above was reproduced and fixed locally. Retest with a separate existing 579 kcal meal: new 710 kcal demo left 1131; changing its chicken to 100 g yielded 578 and immediately **1263 remaining / 61 g protein remaining**. Reloading directly from Result, without tapping a second save/navigation button, showed **1157 consumed / 1263 remaining**, exactly two entries (579 and 578), with the correction persisted.
- First cold Expo Go launch after a 108-second bundle ended with recorded SIGSEGV 11. A cached restart and subsequent reloads worked. No stack trace was obtained, so the crash is not attributed to a specific app defect or dismissed as a memory-only issue. The standalone candidate's separate launch checks are below; they do not establish the cause of this earlier Expo Go crash.

After the budget patch, the full configured `npm run verify` completed with exit 0, including Expo Doctor 18/18, type checking, behavior regressions and web export; `git diff --check` passed.

### Standalone Xcode build

Xcode 26.6 completed the Debug iOS Simulator build with **BUILD SUCCEEDED / exit 0** using `xcodebuild -workspace ios/Kandro.xcworkspace -configuration Debug -scheme Kandro -destination id=8A028D1C-A763-44BC-B695-69ED6A125074 -jobs 2 build`. Bundle identifier verified as `com.hewaddorani.kandro`. Native dependencies and the generated `ios/Kandro.xcworkspace` are materialized locally. This is a local Debug build, not a new TestFlight upload.

Compilation was resource-intensive on the 8 GB Mac. After native UI testing, development servers and the test simulator were stopped while Xcode finished; Interface Builder eventually completed without source changes. Restarting the original simulator then reported **Data Migration Failed** via `simctl bootstatus`. Its data was not erased. A separate `Kandro QA Local` device (`DBA83E22-0DF4-4B41-81FE-EF8C9EAA4F6D`) was created for an isolated launch attempt. **Installation of the built Kandro.app succeeded with exit 0** on that device. First boot completed in 5 minutes 43 seconds. An early launch request during system startup failed without returning a process handle; opening Kandro after boot displayed its native onboarding. Selecting maintenance, continuing to name entry and going back retained the selected goal. A subsequent explicit app termination and relaunch succeeded with process ID 21213; Metro served the cached bundle in 172 ms. This is startup/basic navigation coverage; the full meal and subscription flows were not rerun in this standalone binary.

## Live gateway finding

Submitted the synthetic English description “100 g crunchy muesli, 15 g spicy remoulade sauce, 30 g crispy paprika potato chips, and 20 g milk chocolate with biscuit. All amounts are the actual edible weight.” through the app UI.

The current deployed gateway returned a correction draft. Remoulade, paprika potato chips and chocolate with biscuit lacked values. The app correctly displayed missing nutrition, withheld the total and disabled confirmation. **Crunchy muesli incorrectly showed 117 kcal/100 g**; its amount dialog exposed `BLS 4.0 X092510`, the yogurt/fruit muesli dish. This is a confirmed live mapping error. The exact model lookup term is not exposed by the UI; the `muesli` plus composite-key regression is a plausible failure case, not a captured raw model response.

The incomplete draft was not saved. Local candidate mapping fixes are not deployed, so this result does not validate them live or prove photo recognition accuracy.

## Remaining gates

- Complete the remaining native test matrix against the actual release/TestFlight candidate; local Xcode compilation, installation and basic startup passed, and Expo Go checks above are limited coverage.
- Verify a suitable reference or explicit barcode correction for chocolate with biscuit.
- Test corrected backend candidate live after deployment is appropriate.
- Physical-device camera permissions, repeated original-photo scans, VoiceOver/Dynamic Type and StoreKit purchase/restore remain pending. Original feedback photos are unavailable.
- Resolve current DSA status and attach first subscription group/products to the actual review submission before submitting. See Build 14 preparation notes and wrapper's live App Store Connect audit.
