# Build 8 feedback and remediation, 2026-09-05

## Release decision

NO_GO for App Review. Build 8 has confirmed owner-reported native usability
defects. Earlier 90/100 documentation is historical and not a current release
clearance. No replacement TestFlight build or App Review submission was made
in this remediation pass.

## Changes

- Search embeds the amount picker in one native modal, rather than presenting
  two sibling modals. iOS waits for dismissal before navigating to confirmation.
- Portion editor has a fixed close button, backdrop dismissal, fixed save/cancel
  actions, keyboard avoidance and scrolling body. No forced numeric keyboard.
- Countable detections carry estimated grams per piece. Count can change via
  +/- or quick choices 0.5 to 5, or by typing. Grams remain available. Switching
  units preserves the selected quantity; cancel leaves the original unchanged.
- Repeated quantity corrections use a stable numeric reference, avoiding
  cumulative rounding. No additional paid recognition call is introduced.
- Light first-launch default; explicit persistent dark setting in profile.
  Reactive palette updates do not remount application state. Fixed contrast for
  scan mark, avatars, Pro action, selected controls and nutrition summaries.
- Basic pancake variants are first and second. Explicit spinach queries still
  return spinach variants. Pending searches cannot overwrite newer input.
- Description confirmation now offers description editing, not photo retake.

## Evidence

### Four audit findings remediated

- Adolescents no longer inherit adult calorie floors/caps. Added 324 combinations
  across ages 14–17, sex, activity, weight and goal; maintenance rounds directly.
- Empty confirmation is disabled with EN/DE guidance, no confidence badge, and
  a second guard in the save handler. Executed the actual guard on empty,
  excluded-only and included inputs. Browser confirms disable and recovery when
  one ingredient is included again. No empty test meal was persisted.
- Result suppresses next-meal calorie/protein advice below 150 remaining kcal,
  matching Today/Plan. Source regression checks cover the conditional branch.
- Ingredient name/source and amount controls occupy separate rows. Browser
  screenshot at 320px checked: output/playwright/build8-fixes/fixed-details-320.png.
- npm install and complete npm run verify passed, including Expo doctor 18/18.
- Requested local iOS simulator test could not run: xcode-select points at
  /Library/Developer/CommandLineTools, xcrun cannot find simctl, and Xcode was not
  found in Applications/Spotlight. No local native build, simulator pass,
  TestFlight upload or App Review submission is claimed.

### Decimal entry and target arithmetic follow-up

- Search and portion editor use fade rather than slide; Reduce Motion disables
  these transitions. Detail-row amount opens grams explicitly.
- Removed whole-gram rounding from parser, initial selection and app setter.
  Decimal comma/point preserve tenths; unsupported numeric formats are rejected.
  +/- respects the same 1–5000 g range. Search retains source per-100g nutrition.
- Browser at 390x844: hosted pancake search, 110.3 g -> 233 kcal, reopening
  retains 110.3. Demo detail row: tap 180 g, enter 110,3, save, reopen -> 110.3;
  localized row displays 110,3 g. Screenshot: ignored output/playwright/build8-fixes/decimal-grams.png.
- Full verify passed again, including 199,800 adult profile combinations and
  3,888 onboarding explanation cases. Adult calories now have an independent
  sex/activity/goal/rate/clamp oracle for each case. Existing macro consistency,
  teen no-deficit/no-surplus, unit-conversion and quantity regression gates pass.
- This proves implementation consistency, not a clinically validated target.
  Activity multipliers, the unspecified-sex midpoint, fixed weekly-rate energy
  offsets and 1300/4000 calorie bounds remain planning assumptions. Weight gain
  is not guaranteed muscle gain. Neither predictive equations nor rounded
  nutrient data establish individual accuracy; real-photo evaluation and native
  device gates remain open. No calorie-prescription policy was changed here.
  References: https://pubmed.ncbi.nlm.nih.gov/2305711/ and
  https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner.

- `npm install` and full `npm run verify`: passed, Expo doctor 18/18 and web export.
- `scripts/validate-build8-fixes.mjs`: actual shared mapper and app scaling
  function, 50 quantity round trips, invalid counts, ranking, light/dark text
  contrast >=4.5:1 for tested token pairs and modal wiring checks.
- Production `nutrition` function deployed to project `omtmxqzwxvthycyfkggv`.
- Local real-model text request and hosted real-model request through the app:
  3 pancakes, 240 g total -> one item, 80 g per piece. No photographed pancake
  accuracy claim follows from this text test.
- Browser 390x844, real hosted search: plain pancakes first, add opens picker,
  240 g -> confirm ~506 kcal; changing to 999 g then cancelling retains 240 g.
- At a reduced 390x500 browser viewport, close and save stay inside the
  viewport while the editor body scrolls. This approximates constrained space,
  not native keyboard behavior.
- Hosted description -> 3 pieces; two + taps -> 5 pieces/400 g/~843 kcal; save
  returns to confirmation with five pieces. Values scale the initial estimate,
  not measured pancake size. Unequal pieces can require gram correction.
- Appearance: dark choice survives reload. Simulated device-dark with absent
  app preference still selects light. Avatar, scan logo and Pro button visually
  checked in both palettes. No runtime errors in these final browser paths.
- Local browser evidence: `output/playwright/build8-fixes/` (ignored, not shipped).

## Still required

### Additional scanner-close report, 2026-09-05

- Scanner close now invalidates the current capture visit immediately, disables
  the preview and torch, and dismisses the keyboard. Late camera responses cannot
  open analysis or show a stale error; cancelled temporary photos are deleted.
- Synchronous capture/barcode locks prevent same-frame duplicate events. Barcode
  callbacks are ignored off-screen. Search responses are invalidated on blur.
- Close target is 48 points plus an 8-point hit slop. Camera/decorative layers
  explicitly ignore pointer events; controls have an explicit stacking level.
  This addresses touch layering, but the owner's exact native hit-test failure
  has not been directly reproduced on their phone.
- Description/manual-barcode and blocked-paywall transitions wait for native iOS
  sheet dismissal before navigation, avoiding overlapping presentations.
- Actual capture handler executed with delayed success and rejection: closing
  wins, no late navigation/error, cancelled file cleanup, duplicate tap blocked.
- Browser photo close and three barcode-close cycles reached Today, zero runtime
  errors. Full `npm run verify` rerun passed, Expo doctor 18/18, web export passed.
- Build 8 remains unchanged. These fixes require a replacement native build and
  physical-device validation before changing the NO_GO decision.

- Physical iPhone replacement-candidate test: numeric keyboard, native modal
  dismiss/navigation, real-camera pieces and barcode, fast taps and large text.
- Full original purchase/restore/reinstall device gate remains in force.
- Cloud history currently restores numeric amounts/nutrients, not household-unit
  metadata. The active scan/search correction flow retains units; enhancing
  logged-history piece editing is a separate follow-up.
- No claim that all bugs are gone or that an App Review outcome is guaranteed.
