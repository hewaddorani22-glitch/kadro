/**
 * Ranks real USDA search responses and checks the winner is actually the food
 * that was asked for.
 *
 * The responses in scripts/fixtures were captured from FoodData Central, so
 * these are the rows the gateway really has to choose between. Two of them
 * used to go to the wrong food: "rice cooked" picked "Rice noodles, cooked"
 * and "broccoli cooked" picked "Broccoli raab, cooked" — a different grain and
 * a different vegetable, each with a different calorie density.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { chooseFoodMatch, rankFoodMatches } from '../server/core.mjs';

const fixtures = JSON.parse(
  await readFile(new URL('./fixtures/usda-search-responses.json', import.meta.url), 'utf8'),
);

/**
 * `require` words must appear in the winning description, `reject` words must
 * not: they name a different food that USDA lists under a similar label.
 */
const expectations = {
  'apple raw': { require: ['apple'], reject: ['juice', 'sauce', 'pie'], kcal: [45, 70] },
  'broccoli cooked': { require: ['broccoli'], reject: ['raab', 'chinese', 'soup', 'casserole'], kcal: [20, 50] },
  'chicken breast grilled': { require: ['chicken'], reject: ['soup', 'salad', 'sandwich'], kcal: [105, 200] },
  'egg boiled': { require: ['egg'], reject: ['salad', 'substitute'], kcal: [130, 175] },
  'olive oil': { require: ['oil'], reject: ['salad dressing'], kcal: [850, 950] },
  'pasta cooked': { require: ['pasta'], reject: ['salad', 'sauce'], kcal: [120, 190] },
  'potato boiled': { require: ['potato'], reject: ['salad', 'chips', 'sweet'], kcal: [70, 145] },
  'rice cooked': { require: ['rice'], reject: ['noodle', 'pudding', 'soup', 'milk'], kcal: [95, 155] },
  'salmon baked': { require: ['salmon'], reject: ['salad', 'patty', 'cake'], kcal: [150, 300] },
  // Single-word queries are where user-submitted Branded rows used to win: an
  // all-caps "BANANA" at 336 kcal is dried chips, not a banana.
  banana: { require: ['banana'], reject: ['chip', 'pudding', 'split', 'cake', 'nectar', 'dehydrated', 'powder'], kcal: [80, 105] },
  bread: { require: ['bread'], reject: ['pudding', 'stuffing', 'crumb'], kcal: [220, 300] },
  milk: { require: ['milk'], reject: ['shake', 'condensed', 'powder'], kcal: [30, 75] },
  'chicken breast': { require: ['chicken'], reject: ['soup', 'salad', 'sandwich', 'nugget'], kcal: [100, 210] },
};

const kcal = (food) => food?.foodNutrients?.find((n) => [1008, 208].includes(n.nutrientId))?.value;

let checked = 0;
for (const [term, expectation] of Object.entries(expectations)) {
  const foods = fixtures[term];
  assert.ok(foods?.length, `no captured USDA response for "${term}"`);

  const match = chooseFoodMatch(foods, term);
  assert.ok(match.food, `"${term}" found no match at all in a response that contains one`);

  const description = String(match.food.description).toLowerCase();
  for (const word of expectation.require) {
    assert.ok(description.includes(word), `"${term}" matched "${match.food.description}", which is not ${word}`);
  }
  for (const word of expectation.reject) {
    assert.ok(!description.includes(word), `"${term}" matched "${match.food.description}" — that is a different food`);
  }

  // A match the gateway would price at zero is worse than no match at all,
  // and a plausible-looking row with the wrong density is worse still: USDA
  // averages cooking fat into its "NS as to form" entries, which put cooked
  // broccoli at 63 kcal/100 g instead of 41.
  const calories = kcal(match.food);
  const [low, high] = expectation.kcal;
  assert.ok(typeof calories === 'number', `"${term}" matched a row with no calories`);
  assert.ok(
    calories >= low && calories <= high,
    `"${term}" matched "${match.food.description}" at ${calories} kcal/100 g, outside the plausible ${low}–${high}`,
  );
  checked += 1;
}

