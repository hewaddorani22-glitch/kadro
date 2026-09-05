# Missing nutrition follow-up

USDA live reproduction: `dried dates` and `dates dried` failed the old confidence threshold (45.5) and had no fallback variants. `buildMealItem(null)` produced an excluded zero-nutrient item, which the successful analysis response still exposed in the UI.

Initial live validation additionally exposed a wrong non-zero mapping: the date description resolved to USDA 170149, `Seeds, lotus seeds, dried`. This was not accepted as a passing nutrition result. The matcher now requires identity tokens independently of scoring, so shared preparation words cannot authorize a different food. Cache version 7 prevents reuse of earlier misses and wrong references.

Exact unambiguous English BLS ingredient names supplement dish references. Word order/plural and pitted variants resolve dried dates to existing BLS F504400. Raw and dried remain distinct, and fuzzy candidate search is not used for automatic BLS assignment. Incomplete USDA candidates are excluded before selection.

Both local and hosted gateways reject any unresolved ingredient with 422/missing_nutrition, including mixed meals. Unknown sentinel zeros cannot be returned as a successful partial meal. Genuine zero-valued complete references remain permitted. Failed analyses follow the existing allowance refund path. Client validation additionally rejects old unmatched responses, and EN/DE error copy explains the next action; these client changes require a future binary.

Final hosted model test passed: explicit 50 g dried pitted dates returned 178 kcal, BLS F504400; banana plus the reported unfamiliar ingredient returned 422/missing_nutrition. Test account deleted. This proves the tested description path, not arbitrary photo recognition or portion accuracy. The first mixed test was nondeterministic before the final matcher/prompt changes; the final test and deterministic mixed-sentinel regressions passed.

The `nutrition` function is deployed. Existing saved meals are not rewritten. No new TestFlight build or App Review was submitted in this follow-up.

Full `npm run verify` passed after the final changes (`/tmp/kandro-zero-final2-verify.log`), including captured USDA rankings and the new exact-date, wrong-food, complete-zero and mixed-incomplete regression cases. Hosted verification output: `/tmp/kandro-zero-live-final.log`.
