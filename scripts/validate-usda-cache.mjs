import assert from 'node:assert/strict';

import {
  buildMealItem,
  incompleteNutritionError,
  chooseFood,
  chooseFoodMatch,
  mapUsdaFood,
  isUsableSearchTerm,
  normalizeSearchTerm,
  toFoodFacts,
  usdaCacheKey,
  USDA_MATCHER_VERSION,
} from '../server/core.mjs';
import { resolveExactBlsFacts } from '../supabase/functions/_shared/bls-reference.mjs';
import { readFileSync } from 'node:fs';

const dateFacts = resolveExactBlsFacts('dried dates');
assert.equal(dateFacts.referenceId, 'F504400');
assert.equal(dateFacts.calories, 356);
assert.deepEqual(dateFacts, resolveExactBlsFacts('dates dried'));
assert.deepEqual(dateFacts, resolveExactBlsFacts('dried pitted dates'));
assert.equal(chooseFoodMatch([{fdcId:170149,dataType:'SR Legacy',description:'Seeds, lotus seeds, dried'}],'dates dried').food,undefined);
assert.equal(chooseFoodMatch([{fdcId:170149,dataType:'SR Legacy',description:'Seeds, lotus seeds, dried'}],'dried pitted dates').food,undefined);
assert.notEqual(resolveExactBlsFacts('date raw')?.referenceId, dateFacts.referenceId);
assert.equal(resolveExactBlsFacts('bitter linden cones'), null);
const dates = buildMealItem({name:'Datteln',estimatedGrams:50},dateFacts,0);
assert.equal(dates.calories,178);
assert.equal(incompleteNutritionError([dates]),null);
const unknown = buildMealItem({name:'Unknown',estimatedGrams:50},null,1);
assert.equal(incompleteNutritionError([dates,unknown]).status,422);
assert.equal(incompleteNutritionError([unknown]).body.code,'missing_nutrition');
assert.equal(incompleteNutritionError([]).status,422);
assert.equal(incompleteNutritionError([{calories:0,protein:0,carbs:0,fat:0,source:{referenceId:'water'}}]),null);
assert.equal(incompleteNutritionError([{...dates,protein:NaN}]).status,422);
for (const file of ['server/index.mjs','supabase/functions/nutrition/index.ts']) {
  const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.match(source,/const nutritionError = incompleteNutritionError\(items\);\s*if \(nutritionError\) return ingredientCorrectionDraft\(detection, items, correctionProtocol\) \?\? nutritionError;/);
  assert.match(source,/chooseFoodMatch\(\(result.foods \|\| \[\]\)\.filter/);
}

/** Shapes a USDA search hit the way FoodData Central returns one. */
function usdaFood(fdcId, { calories, protein, carbs, fat, fiber }) {
  return {
    fdcId,
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, value: calories },
      { nutrientId: 1003, value: protein },
      { nutrientId: 1005, value: carbs },
      { nutrientId: 1004, value: fat },
      { nutrientId: 1079, value: fiber },
    ],
  };
}

/** Round-trips facts through the columns the cache table actually stores. */
function throughCacheTable(facts) {
  if (!facts) return null;
  const numeric = (value) => Number(Number(value).toFixed(2));
  return {
    provider: 'usda',
    referenceId: String(facts.referenceId),
    label: `USDA FDC ${facts.referenceId}`,
    matchConfidence: 'high',
    calories: numeric(facts.calories),
    protein: numeric(facts.protein),
    carbs: numeric(facts.carbs),
    fat: numeric(facts.fat),
    fiber: numeric(facts.fiber),
  };
}

const failures = [];

