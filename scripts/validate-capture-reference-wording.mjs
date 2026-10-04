import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { BLS_SEARCH_ROWS } from '../supabase/functions/_shared/bls-search-data.mjs';
import * as names from '../supabase/functions/_shared/bls-names.mjs';
import { buildMealItem } from '../supabase/functions/_shared/nutrition.mjs';

// Optional old source permits a real red/green run against a frozen candidate.
// The resolver and BLS rows are actual code/data; no lookup response is mocked.
const queryPath = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2]))
  : new URL('../supabase/functions/_shared/food-query.mjs', import.meta.url);
const query = await import(queryPath);
const source = fs.readFileSync(new URL('../supabase/functions/_shared/bls-reference.mjs', import.meta.url), 'utf8');
const module = { exports: {} };
const dependencies = {
  './food-query.mjs': query,
  './bls-search-data.mjs': { BLS_SEARCH_ROWS },
  './bls-names.mjs': names,
};
new Function('require', 'module', 'exports', ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(name => {
  assert.ok(name in dependencies, `Unexpected resolver dependency ${name}`);
  return dependencies[name];
}, module, module.exports);
const { resolveBlsFacts, resolveExactBlsFacts } = module.exports;
let passed = 0, failed = 0;
function test(label, fn) {
  try { fn(); passed++; console.log('PASS', label); }
  catch (error) { failed++; console.error('FAIL', label, error.message); }
}

test('ordinary white bread roll uses the existing plain wheat-roll row without changing 70 g', () => {
  for (const name of ['Brötchen', 'white bread roll']) {
    const detected = { name, searchTermEn: 'white bread roll', referenceKey: 'other', estimatedGrams: 70, confidence: 'medium' };
    const snapshot = JSON.stringify(detected);
    const facts = resolveBlsFacts(detected);
    assert.equal(facts?.referenceId, 'B511000');
    const row = BLS_SEARCH_ROWS.find(row => row[0] === 'B511000');
    assert.equal(row[1], 'Weizenbrötchen');
    assert.equal(facts.calories, row[3]);
    const item = buildMealItem(detected, facts, 0);
    assert.equal(item.amountG, 70); assert.equal(item.baseAmountG, 70);
    assert.equal(item.calories, 196); assert.equal(item.confidence, 'medium');
    assert.equal(JSON.stringify(detected), snapshot);
  }
  for (const term of ['white bread rolls', 'plain white bread roll']) {
    assert.equal(resolveExactBlsFacts(term)?.referenceId, 'B511000');
  }
});

test('shredding raw carrot is presentation; existing raw carrot source and grams survive', () => {
  for (const term of ['carrot raw shredded', 'raw shredded carrots', 'shredded raw carrot', 'raw grated carrot', 'carrots grated raw']) {
    const detected = { name: 'shredded carrot', searchTermEn: term, referenceKey: 'other', estimatedGrams: 30.5, confidence: 'medium' };
    const snapshot = JSON.stringify(detected);
    const facts = resolveBlsFacts(detected);
    assert.equal(facts?.referenceId, 'G620100', term);
    assert.equal(facts.description, 'Carrot raw');
    const row = BLS_SEARCH_ROWS.find(row => row[0] === 'G620100');
    assert.deepEqual([facts.calories, facts.protein, facts.carbs, facts.fat, facts.fiber], row.slice(3));
    const item = buildMealItem(detected, facts, 0);
    assert.equal(item.amountG, 30.5); assert.equal(item.baseAmountG, 30.5);
    assert.equal(item.calories, Math.round(40 * .305));
    assert.equal(item.name, detected.name); assert.equal(JSON.stringify(detected), snapshot);
  }
});

test('brands, toppings, sweet/wholegrain/gluten-free rolls are never reduced to plain wheat rolls', () => {
  for (const term of [
    'cheese roll', 'white bread roll with cheese', 'sweet white bread roll', 'cinnamon roll',
    'whole wheat bread roll', 'whole grain white bread roll', 'rye white bread roll',
    'gluten free white bread roll', 'rice white bread roll', 'Acme white bread roll',
    'toasted white bread roll', 'white bread roll with sesame',
  ]) {
    assert.equal(query.canonicalFoodQuery(term), query.normalizeFoodQuery(term), term);
    assert.notEqual(resolveExactBlsFacts(term)?.referenceId, 'B511000', term);
  }
});

test('carrot cooking, dressing, products and unknown preparation cannot turn into raw carrot', () => {
  for (const term of [
    'carrot cake raw shredded', 'carrot salad raw shredded with oil', 'raw shredded carrots with oil',
    'cooked shredded carrot', 'boiled shredded carrot', 'fried shredded carrot', 'dried shredded carrot',
    'raw shredded carrot juice', 'Acme raw shredded carrot', 'shredded carrot',
  ]) {
    assert.equal(query.canonicalFoodQuery(term), query.normalizeFoodQuery(term), term);
    assert.notEqual(resolveExactBlsFacts(term)?.referenceId, 'G620100', term);
  }
  assert.equal(query.canonicalFoodQuery('skyr'), 'skyr');
  assert.equal(resolveExactBlsFacts('skyr'), null);
});
console.log(JSON.stringify({ passed, failed, externalCalls: 0, source: String(queryPath) }));
if (failed) process.exitCode = 1;
