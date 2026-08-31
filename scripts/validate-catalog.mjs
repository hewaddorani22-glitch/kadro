import { readFile } from 'node:fs/promises';

const url = new URL('../src/data/mealCatalog.de.json', import.meta.url);
const catalog = JSON.parse(await readFile(url, 'utf8'));
const contexts = ['home', 'supermarket', 'eating-out'];
const tags = ['high-protein', 'pescetarian', 'vegan', 'vegetarian'];
const idPrefixes = { home: 'home', supermarket: 'market', 'eating-out': 'out' };
const porkWords = /schwein|speck|schinken|salami/i;
const lactoseWords = /skyr|joghurt|käse|quark|kefir|milch|mozzarella|ricotta|halloumi|frischkäse/i;
const numericRanges = {
  calories: [350, 700],
  protein: [18, 65],
  carbs: [20, 100],
  fat: [5, 30],
  fiber: [4, 25],
};

if (catalog.length !== 200) throw new Error(`Expected exactly 200 meals, got ${catalog.length}`);
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
  if (items.length < 66) throw new Error(`Context ${context} needs at least 66 meals`);
  for (const tag of tags) {
    if (items.filter((item) => item.tags.includes(tag)).length < 10) {
      throw new Error(`Context ${context} needs at least ten ${tag} meals`);
    }
  }
  const vegetarian = items.filter((item) => item.tags.some((tag) => tag === 'vegetarian' || tag === 'vegan'));
  const lactoseFree = items.filter((item) => !lactoseWords.test(`${item.title} ${item.detail}`));
  const porkFree = items.filter((item) => !porkWords.test(`${item.title} ${item.detail}`));
  const vegetarianLactoseFree = vegetarian.filter((item) => !lactoseWords.test(`${item.title} ${item.detail}`));
  for (const [preference, matches] of Object.entries({ vegetarian, lactoseFree, porkFree, vegetarianLactoseFree })) {
    if (matches.length < 3) throw new Error(`${context}: fewer than three meals satisfy ${preference}`);
  }
}
if (Math.max(...contextSizes) - Math.min(...contextSizes) > 1) throw new Error('Catalog contexts must stay balanced');

const budgets = [
  { calories: 1600, protein: 120, fat: 60 },
  { calories: 1300, protein: 95, fat: 45 },
  { calories: 1000, protein: 75, fat: 35 },
  { calories: 800, protein: 55, fat: 28 },
  { calories: 600, protein: 40, fat: 20 },
  { calories: 450, protein: 30, fat: 15 },
];
const preferences = [null, ...tags];
const selectedIds = new Set();
let recommendationSets = 0;

function rank(context, remaining, preference) {
  const calorieTarget = Math.min(550, Math.max(380, remaining.calories * 0.38));
  const proteinTarget = Math.min(45, Math.max(28, remaining.protein * 0.48));
  return catalog
    .filter((item) => item.context === context)
    .map((item) => {
      const distance = Math.abs(item.calories - calorieTarget) / 80
        + Math.abs(item.protein - proteinTarget) / 12
        + Math.max(0, item.fat - remaining.fat * 0.35) / 10;
      return { item, score: distance + (preference && item.tags.includes(preference) ? -1.5 : 0) };
    })
    .sort((a, b) => a.score - b.score || a.item.id.localeCompare(b.item.id))
    .slice(0, 3)
    .map(({ item }) => item);
}

for (const remaining of budgets) {
  for (const preference of preferences) {
    for (const context of contexts) {
      const first = rank(context, remaining, preference);
      const second = rank(context, remaining, preference);
      if (first.length !== 3 || new Set(first.map((item) => item.id)).size !== 3) {
        throw new Error(`${context}: ranking must return three unique meals`);
      }
      if (first.some((item) => item.context !== context)) throw new Error(`${context}: ranking leaked another context`);
      if (first.map((item) => item.id).join() !== second.map((item) => item.id).join()) {
        throw new Error(`${context}: ranking must be deterministic`);
      }
      if (preference && !first.some((item) => item.tags.includes(preference))) {
        throw new Error(`${context}: ranking ignored ${preference}`);
      }
      first.forEach((item) => selectedIds.add(item.id));
      recommendationSets += 1;
    }
  }
}

if (selectedIds.size < 80) throw new Error(`Ranking coverage is too narrow: only ${selectedIds.size} meals reached the top three`);

console.log(`Validated ${catalog.length} Kadro catalog meals across ${contexts.length} contexts.`);
console.log(`Validated ${recommendationSets} deterministic recommendation sets; ${selectedIds.size} meals reached the top three.`);