// Actual Foundation honeydew shape: no legacy Energy 1008, both Atwater IDs.
const melon = usdaFood(2710816, { protein: 0.531, carbs: 8.15, fat: 0.216, fiber: 0 });
melon.foodNutrients.push({ nutrientId: 2047, value: 36.7 }, { nutrientId: 2048, value: 32.9 });
assert.equal(toFoodFacts(melon).calories, 32.9);
assert.equal(buildMealItem({ name: 'Honigmelone', estimatedGrams: 1000 }, toFoodFacts(melon), 0).calories, 329);
assert.equal(toFoodFacts({ foodNutrients: [{ nutrientId: 1003, value: 1 }] }), null);
assert.equal(toFoodFacts(usdaFood(2, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })).calories, 0);
const detail = { fdcId: 3, foodNutrients: [{ nutrient: { id: 2047 }, amount: 36.7 }, ...melon.foodNutrients.filter(n => ![1008, 2047, 2048].includes(n.nutrientId))] };
assert.equal(toFoodFacts(detail).calories, 36.7);
const corrupt = buildMealItem({ name: 'Melon', estimatedGrams: 1000 }, { ...toFoodFacts(melon), calories: 0 }, 0);
assert.equal(corrupt.included, false, 'zero-energy legacy cache with macros must never count as valid food');
const preciseMelon = buildMealItem({ name: 'Melon', estimatedGrams: 25 }, toFoodFacts(melon), 0);
assert.equal(preciseMelon.nutritionPer100g.protein, 0.531, 'portion edits retain source precision');

// 1. The cache key must not depend on how the model spaced or cased the term.
const variants = ['Grilled Chicken Breast', 'grilled chicken breast', '  GRILLED   chicken breast  '];
const keys = new Set(variants.map(normalizeSearchTerm));
if (keys.size !== 1) failures.push(`normalizeSearchTerm produced ${keys.size} keys for one term`);
if (normalizeSearchTerm(undefined) !== '') failures.push('normalizeSearchTerm must tolerate missing terms');
// Pin the prefix to the exported constant, not to a literal: hard-coding "v2"
// meant that bumping the matcher failed this check instead of the stale
// entries it was meant to protect.
if (new Set(variants.map(usdaCacheKey)).size !== 1
  || !usdaCacheKey(variants[0]).startsWith(`v${USDA_MATCHER_VERSION}:`)) {
  failures.push('versioned cache keys must be stable and carry the current matcher version');
}
if (!Number.isInteger(USDA_MATCHER_VERSION) || USDA_MATCHER_VERSION < 1) {
  failures.push('USDA_MATCHER_VERSION must be a positive integer');
}
// A placeholder term must never become a cache key: one poisoned "other" row
// priced an entire plate from a single entry.
for (const bad of ['other', 'unknown', '', 'food']) {
  if (isUsableSearchTerm(bad)) failures.push(`"${bad}" must never reach the USDA cache`);
}

// 2. A cached lookup must produce byte-identical items to a fresh one. This is
//    the whole point: caching may save requests, never change a number.
const cases = [
  ['chicken', { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0 }, 180],
  ['rice', { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 }, 220],
  ['avocado', { calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7 }, 70],
  ['olive oil', { calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0 }, 12],
  ['lentils', { calories: 116, protein: 9.02, carbs: 20.13, fat: 0.38, fiber: 7.9 }, 300],
];

cases.forEach(([name, per100g, grams], index) => {
  const food = usdaFood(100000 + index, per100g);
  const item = { nameDe: name, searchTermEn: name, estimatedGrams: grams, confidence: 'high', optional: false };

  const fresh = mapUsdaFood(item, food, index);
  const cached = buildMealItem(item, throughCacheTable(toFoodFacts(food)), index);

  try {
    assert.deepEqual(cached, fresh, `${name}: cached result differs from a fresh lookup`);
  } catch (error) {
    failures.push(error.message);
  }
});

// 3. A miss must stay a miss: flagged optional, zeroed, and never silently
//    presented as a confident value.
const missItem = { nameDe: 'Unbekannte Sauce', searchTermEn: 'mystery sauce', estimatedGrams: 30, confidence: 'high', optional: false };
const missFresh = mapUsdaFood(missItem, undefined, 7);
const missCached = buildMealItem(missItem, null, 7);
try {
  assert.deepEqual(missCached, missFresh, 'a cached miss differs from a fresh miss');
  assert.equal(missCached.calories, 0, 'a miss must not invent calories');
  assert.equal(missCached.optional, true, 'a miss must be flagged for review');
  assert.equal(missCached.confidence, 'medium', 'a miss must not claim high confidence');
} catch (error) {
  failures.push(error.message);
}

