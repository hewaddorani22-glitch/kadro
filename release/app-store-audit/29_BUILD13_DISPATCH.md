# Build 13 dispatch

Date: 2026-09-05. Source: `551618f79b8b3203ea3f80c01712f3e41ffb8923`.

The worktree was clean when the build was uploaded. `npm install`, full `npm run verify`, `npm run validate:eas:remote` and `npm run validate:release:production:remote` passed again for this dispatch. GitHub CI for the exact source commit passed: https://github.com/hewaddorani22-glitch/kadro/actions/runs/33976681194.

- EAS build: `7f52481e-df13-4488-a489-3ecc310c9c78`
- Version: 1.0.0 (13)
- Apple upload succeeded (`FINISHED`): `c16f004a-df3d-4702-a7cc-ecf1acf595de`
- EAS build finished successfully (`FINISHED`, `ARCHIVE SUCCEEDED`).
- Apple build: `8a81805b-f1f2-47e1-977d-caf32bcdb94d`, uploaded 2026-09-05 17:16:05 UTC. Apple processing completed with `VALID`; internal state is `IN_BETA_TESTING`.
- English and German What to Test notes were saved directly through App Store Connect, and the build was assigned to the existing internal test group(s).
- External beta state remains `READY_FOR_BETA_SUBMISSION`. No external beta review was submitted.
- Store version 1.0.0 remains `PREPARE_FOR_SUBMISSION`.
- Initial auto-submit attempt with test notes was rejected because EAS changelog submission requires an Enterprise plan. The existing build was retained, and its upload was successfully scheduled without that option. No duplicate build was created.
- No App Review submission or release was performed or authorized.

## Included changes since Build 12

- Reject missing/incomplete nutrition instead of manufacturing zero calories; preserve valid nutrition precision and use stricter food identity matching.
- Correct US weight stepping to 0.1 lb and preserve fractional weights through conversions and history saves.
- Apply consistent 35–350 kg validation instead of silently clamping mismatched ranges.
- Persist explicit unit preferences and track profile edit timestamps for same-account offline synchronization.
- Earlier camera lifecycle safeguards remain included. The owner reported that repeated scans stopped crashing on the preceding build; this does not replace a device pass of this candidate.

## Required device checks

1. On iPhone 17 Pro, repeat camera open/scan/close 15–20 times, including rapid transitions and background/foreground.
2. Test dates, melon, unusual recognitions and barcode products. Missing references must give a correction/error path, not invented zero kcal. Estimates remain editable, not guaranteed exact.
3. Test 0.1 lb steps in onboarding/profile and save/reopen 219.2 lb in history. Also test comma/point decimal input, kg/lb switching and bounds.
4. Edit a profile offline and reconnect; verify the same account retains the newer edit and unit preference.
5. Check Pro purchase, restore, relaunch, decimal-gram corrections and piece quantities.

The App Review decision remains `CONDITIONAL_NO_GO` pending the exact candidate's device/StoreKit/accessibility pass and outstanding external verification. The 85/100 evidence-based assessment in report 28 is not an Apple approval probability.
