import { readFile } from 'node:fs/promises';

const url = new URL('../src/data/mealCatalog.de.json', import.meta.url);
const catalog = JSON.parse(await readFile(url, 'utf8'));
const contexts = ['home', 'supermarket', 'eating-out'];
const tags = ['high-protein', 'pescetarian', 'vegan', 'vegetarian'];
const idPrefixes = { home: 'home', supermarket: 'market', 'eating-out': 'out' };
const numericRanges = {
  calories: [350, 700],
  protein: [18, 65],
  carbs: [20, 100],
  fat: [5, 30],
  fiber: [4, 25],
};

if (catalog.length < 90 || catalog.length > 200) throw new Error(`Expected 90–200 meals, got ${catalog.length}`);
if (new Set(catalog.map((item) => item.id)).size !== catalog.length) throw new Error('Catalog IDs must be unique');

for (const item of catalog) {
  if (!contexts.includes(item.context)) throw new Error(`${item.id}: invalid context`);
  if (!new RegExp(`^${idPrefixes[item.context]}-\\d{2,3}$`).test(item.id)) throw new Error(`${item.id}: invalid ID for ${item.context}`);
  for (const [field, [minimum, maximum]] of Object.entries(numericRanges)) {
    if (!Number.isInteger(item[field]) || item[field] < minimum || item[field] > maximum) {
      throw new Error(`${item.id}: ${field} must be an integer from ${minimum} to ${maximum}`);
    }
  }
  const macroCalories = item.protein * 4 + item.carbs * 4 + item.fat * 9;
  if (Math.abs(item.calories - macroCalories) > 100) {
    throw new Error(`${item.id}: calories differ too far from its macros`);
  }
  if (![item.title, item.detail, item.time].every((value) => typeof value === 'string' && value.trim())) {
    throw new Error(`${item.id}: incomplete text`);
  }
  if (!Array.isArray(item.tags) || item.tags.length < 1 || item.tags.some((tag) => !tags.includes(tag))) {
    throw new Error(`${item.id}: invalid tags`);
  }
}

if (new Set(catalog.map((item) => item.title.trim().toLocaleLowerCase('de-DE'))).size !== catalog.length) {
  throw new Error('Catalog titles must be unique');
}

const contextSizes = [];
for (const context of contexts) {
  const items = catalog.filter((item) => item.context === context);
  contextSizes.push(items.length);
  if (items.length < 25) throw new Error(`Context ${context} needs at least 25 meals`);
  for (const tag of tags) {
    if (items.filter((item) => item.tags.includes(tag)).length < 2) {
      throw new Error(`Context ${context} needs at least two ${tag} meals`);
    }
  }
}
if (Math.max(...contextSizes) - Math.min(...contextSizes) > 1) throw new Error('Catalog contexts must stay balanced');

console.log(`Validated ${catalog.length} Kadro catalog meals across ${contexts.length} contexts.`);