// 4. Portion scaling must survive the numeric(9,2) rounding of the table.
const precise = usdaFood(200001, { calories: 116.666, protein: 9.024, carbs: 20.135, fat: 0.384, fiber: 7.901 });
const preciseItem = { nameDe: 'Linsen', searchTermEn: 'lentils', estimatedGrams: 333, confidence: 'high', optional: false };
const preciseFresh = mapUsdaFood(preciseItem, precise, 0);
const preciseCached = buildMealItem(preciseItem, throughCacheTable(toFoodFacts(precise)), 0);
for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
  if (Math.abs(preciseCached[key] - preciseFresh[key]) > 1) {
    failures.push(`${key} drifted by more than 1 g/kcal through cache rounding`);
  }
}

// 5. Relevance must beat data type. These are the real shapes api.nal.usda.gov
//    returns; ranking by data type alone picked "Fried broccoli" (223 kcal) over
//    "Broccoli, raw" (39 kcal), and the cache would have served that for months.
const matchCases = [
  ['broccoli', [
    ['Survey (FNDDS)', 'Fried broccoli'],
    ['Survey (FNDDS)', 'Broccoli, raw'],
    ['Survey (FNDDS)', 'Beef and broccoli'],
    ['Branded', 'BROCCOLI'],
  ], ['broccoli', 'broccoli, raw']],
  ['white rice', [
    ['Survey (FNDDS)', 'Rice pudding'],
    ['Survey (FNDDS)', 'Fried rice'],
    ['SR Legacy', 'White rice, cooked'],
    ['Survey (FNDDS)', 'Rice and beans'],
  ], ['white rice, cooked']],
  ['olive oil', [
    ['Survey (FNDDS)', 'Bread dipped in olive oil'],
    ['Foundation', 'Olive oil'],
    ['Branded', 'OLIVE OIL MAYONNAISE'],
  ], ['olive oil']],
  ['scrambled egg', [
    ['Survey (FNDDS)', 'Egg, scrambled, with cheese and ham'],
    ['Survey (FNDDS)', 'Scrambled egg'],
    ['Branded', 'SCRAMBLED EGG BREAKFAST BURRITO'],
  ], ['scrambled egg']],
];

for (const [term, rows, acceptable] of matchCases) {
  const foods = rows.map(([dataType, description], index) => ({ fdcId: 900000 + index, dataType, description }));
  const chosen = chooseFood(foods, term);
  const picked = normalizeSearchTerm(chosen?.description);
  if (!acceptable.includes(picked)) {
    failures.push(`"${term}" resolved to "${chosen?.description}" instead of one of: ${acceptable.join(', ')}`);
  }
}

// A result must still be relevant even if USDA only returns one row. Blindly
// accepting an unrelated single candidate is how bad values become confident.
if (chooseFood([], 'anything') !== undefined) failures.push('an empty USDA result must resolve to nothing');
if (chooseFood([{ fdcId: 1, dataType: 'Branded', description: 'ANYTHING' }], 'x') !== undefined) {
  failures.push('an unrelated single USDA candidate must be rejected');
}

const ambiguous = chooseFoodMatch([
  { fdcId: 1, dataType: 'Survey (FNDDS)', description: 'Chicken breast, cooked, skinless' },
  { fdcId: 2, dataType: 'Survey (FNDDS)', description: 'Chicken breast, cooked, boneless' },
], 'chicken breast');
if (ambiguous.confidence !== 'medium' || ambiguous.cacheable) {
  failures.push('a close USDA tie may be shown for review but must never enter the shared cache');
}

if (failures.length) {
  throw new Error(`USDA cache validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${cases.length + 1} cached USDA lookups and ${matchCases.length} relevance rankings: identical results, misses stay flagged, rounding within 1.`);
