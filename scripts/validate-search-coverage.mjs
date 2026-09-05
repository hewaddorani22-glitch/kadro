#!/usr/bin/env node
/**
 * The catalogue answers most German queries without touching the network, and
 * that shortcut is what makes search fast and free. It is also what makes a
 * bad match expensive: "pho" prefix-matches the phosphate in a curing salt,
 * and returning that used to end the search before Open Food Facts was asked,
 * so three million products sat behind four letters that happened to line up.
 *
 * This pins down the difference between answering a question and starting with
 * the same letters, and that only the first kind may end the search.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { searchBlsCatalog } = await import('../supabase/functions/_shared/bls-search.mjs');
const gateway = readFileSync(new URL('../supabase/functions/nutrition/index.ts', import.meta.url), 'utf8');
const problems = [];

// --- Real foods must match strongly ----------------------------------------
const strongCases = [
  ['tofu', 'de'], ['falafel', 'de'], ['haferflocken', 'de'], ['döner', 'de'],
  ['currywurst', 'de'], ['sushi', 'de'], ['fischstäbchen', 'de'], ['lahmacun', 'de'],
  ['magerquark', 'de'], ['hähnchenbrust', 'de'], ['baklava', 'de'], ['hummus', 'de'],
  ['gyros', 'de'], ['guacamole', 'de'], ['burrito', 'de'], ['kefir', 'de'],
  ['chicken breast', 'en'], ['oats', 'en'], ['broccoli', 'en'],
];
for (const [query, language] of strongCases) {
  const hits = searchBlsCatalog(query, language, 5);
  if (!hits.length) { problems.push(`"${query}" finds nothing in the catalogue`); continue; }
  if (!hits.some((hit) => hit.strong)) {
    problems.push(`"${query}" only matches by prefix: ${hits[0][language === 'de' ? 'nameDe' : 'nameEn']}`);
  }
}

// --- A prefix coincidence must not claim to be an answer -------------------
{
  const hits = searchBlsCatalog('pho', 'de', 5);
  if (hits.some((hit) => hit.strong)) {
    problems.push('"pho" is treated as a real catalogue match, so the network is never asked');
  }
}

// --- Every returned row carries the flag ------------------------------------
for (const hit of searchBlsCatalog('reis', 'de', 5)) {
  assert.equal(typeof hit.strong, 'boolean', 'a catalogue row lost its match-strength flag');
}

// --- Only a real match may end the search -----------------------------------
assert.match(gateway, /const catalogueAnswered = catalogue\.some\(\(food\) => food\.strong\)/,
  'the gateway no longer distinguishes a real match from a prefix one');
assert.match(gateway, /if \(results\.length && catalogueAnswered\)/,
  'any catalogue hit ends the search again, however weak');
// And a weak row must not sit above whatever the network found.
assert.match(gateway, /else weakRows\.push/, 'weak rows are mixed in with the real results again');
const appends = (gateway.match(/appendWeak\(\);/g) ?? []).length;
assert.ok(appends >= 2, `weak rows are appended on ${appends} of the return paths, expected every one`);

if (problems.length) {
  console.error('Search coverage check failed:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`Search coverage: ${strongCases.length} everyday and international dishes match the catalogue outright, and a prefix coincidence no longer ends the search.`);
