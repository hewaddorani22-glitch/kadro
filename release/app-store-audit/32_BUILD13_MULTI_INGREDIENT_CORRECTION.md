# Build 13: multi-ingredient correction, 2026-09-05

## Scope and evidence boundary

Owner reports include failed descriptions, missing calories with 5–7 foods and
apple/tomato/peach confusion. Original photos are unavailable. No claim is made
that the visual confusion was reproduced or that arbitrary foods can be recognized
perfectly. This work preserves incomplete results for explicit correction rather
than inventing nutrition or silently summing only the recognized ingredients.

## Implemented

- Every ingredient is visible in confirmation, including items without countable
  portions. Each can be replaced through food search or typed barcode digits,
  with the existing portion editor, or explicitly removed with confirmation.
- Photo/text requests opt into `ingredientCorrection: 1`. Missing nutrition can
  return an explicitly marked correction draft. Unknown values are not displayed
  as zero calories; totals and saving remain blocked until resolved or removed.
- Older clients still receive HTTP 422 for incomplete nutrition. The new protocol
  does not weaken their validation or allow partial totals to enter history.
- Draft corrections preserve the other ingredients, identifiers and original
  description. The result also displays the original description. The confidence
  label now says “Estimate” / “Schätzung”, not “High confidence”.
- Incomplete mapping is refunded by the gateway. Manually repaired drafts use the
  existing free logging origin bucket, like search/barcode, so history hydration
  cannot later count the refunded draft as a paid scan.
- A live test exposed BLS's ambiguous English “Potato chips” label for German
  Pommes frites. A separate display/index normalization disambiguates fries and
  crisps without modifying the underlying BLS nutrient data. Ordinary potato
  chips now resolve to K280100, not fries X654042. Explicit calorie-reduced chips
  remain distinct.

## Verification

- `npm install` completed. No dependency versions or lockfile changed. The existing
  27 dependency advisories (18 moderate, 9 high) are not remediated by this patch.
- Final `npm run verify` exited 0, including the new correction preverify,
  regression suite, TypeScript, Expo checks and production web export.
- Regression tests exercise the real resolver/client guard/helper paths, legacy
  and new protocols, invalid nutrients, replacement isolation, 1–12 ingredient
  sums, explicit unresolved removal and save/route/quota boundaries.
- Hosted `nutrition` function deployed using Supabase CLI `--use-api`, including
  the BLS disambiguation. No schema, auth configuration or secrets changed.
- Live hosted tests: “Nutella mit Scheibe Brot” returned two priced ingredients;
  a seven-food description returned all seven; 30 g potato chips returned 158 kcal
  from K280100 instead of the first run's incorrect 72 kcal from the fries record.
  Unknown food returned a correction draft to the new protocol and 422 to legacy.
  Disposable live-test accounts were deleted after both runs.
- Mobile-sized Chromium (393 × 852), DE/light and EN/dark: seven-item fixture,
  missing-value blocking, replacement via search, direct 110.3 g entry, preserved
  other ingredients, removal cancellation/confirmation, resulting sum and save
  were exercised. Original input remains visible on result. No browser errors.
- Cold reload: corrected meal persisted in the free origin bucket; lifetime scan
  count stayed at the pre-existing baseline of one rather than increasing to two.
  The browser's disposable anonymous QA account and its test data were deleted.

Browser food responses were deterministic fixtures, not evidence of real photo
recognition accuracy. The separate live cases above exercised the real model and
nutrition lookup through text only. Screenshots were visually inspected but are
local ignored QA artifacts, not committed user images.

## Release boundary

Backend changes are live. New correction UI requires a new native binary; the
currently installed Build 13 does not acquire those controls from this deployment.
No TestFlight build or App Review submission was started in this task.

Before release: test the exact next binary on the owner's iPhone, including camera
to correction, seven-food photos, wrong-but-priced identity replacement, barcode
replacement, portion modal closing, saving/reopening, VoiceOver and Dynamic Type.
Full App Review readiness is not asserted by this scoped food-analysis fix.
