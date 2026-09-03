#!/usr/bin/env node
/**
 * A recipe that does not add up to the number printed beside it is worse than
 * no recipe: the app would promise 520 kcal and hand over instructions for
 * 695. Every home dish's macros are therefore the sum of its own ingredients,
 * and this checks that the sum, the stored recipe and both catalogues still
 * say the same thing.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
const recipes = await read('recipes.json');
const ingredients = await read('ingredients.json');
const names = await read('ingredientNames.json');
const steps = await read('recipeSteps.json');
const catalogs = { de: await read('mealCatalog.de.json'), en: await read('mealCatalog.en.json') };

const MACROS = ['calories', 'protein', 'carbs', 'fat', 'fiber'];
const problems = [];

// --- Every ingredient is sourced and named ---------------------------------
for (const [key, record] of Object.entries(ingredients)) {
  if (!record.usda && !record.off) problems.push(`${key}: no USDA id and no Open Food Facts barcode`);
  if (!names[key]?.de || !names[key]?.en) problems.push(`${key}: missing a name in one language`);
  for (const macro of MACROS) {
    const value = record.per100g?.[macro];
    if (!Number.isFinite(value) || value < 0) problems.push(`${key}: per-100 g ${macro} is not a number`);
  }
  if (record.per100g.calories === 0 && key !== 'water') {
    problems.push(`${key}: zero calories, which usually means the lookup matched nothing`);
  }
}
for (const key of Object.keys(names)) {
  if (!ingredients[key]) problems.push(`${key}: named but not in the sourced table`);
}

// --- Every home dish has a recipe, and only home dishes do ------------------
const homeIds = catalogs.de.filter((meal) => meal.context === 'home').map((meal) => meal.id);
for (const id of homeIds) {
  if (!recipes[id]) problems.push(`${id}: a dish you cook with no instructions`);
}
for (const id of Object.keys(recipes)) {
  if (!homeIds.includes(id)) problems.push(`${id}: a recipe for something that is bought, not cooked`);
}

// --- The arithmetic ---------------------------------------------------------
for (const [id, recipe] of Object.entries(recipes)) {
  assert.ok(recipe.ingredients.length >= 3, `${id}: a recipe needs more than two ingredients`);
  const sum = Object.fromEntries(MACROS.map((macro) => [macro, 0]));
  for (const { key, grams } of recipe.ingredients) {
    const record = ingredients[key];
    if (!record) {
      problems.push(`${id}: unknown ingredient "${key}"`);
      continue;
    }
    if (!Number.isInteger(grams) || grams < 2 || grams > 500) {
      problems.push(`${id}: ${grams} g of ${key} is not a portion anybody serves`);
    }
    for (const macro of MACROS) sum[macro] += (record.per100g[macro] ?? 0) * grams / 100;
  }
  for (const macro of MACROS) {
    const computed = Math.round(sum[macro]);
    if (recipe.nutrition[macro] !== computed) {
      problems.push(`${id}: stored ${macro} ${recipe.nutrition[macro]} but the ingredients add up to ${computed}`);
    }
    for (const [language, catalog] of Object.entries(catalogs)) {
      const meal = catalog.find((entry) => entry.id === id);
      if (meal && meal[macro] !== computed) {
        problems.push(`${id} (${language}): the catalogue says ${macro} ${meal[macro]}, the recipe makes ${computed}`);
      }
    }
  }

  // --- The prose ------------------------------------------------------------
  const text = steps[id];
  if (!text) {
    problems.push(`${id}: ingredients but no method`);
    continue;
  }
  for (const language of ['de', 'en']) {
    const list = text[language];
    if (!Array.isArray(list) || list.length < 3) {
      problems.push(`${id} (${language}): fewer than three steps is not a method`);
      continue;
    }
    for (const step of list) {
      if (typeof step !== 'string' || step.trim().length < 15) {
        problems.push(`${id} (${language}): a step too short to follow`);
      }
    }
  }
  if (text.de?.length !== text.en?.length) {
    problems.push(`${id}: the two languages describe a different number of steps`);
  }
}

if (problems.length) {
  console.error('Recipe check failed:');
  for (const problem of problems.slice(0, 30)) console.error(`  - ${problem}`);
  if (problems.length > 30) console.error(`  … and ${problems.length - 30} more`);
  process.exit(1);
}
console.log(`Validated ${Object.keys(recipes).length} recipes: every macro is the sum of ${Object.keys(ingredients).length} sourced ingredients, and both catalogues agree.`);
