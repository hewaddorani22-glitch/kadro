import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalFoodQuery } from '../supabase/functions/_shared/food-query.mjs';
import { resolveExactBlsFacts, resolveBlsFacts } from '../supabase/functions/_shared/bls-reference.mjs';
import { BLS_SEARCH_ROWS } from '../supabase/functions/_shared/bls-search-data.mjs';
import { buildMealItem, chooseFoodMatch, incompleteNutritionError, searchTermVariants } from '../server/core.mjs';

const normalization = [
  ['whole grain bread slice', 'whole grain bread'],
  ['2 slices of wholegrain bread', 'whole grain bread'],
  ['30 grams of dried raisins', 'raisins'],
  ['raisins dried', 'raisins'], ['sultanas', 'raisins'],
  ['chopped almonds raw', 'almonds raw'],
  ['chick peas boiled', 'chickpeas boiled'],
  ['garbanzo beans cooked', 'chickpeas cooked'],
  ['aubergine grilled', 'eggplant grilled'],
  ['courgette raw', 'zucchini raw'],
  ['milk 2% fat', 'milk 2% fat'], ['2% fat milk', '2% fat milk'],
  ['rice cooked', 'rice cooked'], ['rice raw', 'rice raw'],
  ['almond milk unsweetened', 'almond milk unsweetened'],
  ['chicken breast ground', 'chicken breast ground'],
  ['raisins green dried', 'raisins'],
  ['green seedless raisins', 'raisins'],
  ['raisins (golden, seedless)', 'raisins'],
  ['pistachios in shell', 'pistachios'],
  ['raw pistachios in their shells', 'raw pistachios'],
  ['unshelled almonds', 'almonds'],
  ['shelled almonds raw', 'almonds raw'],
  ['pistachios roasted salted in shell', 'pistachios roasted salted'],
  ['shell-on pistachios dry roasted unsalted', 'pistachios dry roasted unsalted'],
  ['peanuts in shell oil roasted', 'peanuts oil roasted'],
  ['taco shells', 'taco shells'],
  ['shrimp in shell', 'shrimp in shell'],
  ['almond milk with shells', 'almond milk with shells'],
];
for (const [input, expected] of normalization) {
  assert.equal(canonicalFoodQuery(input), expected, input);
  assert.equal(canonicalFoodQuery(expected), expected, `idempotence: ${input}`);
}

