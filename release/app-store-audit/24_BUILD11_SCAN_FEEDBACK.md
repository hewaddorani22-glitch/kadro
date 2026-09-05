# Build 11 feedback: energy mapping and repeated camera use

## Confirmed nutrition defect

USDA query `honeydew melon raw` selected Foundation record 2710816, `Melons, honeydew, raw`. It supplies energy in nutrient IDs 2047 (36.7 kcal) and 2048 (32.9 kcal), but no 1008. The old reader defaulted absent values to zero, while protein/carbs/fat were present. This reproduces the user's report without guessing at the photo.

The mapper now reads legacy kcal, specific Atwater and general Atwater in priority order, supports search/detail field shapes, and distinguishes absent values from genuine zero. Incomplete main nutrition is rejected. A zero-energy cache item with substantial macros is excluded as unmatched. Cache version 5 prevents reuse of earlier mappings. Scan items and USDA search retain reference precision rather than reconstructing it from rounded portions. The prompt explicitly excludes inedible rind/seeds and labels whole-fruit weight uncertainty.

The nutrition Edge Function was deployed. `node scripts/validate-melon-live.mjs` passed against the hosted model/database path: 1000 g explicitly edible raw honeydew -> 329 kcal, 5 g protein, 82 g carbs, 2 g fat (rounded display). Its disposable QA account was deleted. This is not proof of arbitrary photographic weight accuracy. Existing meals are not silently changed.

## Camera findings and limits

The exact native crash is **not reproduced** and no device crash report has been supplied. No claim of a fixed native crash is justified yet.

Code inspection found unbounded correction/tab stack retention in the scan completion path: confirmation pushed result and result replaced only itself with another tab navigator. Completion now replaces confirm and pops to the existing tabs; retake/error return does the same. The real React Navigation stack reducer passes 30 cycles with one root tab route after every completion. Camera mounting additionally requires actual focus and foreground state. iOS acquisition is limited to 1920×1080 rather than the implicit High preset, reducing upstream image size. A delayed capture completing while backgrounded is discarded.

Full `npm run verify` passed in `/tmp/kandro-scan-verify.log`. Native camera opening, rapid foreground transitions, capture cancellation and 15+ actual photos still require an iPhone and ideally its crash/Jetsam report. Build 11 itself does not acquire app-side source changes; a replacement binary is required. No App Review action was taken.

Browser follow-up passed eight complete demo/confirm/result/Today cycles, with one visible tab bar after each and no observed navigation failure. This used a local cloud-disabled QA fixture, not the owner's account. The owner identified the affected device as iPhone 17 Pro; the crash log is still outstanding.

Final verification, including delayed capture success/failure while backgrounded, passed in `/tmp/kandro-scan-verify-final.log`.

## Restore

An already active Pro entitlement may be confirmed again by Restore. That is expected and is not a new purchase. The UI displays the active message only for an active restore result; this does not exercise a real transaction in this audit.

Sources: [Expo SDK 54 Camera](https://docs.expo.dev/versions/v54.0.0/sdk/camera/), [Expo SDK 54 Router](https://docs.expo.dev/versions/v54.0.0/sdk/router/), [RevenueCat restore](https://www.revenuecat.com/docs/getting-started/restoring-purchases).
