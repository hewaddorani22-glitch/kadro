# Build 13 nutrition feedback correction

Date: 2026-09-05. Backend-only correction, compatible with installed Build 13. No new native build or App Review submission.

## Evidence and causes

All three owner TestFlight screenshots showed `missing_nutrition`: raisins, a mixed nut bowl, and typed bread/Nutella. Screenshot inspection does not reveal the model's original structured response or establish the exact failing nut query.

Live reproduction of the typed input returned `whole grain bread slice`; the identity matcher required `slice` to appear in the USDA food name. A separate live USDA query for `raisins dried` rejected the existing Raisins row (score 45.5, threshold 52). A wider live pass found two additional false rejections (plain yogurt 3.5% and grilled chicken) and a harmful successful mapping: hard-boiled eggs were assigned the model's `fried_egg` BLS key.

## Correction

- Shared lookup-only normalization of portions and equivalent vocabulary; display text and quantities remain untouched.
- Reviewed whole-term BLS aliases use existing source rows for nuts, dried fruit, oats, dairy and prepared ingredients. Generic aliases are medium-confidence references, not brand-exact nutrition.
- Concrete ingredient/preparation references override contradictory model dish keys. Egg keys independently require compatible preparation.
- Generic USDA queries request 25 Foundation/SR Legacy/Survey rows; branded rows no longer crowd out generic candidates. Names such as broiler/fryer no longer obscure a chicken-breast match.
- Reject incompatible food transformations and raw/cooked contradictions. No generic retry that simply removes preparation. Unknown foods and incomplete nutrient data still fail closed.
- BLS exact keys retain decimal numbers atomically: 3.5% fat must not collide with 5.3%.
- USDA cache namespace advanced to v8; no destructive cache deletion or nutrition-history rewrite.

## Verification

- `npm install` and full `npm run verify` passed.
- 160 new ingredient wording/source/portion variants, 16 normalizations and negative identity/preparation cases pass. Existing 13 captured USDA rankings and all 66 BLS dish reference checks pass.
- The BLS validator now supplies the actual English food term instead of an `unused` placeholder. This exercises the newly required food/preparation consistency.
- Second live local-gateway/model pass: 8/8 descriptions returned complete sourced results, including both DE/EN bread/spread, raisins, mixed nuts, boiled eggs, oats/yogurt and rice/chicken. This is a small regression sample, not a visual-accuracy percentage.
- Deployed only `nutrition` to the linked production Supabase project with existing JWT/auth/consent/rate controls unchanged.
- Production authenticated pass: 50 g wholegrain bread + 20 g Nutella reference = 225 kcal; 50 g raisins = 144 kcal; 100 g boiled eggs + 30 g almonds = 307 kcal. These are sourced reference estimates, not measurements of the owner's meals. All three returned HTTP 200 and complete ingredient references. Disposable QA account was deleted through the production account-deletion endpoint.

## Remaining gate

The original camera photos were requested for an exact replay. The feedback screenshots contain reduced previews; no exact original-photo replay or weighed image-accuracy study was completed here. The owner should take a fresh scan in Build 13, not rely on a previous failed request. Arbitrary food identity, invisible ingredients and portion mass cannot be guaranteed from one photo. No claim of universal accuracy, food-safety certification or App Review readiness is made.
