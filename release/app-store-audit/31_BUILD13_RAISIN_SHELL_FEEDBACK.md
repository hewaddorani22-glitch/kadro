# Build 13 follow-up: raisin varieties and nut shells

2026-09-05. Owner feedback at 19:46/19:47 CEST, supplied as IMG_0425 and IMG_0426. Backend-only correction; no native build or App Review submission.

## Observed evidence

- The raisin screenshot shows `missing_nutrition`, not an image-clarity error. The nut screenshot reached confirmation. Neither screenshot contains the original structured model response.
- Replaying the entire supplied raisin screenshot twice with the unchanged production photo prompt / GPT-4.1-mini returned `raisins` and resolved successfully. This does **not** reproduce the owner's original failure.
- A live description of 50 g dried green raisins returned `raisins green dried`. That failed lookup with score -1000 despite an available raisin reference. This is a reproduced wording failure, not proof that the original scan used that exact term.
- Replaying the supplied nut screenshot returned `pistachios in shell`; the matching `Nuts, pistachio nuts, raw` USDA candidate was rejected with score -1000. Thus a motif that succeeded on the device can also fail due to model wording.

## Correction and limits

- Whole-term colour/seedless/dried raisin vocabulary maps to the existing generic BLS raisin reference (medium confidence), not claimed cultivar-specific laboratory values.
- Allowlisted nut identities can omit shell-presentation wording for lookup only. Preparation and salt qualifiers are retained. Detected edible grams and piece counts are not modified; this is not a shell-to-kernel weight conversion.
- No fallback to invented nutrition, zero placeholders, partial meal totals or a more expensive model. Unknown foods, coatings and transformed foods retain their rejection boundaries.
- BLS lookup precedes cached USDA misses, so these canonical BLS matches are not blocked by earlier cached nulls. No cache rows, accounts belonging to users, saved meals, policies or secrets were changed.

## Verification

- `npm install`, `npm run verify`, and `git diff --check` pass. Targeted validator covers 188 ingredient wording/source/portion cases and 29 normalizations plus negative transformation cases and unchanged edible-weight scaling.
- After correction, both entire screenshot replays resolve all detected items. The nut replay produced `pistachios in shell raw`, now mapped to BLS H250100. Original screenshots/photos are not committed.
- Deployed only `nutrition` to the linked production project. `node scripts/validate-food-wording-live.mjs --feedback-shell` passed all three authenticated production calls: 50 g green raisins = 144 kcal; 50 g golden seedless raisins = 144 kcal; 20 g edible pistachio kernels plus 30 g raw almonds = 283 kcal. These are explicit-weight reference calculations, not measurements of the photographed bowls. The disposable QA account was deleted through the production deletion endpoint.

## Remaining uncertainty

The screenshots include UI text and smaller image previews, so these replays are not equivalent to the original camera payload. Repeated raisin screenshot calls estimated 30, 50 and 35 g: identity/mapping success does not establish portion accuracy. A fresh device scan and weighed original-photo evaluation remain necessary. App Review readiness is not established by this correction.
