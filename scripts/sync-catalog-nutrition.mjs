#!/usr/bin/env node
/**
 * Writes each recipe's computed nutrition into both catalogues.
 *
 * The home dishes' macros used to be asserted; now they are the sum of
 * sourced ingredient values, so the recipe and the number printed beside it
 * cannot disagree. Run after fit-recipes.mjs.
 */
import { readFile, writeFile } from 'node:fs/promises';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const recipes = await read('../src/data/recipes.json');

let changed = 0;
for (const language of ['de', 'en']) {
  const file = new URL(`../src/data/mealCatalog.${language}.json`, import.meta.url);
  const catalog = JSON.parse(await readFile(file, 'utf8'));
  for (const meal of catalog) {
    const recipe = recipes[meal.id];
    if (!recipe) continue;
    for (const [macro, value] of Object.entries(recipe.nutrition)) {
      if (meal[macro] !== value) changed += 1;
      meal[macro] = value;
    }
  }
  await writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`Synced ${Object.keys(recipes).length} recipes into both catalogues (${changed} values updated).`);
