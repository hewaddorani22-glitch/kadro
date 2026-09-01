# Nutrition accuracy

Kandro keeps GPT-4.1-mini as the cost-controlled recognition model. The model
identifies food, preparation, likely hidden calories, and portion size; it does
not provide calories or macros. Nutrition comes from reviewed databases.

## Resolution order

1. **BLS 4.0 composite dish:** 64 common German meals have an exact
   Bundeslebensmittelschlüssel reference. When the complete dish matches, the
   gateway scales its published per-100-g values to the detected portion.
2. **USDA ingredient fallback:** unmatched dishes are split into ingredients.
   The matcher considers name coverage, preparation, extra food terms, source
   type, and the margin to the next candidate. Only high-confidence choices
   enter the shared 90-day cache.
3. **User review:** the confirmation screen exposes the estimated grams, source,
   optional ingredients, and correction controls. Hidden oil/sauce and wide
   portion ranges produce a warning.

The BLS snapshot is from Max Rubner-Institut, Bundeslebensmittelschlüssel 4.0
(2025), licensed CC BY 4.0, DOI
`10.25826/Data20251217-134202-0`. The source download is
<https://blsdb.de/download>.

## German evaluation set

`src/data/germanMealEvaluation.mjs` provides 64 weighed text cases spanning
Döner, pizza, pasta, Maultaschen, schnitzel, soups, egg dishes, breakfast,
desserts, burgers, wraps, rice dishes, fish, and meat. Every case contains:

- a German input with an explicit gram amount;
- BLS code, version, license, and DOI;
- published per-100-g calories and macros;
- exact expected values for the weighed portion.

`npm run validate:german` verifies all 64 mappings, the model schema's allowed
keys, source attribution, scaling, nutrition plausibility, ten independent BLS
spot values, and a pinned snapshot checksum. It makes database mapping
regressions visible without spending model credits.

## What “accurate” means

For a weighed portion of the same standardized BLS recipe, the calculation is
deterministic. A photo alone cannot reveal exact weight, absorbed frying oil,
sauce below the food, recipe ratios, or brand formulation. Therefore an honest
photo benchmark must be captured separately:

1. weigh every ingredient and cooking fat before serving;
2. photograph the exact finished plate with the same iPhone flow;
3. compare detected ingredients, grams, calories, and macros with the weighed
   ground truth;
4. report median absolute percentage error and the 90th percentile separately
   for plain, mixed, restaurant, and sauce-heavy dishes;
5. never tune on the final holdout photos.

The existing 64 cases are strong nutrition-reference tests, not substitutes for
the pending real-photo study. The external beta gate remains at least 30 weighed
iPhone meals, with more cases added when a recurring failure pattern appears.
