#!/usr/bin/env node
/**
 * Marks the meals that need no real preparation, in both catalogues.
 *
 * Quickness was read from the localised `time` string with a German-only word
 * list, so "Ohne Kochen" counted and "No cooking" did not: the same user with
 * the same data got a different answer in each language. It is a property of
 * the meal, so it belongs in the data.
 */
import { readFile, writeFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));
const german = await read('mealCatalog.de.json');

/** German is the reference: it is the language the catalogue was written in. */
const NO_PREP = /direkt|ohne kochen|mikrowelle/i;
/**
 * Eating-out entries carry a venue rather than a duration, so quickness is a
 * property of the counter you order at: a bakery hands it over, a restaurant
 * cooks it. Without this the whole eating-out context had no quick meal at
 * all, and choosing "quick" there quietly did nothing.
 */
const FAST_SERVICE = new Set(['Imbiss', 'Poke', 'Café', 'Kantine', 'Bäcker', 'Burgerladen']);
const isQuick = (meal) => {
  if (NO_PREP.test(meal.time) || FAST_SERVICE.has(meal.time)) return true;
  const minutes = Number(meal.time.match(/\d+/)?.[0] ?? Number.NaN);
  return Number.isFinite(minutes) && minutes <= 20;
};

const quick = new Set(german.filter(isQuick).map((meal) => meal.id));

let added = 0;
for (const language of ['de', 'en']) {
  const file = new URL(`../src/data/mealCatalog.${language}.json`, import.meta.url);
  const catalog = JSON.parse(await readFile(file, 'utf8'));
  for (const meal of catalog) {
    const tags = meal.tags.filter((tag) => tag !== 'quick');
    if (quick.has(meal.id)) {
      tags.push('quick');
      added += 1;
    }
    meal.tags = tags;
  }
  await writeFile(file, `${JSON.stringify(catalog, null, 2)}\n`);
}
console.log(`Tagged ${quick.size} quick meals in both catalogues (${added} tags written).`);
