# Build 14 and international App Review preparation

Date: 2026-09-05. The owner now explicitly requests App Review submission,
superseding the earlier instruction to stop before submission. Authorization is
not evidence of a successful device test. No missing test is marked passed.
The owner subsequently answered “ja” to the request to test Build 14. This is an
agreement to perform the test, not a passing result. Final submission is held
until actual results are provided.

## Candidate

- Source: `50d80b8d5f5fdd40a71190ce03c4fefe8d5e7d37`, clean audit branch at dispatch.
- Version: 1.0.0 (14).
- EAS build: `7d0305a9-6826-4fec-a83b-144763be6e94`.
- Apple binary-upload job: `d67e4d2d-7fd1-4158-b543-68575f3984fc`.
- EAS build and Apple binary upload: both `FINISHED`.
- Apple build ID: `85014720-b038-4e78-a6ab-c704cf6609a5`, processing `VALID`.
- Internal TestFlight state: `IN_BETA_TESTING`, assigned to `Kandro Internal`.
- EN/DE “What to Test” notes saved and read back, including ingredient replacement,
  decimal grams, reopening entries, repeated camera cycles and purchase/restore.
- Build 14 is selected on the 1.0.0 App Store draft, verified by API readback.
- No automatic public release enabled; the existing manual release setting remains.

## Checks performed again

- `npm install`, full `npm run verify`, `validate:eas:remote` and
  `validate:release:production:remote` all exited 0.
- GitHub CI passed for the exact source:
  https://github.com/hewaddorani22-glitch/kadro/actions/runs/33985747445.
- Supabase linked database dry run reports up to date, no pending migrations.
- Live App Store 1.0.0 draft remains `PREPARE_FOR_SUBMISSION`; Build 14 is now selected.
- DE and EN descriptions, keywords and URLs exactly match `store.config.json`.
- Five complete screenshot assets per locale; app categories Health & Fitness and
  Food & Drink. Primary locale en-US; German localization de-DE. UK users can use
  the existing English localization; no separate UK translation is claimed.
- Published App Privacy shows the documented eight linked data types. Public
  English/German home, support, privacy, terms and sources URLs all returned 200
  with the correct HTML language. No legal-compliance guarantee is implied.
- App download base price is zero; public App Store distribution selected.
  Mac and Vision Pro availability remain disabled.
- Initially the app and both subscriptions selected all 175 territories. The app
  now selects 174, including USA, GBR and DEU, with mainland China excluded as
  described below. Both products retain 175 price entries and complete review
  screenshot assets, with EN and DE subscription localizations.

## Exact archive inspection

The finished Build 14 IPA was inspected, not merely the working tree. Bundle
version is 14, SDK is iphoneos26.0 and minimum iOS version is 15.1. Strict/deep
code-signature verification succeeded. English and German localization folders
contain camera permission copy. PrivacyInfo.xcprivacy is present with tracking
false and required-reason API declarations. The shipped JS bundle contains
ingredientCorrection, correctionRequired, correct-food and both localized
replacement labels. These checks do not prove camera runtime, StoreKit sandbox,
VoiceOver or device accessibility behavior.

## Configuration corrected

Annual subscription `6808646840` was level 2 while monthly `6808643495` was level 1,
despite providing the same entitlement. Annual is now level 1, read back from
Apple's API. No prices, durations, product IDs or entitlement IDs were changed.
Apple supports equal service at the same level with different durations:
https://developer.apple.com/app-store/subscriptions/.

Mainland China availability was disabled for the initial release because no ICP
registration is configured and that market is outside the owner's primary
US/UK/DE launch scope. Readback confirms 174 selected app territories, China false
and USA/GBR/DEU true. No other territory selection was changed. China-specific
requirements must be assessed before enabling it; no global legal clearance is
claimed for the other territories.

Both subscription reviewer notes now describe the actual Pro feature boundary,
free barcode/search and incomplete-lookup refund. App reviewer notes were updated
and read back exactly from Apple; canonical copy is `BUILD14_REVIEW_NOTES.txt`.
They describe the new correction flow, consent, minors, deletion, server-confirmed
Apple purchases, language/units and production endpoint without claiming a device
pass or guaranteed photo accuracy.

Existing subscription prices were checked, not changed:

| Territory | Monthly | Annual |
| --- | ---: | ---: |
| Germany | EUR 7.99 | EUR 49.99 |
| United States | USD 6.99 | USD 44.99 |
| United Kingdom | GBP 6.99 | GBP 44.99 |

## Outstanding release gates

1. Exact Build 14 is processed and active in TestFlight but must be installed/tested on iPhone.
   The new correction navigation and native amount sheet have only browser and
   regression evidence so far. Native purchase/restore and accessibility are not
   certified by those tests. The owner was asked for explicit results.
2. Live Apple Business page still says DSA “In Prüfung”. The availability API for
   DEU reports `TRADER_STATUS_NOT_PROVIDED`, unlike USA/GBR. All three also report
   `CANNOT_SELL` / `AVAILABLE_FOR_SALE_UNRELEASED_APP` while unreleased. Selection of
   a country is not approval to sell there. EU publication remains blocked by the
   trader check; this is not described as a universal TestFlight prohibition.
3. The app version, first subscription group and both first subscription versions
   must be included together in the final submission. Apple's current version UI
   directs subscriptions to their own submission flow; having READY_TO_SUBMIT
   products alone is not evidence that they are attached to a submission.

The current safe decision remains pending exact-candidate testing, not a new
numerical approval probability or a claim that App Review is complete.
No App Review submission was sent. Manual public release remains selected.
