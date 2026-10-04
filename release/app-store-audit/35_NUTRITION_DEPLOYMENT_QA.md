# Nutrition deployment and native follow-up — 2026-09-06

The user explicitly approved publishing the tested nutrition corrections and checking them live. App Review submission and a new TestFlight binary are not part of this deployment.

## Confirmed defect and fix

A BLS family identity conflict previously returned `null`, which both gateways treated as permission to query USDA. A conflicting dry/sugar-free/milk/yogurt label could therefore still receive values from the disputed English query. The regression failed before the fix.

`requiresFoodIdentityCorrection` now preserves the existing reviewed-family decision across both gateways. Conflicted ingredients are excluded from USDA lookups and cannot consume facts retrieved for another ingredient with the same query. New clients receive the existing correction draft; legacy clients receive the existing 422 missing-nutrition error. Valid unrelated ingredients still resolve and retain their quantities. No new source values, auth rules or database schema were introduced.

The first live pass also exposed a missing German spelling, `knusprige Paprika-Kartoffelchips`. This exact food-family alias was added, with source-scaling and light-variant rejection coverage.

## Provenance and rollback

Before publishing, the current `nutrition` function was downloaded through the Supabase CLI. All ten downloaded files matched Git HEAD `633d688` byte-for-byte. The deployed version was 48, ACTIVE, JWT verification enabled. Only the intended three server files differ in the candidate: `_shared/bls-reference.mjs`, `_shared/nutrition.mjs`, and `nutrition/index.ts`.

The original live source, hashes, function metadata and a copy of the unchanged project config.toml are stored at `/Users/hewaddorani/.codex/backups/kandro-live-function-JQfnZN`. A rollback must use that original source and preserve `verify_jwt = true`. Deployment used the project's existing configuration and explicitly named only `nutrition`, without pruning functions or changing secrets.

## Validation and live observations

- `npm install` succeeded. The full configured verification suite passed after the gateway conflict fix and again after the German spelling correction (exit 0, Expo Doctor 18/18 and web export included). The explicit live script also passed syntax checking.
- Native standalone app: adult age checkbox, 78.4 kg comma input with native keyboard, maintenance targets 2420 kcal / 125 g protein, processing consent and iOS camera permission dialog verified. The simulator camera remained in startup, so no physical capture is claimed.
- Native demo portion controls: 710 → 497 (0.7×) → 994 (1.4×) → 710 kcal (1×), with matching ingredient grams. Individual chicken input accepted 100.5 g and displayed 166 kcal. That edited draft was not saved before the simulator UI restart; a fresh 710-kcal demo was subsequently saved and verified as described below.
- First deployment: version 49, ACTIVE, JWT verification still enabled. Live unauthenticated search returned 401; an authenticated test user without consent returned 403.
- English feedback: crunchy muesli **421 kcal / 100 g, C514200**; spicy remoulade **85 kcal / 15 g, Q999000**; paprika potato chips **158 kcal / 30 g, K280100**. All three carry medium confidence and `estimatedReference` provenance. The previous 117 kcal yogurt/fruit muesli mismatch was absent.
- Chocolate with biscuit remained explicitly unmatched; the new protocol returned a correction draft, while the legacy request returned 422. Its internal unmatched placeholder must not be presented as a valid zero-calorie food; existing UI guards withhold totals/save until corrected.
- The German first pass resolved muesli/remoulade but rejected the spelling noted above. The first live test therefore correctly failed overall. Its synthetic account was deleted and profile removal verified. Evidence: `LIVE-QA.json` in the rollback directory.

`scripts/validate-nutrition-deployment.mjs --live` repeats these live API checks with its own temporary synthetic adult account and deletes that account in `finally`. It is deliberately outside the default verification suite because it invokes paid model inference. It never saves meals or operates on an existing user account.

## Final deployed result

**Version 50 is ACTIVE, with JWT verification still enabled.** After deployment, all ten server source files were downloaded again and compared byte-for-byte with the tested local candidate: all matched. Final readback source, hashes and metadata: `final-readback/` in the rollback directory.

The final live smoke test **passed with exit 0**:

- English four-food feedback: HTTP 200 correction draft. Muesli/remoulade/paprika chips resolve to C514200/Q999000/K280100 with the exact grams and scaled values above. Chocolate with biscuit remains unmatched.
- German three-family description: HTTP 200 complete; all three expected references, quantities, medium confidence and estimated-reference flags verified.
- Legacy four-food request: HTTP 422 `missing_nutrition`; no incomplete successful meal presented to old clients.
- Unauthenticated access: 401. Authenticated without wellness consent: 403.
- The final synthetic account was deleted and its profile's removal verified, including after the earlier failed smoke test. No test meal records were saved.

Evidence: `LIVE-QA-VERIFIED.json`. The full before/after history remains available as `LIVE-QA.json` (initial failed German spelling case) and the original version-48 rollback source. These are text-analysis tests, not evidence of original-photo recognition accuracy or branded chocolate nutrition.

## Completed standalone follow-up

After a Simulator GUI restart, the Debug app displayed “No script URL provided.” Metro's health endpoint still returned `packager-status:running`. An explicit app termination/relaunch restored the app and its synthetic profile without a production code change. The local Debug binary requires Metro; no persistent runtime defect or root cause is established by this transient development-server incident.

A fresh demo confirmed at 1× produced 710 kcal and 1,710 kcal remaining from the 2,420 kcal goal. Today contained exactly one 710-kcal breakfast entry. After another complete process termination/relaunch, Today again showed the same single entry, totals and profile targets. The synthetic native QA profile and this demo remain in the dedicated simulator for further testing; they are separate from the deleted live API test accounts.

The native paywall displayed both products: $44.99/year and $6.99/month in the simulator's returned currency, with a $3.74 monthly annual equivalent and 46% savings. Switching to monthly updated both selection and auto-renewal disclosure. RevenueCat logs confirmed StoreKit product responses; the UI maps `product.priceString`. These dollar observations do not replace the earlier German App Store Connect price check. No purchase or successful restore was performed.

## Remaining release limits

A suitable product label/barcode is still needed for chocolate with biscuit. Real photo accuracy, physical-device camera stability, full native purchase/restore and the DSA status remain separate release gates. The locally fixed Result budget and disclosure UI require a new mobile build to reach TestFlight users. No App Review submission or new TestFlight upload was performed.