const groups = [
  ['K280100', ['potato chips', 'potato crisps']],
  ['X654042', ['French fries']],
  ['F840100', ['raisins', 'dried raisins', 'raisins dried', 'sultanas', 'golden raisins', 'raisins green dried', 'green seedless raisins', 'dried green sultanas', 'brown raisins seedless']],
  ['H210100', ['almonds', 'raw almonds', 'almonds raw', 'sweet almonds raw']],
  ['H170100', ['cashews', 'raw cashews', 'cashew nuts raw']],
  ['H180100', ['brazil nut', 'brazil nuts raw']],
  ['H130100', ['hazelnut', 'raw hazelnuts']],
  ['H120100', ['walnut', 'raw walnuts']],
  ['H250100', ['pistachios', 'raw pistachio nuts', 'pistachios in shell', 'raw pistachios in their shells', 'shelled pistachios']],
  ['C133000', ['rolled oats', 'rolled oats raw', 'oat flakes raw']],
  ['F533100', ['honeydew melon', 'honeydew melon raw']],
  ['F504400', ['dried dates', 'dates dried', 'dried pitted dates']],
  ['S145000', ['chocolate hazelnut spread', 'hazelnut cocoa spread', 'nutella']],
  ['C352032', ['white rice cooked']],
  ['C350222', ['steamed white rice']],
  ['C351032', ['cooked brown rice']],
  ['V416172', ['chicken breast grilled', 'boneless skinless chicken breast grilled']],
  ['E111132', ['hard-boiled eggs', 'soft boiled eggs']],
  ['M141300', ['plain whole milk yogurt 3.5% fat', 'plain yogurt 3.5% fat']],
];
assert.equal(resolveBlsFacts({ name: 'Kartoffelchips', searchTermEn: 'French fries' }).referenceId, 'K280100');
assert.equal(resolveBlsFacts({ name: 'Pommes frites', searchTermEn: 'potato chips' }).referenceId, 'X654042');
let checks = 0;
for (const [code, terms] of groups) {
  const reference = BLS_SEARCH_ROWS.find(row => row[0] === code);
  assert.ok(reference);
  for (const term of terms) {
    for (const wording of [term, `${term} pieces`, `50 g of ${term}`, term.toUpperCase()]) {
      const facts = resolveExactBlsFacts(wording);
      assert.equal(facts?.referenceId, code, wording);
      assert.deepEqual([facts.calories, facts.protein, facts.carbs, facts.fat], reference.slice(3, 7));
      const item = buildMealItem({ name: wording, estimatedGrams: 50, confidence: 'high' }, facts, 0);
      assert.equal(item.calories, Math.round(reference[3] / 2));
      assert.equal(incompleteNutritionError([item]), null);
      checks++;
    }
  }
}
for (const [term, forbiddenCode] of [
  ['raisin bread', 'F840100'], ['grapes raw', 'F840100'],
  ['raisins chocolate coated', 'F840100'], ['almond milk', 'H210100'],
  ['bitter almonds', 'H210100'], ['almonds roasted salted', 'H210100'],
  ['cashew butter', 'H170100'], ['walnut oil', 'H120100'],
  ['hazelnut butter pure', 'S145000'], ['dates raw', 'F504400'],
  ['honeydew honey', 'F533100'], ['oat flour', 'C133000'],
  ['green raisins chocolate coated', 'F840100'], ['green grapes dried with oil', 'F840100'],
  ['green raisin bread', 'F840100'], ['raisins green sweetened', 'F840100'],
  ['raisins boiled', 'F840100'], ['raisins in rum', 'F840100'],
  ['pistachios roasted salted in shell', 'H250100'], ['bitter almonds in shell', 'H210100'],
]) assert.notEqual(resolveExactBlsFacts(term)?.referenceId, forbiddenCode, term);
assert.equal(resolveExactBlsFacts('green raisins')?.matchConfidence, 'medium', 'variety alias is a generic estimate, not an exact cultivar analysis');
// Replayed screenshot detection returned 9 pistachios / 20 edible grams.
// Lookup normalization must not alter counts, grams or pretend shells add kcal.
const shellDetection = {name:'Pistazien mit Schale', searchTermEn:'pistachios in shell', referenceKey:'other', estimatedGrams:20, pieceCount:9, pieceLabel:'1 Pistazie', confidence:'medium'};
const shellSnapshot = structuredClone(shellDetection);
const shellItem = buildMealItem(shellDetection, resolveBlsFacts(shellDetection), 0);
assert.equal(shellItem.amountG,20);
assert.equal(shellItem.calories,120);
assert.equal(incompleteNutritionError([shellItem]), null);
assert.deepEqual(shellDetection,shellSnapshot);
assert.equal(resolveBlsFacts({ referenceKey: 'other', searchTermEn: 'bitter linden cones' }), null);
assert.equal(resolveBlsFacts({ referenceKey: 'other', searchTermEn: 'unknown' }), null);
assert.equal(resolveBlsFacts({ referenceKey: 'fried_egg', searchTermEn: 'hard boiled egg' }).referenceId, 'E111132');
assert.notEqual(resolveBlsFacts({ referenceKey: 'fried_egg', searchTermEn: 'egg boiled' }).referenceId, 'Y710142');
assert.equal(resolveBlsFacts({ referenceKey: 'fried_egg', searchTermEn: 'turkey egg poached' }), null);
assert.notEqual(resolveExactBlsFacts('plain yogurt 0% fat')?.referenceId, 'M141300');
assert.notEqual(resolveExactBlsFacts('plain yogurt 5.3% fat')?.referenceId, 'M141300');
assert.equal(resolveExactBlsFacts('plain yogurt 3,5% fat')?.referenceId, 'M141300');
assert.notEqual(resolveExactBlsFacts('greek yogurt 3.5% fat')?.referenceId, 'M141300');
assert.equal(incompleteNutritionError([buildMealItem({name:'Unknown',estimatedGrams:50},null,0)]).status,422);

// Captured failure shape: the model returns a portion word that USDA doesn't.
const bread = {fdcId:172688, dataType:'SR Legacy', description:'Bread, whole-wheat, commercially prepared'};
assert.ok(chooseFoodMatch([bread], 'whole wheat bread slice').food);
assert.equal(chooseFoodMatch([{...bread,description:'Rice noodles, cooked'}], 'rice cooked').food, undefined,
  'a generic query must not turn into a different compound food');
assert.equal(chooseFoodMatch([{...bread,description:'Seeds, lotus seeds, dried'}], 'dried dates').food, undefined);
assert.deepEqual(searchTermVariants('rice boiled'), ['rice cooked']);
for (const term of ['rice cooked','dates dried','almonds roasted','salmon fried']) {
  assert.ok(!searchTermVariants(term).includes(term.split(' ')[0]), `lost preparation: ${term}`);
}
for (const path of ['server/index.mjs', 'supabase/functions/nutrition/index.ts']) {
  const source = readFileSync(new URL('../'+path, import.meta.url),'utf8');
  assert.match(source, /canonicalFoodQuery\(item.searchTermEn\)/, `${path}: model wording bypasses normalizer`);
  assert.match(source, /pageSize: 25, dataType: \['Foundation', 'SR Legacy', 'Survey \(FNDDS\)'\]/,
    `${path}: generic analysis must not be dominated by branded rows`);
}
console.log(`Validated ${checks} ingredient-wording/source/portion cases, ${normalization.length} normalizations, food-identity and preparation rejection boundaries.`);
