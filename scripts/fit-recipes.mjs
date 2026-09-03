#!/usr/bin/env node
/**
 * Fits recipe ingredient amounts to the macros the catalogue already
 * publishes for each dish.
 *
 * A recipe that does not add up to the number shown next to it is worse than
 * no recipe: the app would be promising 520 kcal and handing over
 * instructions for 695. Hand-balancing sixty-seven of these against five
 * macros each is not something anybody does correctly, so the amounts are
 * fitted: start from a plausible draft, then hill-climb in 5 g steps within
 * bounds that keep every ingredient a sensible portion of its dish.
 *
 * Reads scripts/data/recipe-drafts.json and scripts/data/recipe-targets.json,
 * and writes src/data/recipes.json.
 */
import { readFile, writeFile } from 'node:fs/promises';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const ingredients = await read('../src/data/ingredients.json');
const drafts = await read('./data/recipe-drafts.json');
/**
 * The targets are captured once, not read from the catalogue the fit then
 * overwrites. Fitting against the live catalogue makes every re-run chase its
 * own last answer, and the amounts wander a little further each time.
 */
const targets = await read('./data/recipe-targets.json');

const MACROS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
/**
 * Calories dominate because they are the number the whole app is built on;
 * fibre is a rounding detail by comparison and must not drag the fit.
 */
const WEIGHT = { calories: 1 / 25, protein: 1 / 3, carbs: 1 / 5, fat: 1 / 2.5, fiber: 1 / 12 };
const STEP = 5;

function totals(items) {
  const sum = Object.fromEntries(MACROS.map((macro) => [macro, 0]));
  for (const [key, grams] of items) {
    const per100g = ingredients[key]?.per100g;
    if (!per100g) throw new Error(`unknown ingredient: ${key}`);
    for (const macro of MACROS) sum[macro] += (per100g[macro] ?? 0) * grams / 100;
  }
  return sum;
}

function cost(items, target) {
  const sum = totals(items);
  return MACROS.reduce((total, macro) => {
    const delta = (sum[macro] - target[macro]) * WEIGHT[macro];
    return total + delta * delta;
  }, 0);
}

/** Bounds keep a fitted amount a portion someone would actually serve. */
function boundsFor(key, draft) {
  // Oils and pastes swing the fat number hard, so they get the widest room;
  // a staple like rice or pasta should stay recognisably itself.
  const wide = /oil|butter|tahini|pesto|coconut|parmesan|almonds/.test(key);
  const low = wide ? 2 : Math.max(20, Math.round(draft * 0.55 / STEP) * STEP);
  const high = wide ? Math.max(30, Math.round(draft * 2)) : Math.round(draft * 1.5 / STEP) * STEP;
  return [low, high];
}

const fitted = {};
const report = [];
for (const [id, draft] of Object.entries(drafts)) {
  const target = targets[id];
  if (!target) throw new Error(`no captured target for ${id}`);
  const bounds = draft.map(([key, grams]) => boundsFor(key, grams));
  let items = draft.map(([key, grams]) => [key, grams]);
  let best = cost(items, target);

  // Coordinate descent: nudge one ingredient at a time until nothing helps.
  for (let pass = 0; pass < 400; pass += 1) {
    let improved = false;
    for (let index = 0; index < items.length; index += 1) {
      for (const direction of [-STEP, STEP]) {
        const next = items.map((entry) => [...entry]);
        const amount = next[index][1] + direction;
        if (amount < bounds[index][0] || amount > bounds[index][1]) continue;
        next[index][1] = amount;
        const score = cost(next, target);
        if (score < best - 1e-9) {
          items = next;
          best = score;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }

  const sum = totals(items);
  fitted[id] = {
    servings: 1,
    ingredients: items.map(([key, grams]) => ({ key, grams })),
    nutrition: Object.fromEntries(MACROS.map((macro) => [macro, Math.round(sum[macro])])),
  };
  report.push({
    id,
    ...Object.fromEntries(MACROS.map((macro) => [macro, Math.round(sum[macro]) - target[macro]])),
  });
}

await writeFile(new URL('../src/data/recipes.json', import.meta.url), `${JSON.stringify(fitted, null, 2)}\n`);

const worst = [...report].sort((a, b) => Math.abs(b.calories) - Math.abs(a.calories)).slice(0, 8);
console.log(`Fitted ${Object.keys(fitted).length} recipes.`);
console.log('Largest calorie gaps against the captured targets:');
for (const row of worst) {
  console.log(`  ${row.id}  kcal ${row.calories >= 0 ? '+' : ''}${row.calories}  P${row.protein >= 0 ? '+' : ''}${row.protein}  C${row.carbs >= 0 ? '+' : ''}${row.carbs}  F${row.fat >= 0 ? '+' : ''}${row.fat}  Fi${row.fiber >= 0 ? '+' : ''}${row.fiber}`);
}
