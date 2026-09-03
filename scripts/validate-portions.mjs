#!/usr/bin/env node
/**
 * Portion entry is where a wrong number becomes a wrong day: "2" bananas that
 * silently means 2 g, or a comma that parses as nothing at all. These checks
 * pin down the arithmetic and the portion list the gateway hands the picker.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (await readFile(resolve(projectRoot, 'src/utils/portions.ts'), 'utf8'))
  .replace(/^import[^;]+;$/gm, '');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { resolveGrams, scaleNutrition } = await import(
  `data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`
);
const { usdaPortions } = await import(resolve(projectRoot, 'supabase/functions/_shared/nutrition.mjs'));

const banana = { label: '1 banana', grams: 126 };

// --- Counting portions ------------------------------------------------------
assert.equal(resolveGrams('1', banana), 126);
assert.equal(resolveGrams('2', banana), 252);
assert.equal(resolveGrams('0.5', banana), 63);
// A German keyboard writes the same half portion with a comma.
assert.equal(resolveGrams('1,5', banana), 189, 'a comma decimal must count as a decimal');
assert.equal(resolveGrams('1.5', banana), 189);

// --- Plain grams ------------------------------------------------------------
assert.equal(resolveGrams('150'), 150);
assert.equal(resolveGrams('150,5'), 151);

// --- Refusals ---------------------------------------------------------------
for (const bad of ['', ' ', '0', '-2', 'abc', '99999']) {
  assert.equal(resolveGrams(bad), null, `"${bad}" must not become an amount`);
}
assert.equal(resolveGrams('100', banana), null, '100 bananas is past the ceiling, not a portion');

// --- Scaling ----------------------------------------------------------------
const per100 = { calories: 97, protein: 1.1, carbs: 23, fat: 0.3 };
assert.deepEqual(scaleNutrition(per100, 100), { calories: 97, protein: 1, carbs: 23, fat: 0 });
assert.deepEqual(scaleNutrition(per100, 252), { calories: 244, protein: 3, carbs: 58, fat: 1 });
assert.equal(scaleNutrition(per100, 0).calories, 0);

// --- What the gateway offers ------------------------------------------------
const measured = usdaPortions({
  foodMeasures: [
    { disseminationText: '1 cup, mashed', gramWeight: 225, rank: 1 },
    { disseminationText: '1 banana', gramWeight: 126, rank: 2 },
    { disseminationText: 'Quantity not specified', gramWeight: 126, rank: 3 },
    { disseminationText: '1 slice', gramWeight: 6, rank: 4 },
  ],
});
assert.deepEqual(measured, [{ label: '1 banana', grams: 126 }, { label: '1 slice', grams: 6 }],
  'cups and USDA placeholders are not portions a person recognises');

assert.deepEqual(
  usdaPortions({ servingSize: 52, servingSizeUnit: 'g', householdServingFullText: '1 CONTAINER' }),
  [{ label: '1 container', grams: 52 }],
  'branded household text must not shout');

assert.deepEqual(usdaPortions({}), []);
assert.deepEqual(usdaPortions(null), []);
assert.deepEqual(usdaPortions({ servingSize: 3, servingSizeUnit: 'IU', householdServingFullText: '1 pill' }), [],
  'a serving measured in something other than grams is not a weight');
assert.ok(usdaPortions({ foodMeasures: Array.from({ length: 9 }, (_, i) => ({ disseminationText: `1 piece ${i}`, gramWeight: 10 + i, rank: i })) }).length <= 4,
  'a picker with nine units is a picker nobody reads');

console.log('Portion arithmetic and portion lists check out.');
