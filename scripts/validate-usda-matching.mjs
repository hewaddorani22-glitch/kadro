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

import { chooseFoodMatch } from '../server/core.mjs';

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

// A term that names no food must be rejected rather than matched to anything.
for (const bad of ['other', 'unknown', '']) {
  const match = chooseFoodMatch(fixtures['rice cooked'], bad);
  assert.equal(match.food, undefined, `"${bad}" must not match a food`);
}

console.log(`Validated ${checked} USDA rankings against captured responses, plus order independence and placeholder rejection.`);