// The ranking must not depend on the order USDA happened to return.
for (const [term, foods] of Object.entries(fixtures)) {
  const forward = chooseFoodMatch(foods, term);
  const reversed = chooseFoodMatch([...foods].reverse(), term);
  assert.equal(
    forward.food?.fdcId,
    reversed.food?.fdcId,
    `"${term}" ranked differently when the response order changed`,
  );
}

// --- USDA writes in the plural ---------------------------------------------
// "banana" shared no token with "Bananas, raw" and scored zero, which is how a
// Branded row of dried chips came to win.
for (const [term, singularOf] of [['banana', 'bananas'], ['apple raw', 'apples']]) {
  const match = chooseFoodMatch(fixtures[term], term);
  assert.ok(
    String(match.food.description).toLowerCase().includes(singularOf.slice(0, -1)),
    `"${term}" must match the plural entry "${singularOf}"`,
  );
}

// --- Search returns a shortlist, not one answer ----------------------------
for (const [term, expectation] of Object.entries(expectations)) {
  const list = rankFoodMatches(fixtures[term], term, 8);
  assert.ok(list.length >= 1, `"${term}" returned an empty shortlist`);
  const first = String(list[0].description).toLowerCase();
  for (const word of expectation.require) {
    assert.ok(first.includes(word), `"${term}" put "${list[0].description}" first, which is not ${word}`);
  }
  // Every row must be about the food asked for; a list with oysters in a
  // broccoli search is worse than a short list.
  for (const food of list) {
    const description = String(food.description).toLowerCase();
    assert.ok(
      expectation.require.some((word) => description.includes(word)),
      `"${term}" offered "${food.description}", which is a different food`,
    );
  }
  const descriptions = list.map((food) => String(food.description).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
  assert.equal(new Set(descriptions).size, descriptions.length, `"${term}" offered the same row twice`);
}

// --- A bare food word must lead with that food ----------------------------
// USDA's own relevance for "rice" returns crackers, cakes and paper, and plain
// cooked rice is not in the first twenty-five rows. These fixtures hold the
// merged probes the gateway sends, so this pins the outcome the user sees.
for (const [term, expectation] of Object.entries({
  rice: { require: ['rice'], reject: ['cracker', 'cake', 'paper', 'milk', 'pudding', 'noodle'], kcal: [95, 155] },
  broccoli: { require: ['broccoli'], reject: ['raab', 'chinese', 'soup', 'cheese'], kcal: [20, 50] },
})) {
  const list = rankFoodMatches(fixtures[term], term, 8);
  assert.ok(list.length, `a search for "${term}" returned nothing`);
  const first = list[0];
  const description = String(first.description).toLowerCase();
  for (const word of expectation.require) {
    assert.ok(description.includes(word), `"${term}" led with "${first.description}"`);
  }
  for (const word of expectation.reject) {
    assert.ok(!description.includes(word), `"${term}" led with "${first.description}", which is a dish made from it`);
  }
  const calories = kcal(first);
  assert.ok(
    calories >= expectation.kcal[0] && calories <= expectation.kcal[1],
    `"${term}" led with ${calories} kcal/100 g, outside the plausible ${expectation.kcal.join('–')}`,
  );
}

// A search must never offer a different food just because the preparation
// matched. USDA has no steamed broccoli at all, and the response is full of
// steamed fish and shellfish.
const steamed = rankFoodMatches(fixtures['broccoli steamed'], 'broccoli steamed', 8);
for (const food of steamed) {
  assert.match(
    String(food.description).toLowerCase(),
    /broccoli/,
    `a search for steamed broccoli offered "${food.description}"`,
  );
}

// A term that names no food must be rejected rather than matched to anything.
for (const bad of ['other', 'unknown', '']) {
  const match = chooseFoodMatch(fixtures['rice cooked'], bad);
  assert.equal(match.food, undefined, `"${bad}" must not match a food`);
}

console.log(`Validated ${checked} USDA rankings against captured responses, plus order independence and placeholder rejection.`);
