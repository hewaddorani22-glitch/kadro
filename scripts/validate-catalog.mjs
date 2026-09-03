import { readFile } from 'node:fs/promises';

const load = async (name) =>
  JSON.parse(await readFile(new URL(`../src/data/${name}`, import.meta.url), 'utf8'));

const catalogs = {
  de: await load('mealCatalog.de.json'),
  en: await load('mealCatalog.en.json'),
};
const dietaryTerms = await load('dietaryTerms.json');

const contexts = ['home', 'supermarket', 'eating-out'];
const tags = ['high-protein', 'pescetarian', 'vegan', 'vegetarian'];
const idPrefixes = { home: 'home', supermarket: 'market', 'eating-out': 'out' };

// Same source the app uses, so a term added for one language cannot drift.
const porkWords = new RegExp(dietaryTerms.pork.join('|'), 'i');
const lactoseWords = new RegExp(dietaryTerms.lactose.join('|'), 'i');
/** "without cheese" names an absence; matching it would hide a safe meal. */
const negated = /\b(?:ohne|without|no)\s+\S+/gi;
const dietaryCopy = (item) => `${item.title} ${item.detail}`.replace(negated, ' ');

const numericRanges = {
  calories: [350, 700],
  protein: [18, 65],
  carbs: [20, 100],
  fat: [5, 30],
  // Three, not four: a tomato risotto and a fish-with-rice plate genuinely
  // land there once the fibre is summed from sourced ingredients.
  fiber: [3, 25],
};

function rank(catalog, context, remaining, preference) {
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

const budgets = [
  { calories: 1600, protein: 120, fat: 60 },
  { calories: 1300, protein: 95, fat: 45 },
  { calories: 1000, protein: 75, fat: 35 },
  { calories: 800, protein: 55, fat: 28 },
  { calories: 600, protein: 40, fat: 20 },
  { calories: 450, protein: 30, fat: 15 },
];
const preferences = [null, ...tags];
let recommendationSets = 0;
const coverage = {};

for (const [language, catalog] of Object.entries(catalogs)) {
  const fail = (message) => {
    throw new Error(`${language} catalog: ${message}`);
  };

  if (catalog.length !== 200) fail(`expected exactly 200 meals, got ${catalog.length}`);
  if (new Set(catalog.map((item) => item.id)).size !== catalog.length) fail('IDs must be unique');

  for (const item of catalog) {
    if (!contexts.includes(item.context)) fail(`${item.id}: invalid context`);
    if (!new RegExp(`^${idPrefixes[item.context]}-\\d{2,3}$`).test(item.id)) {
      fail(`${item.id}: invalid ID for ${item.context}`);
    }
    for (const [field, [minimum, maximum]] of Object.entries(numericRanges)) {
      if (!Number.isInteger(item[field]) || item[field] < minimum || item[field] > maximum) {
        fail(`${item.id}: ${field} must be an integer from ${minimum} to ${maximum}`);
      }
    }
    const macroCalories = item.protein * 4 + item.carbs * 4 + item.fat * 9;
    if (Math.abs(item.calories - macroCalories) > 100) {
      fail(`${item.id}: calories differ too far from its macros`);
    }
    if (![item.title, item.detail, item.time].every((value) => typeof value === 'string' && value.trim())) {
      fail(`${item.id}: incomplete text`);
    }
    if (!Array.isArray(item.tags) || item.tags.length < 1 || item.tags.some((tag) => !tags.includes(tag))) {
      fail(`${item.id}: invalid tags`);
    }
  }

  if (new Set(catalog.map((item) => item.title.trim().toLowerCase())).size !== catalog.length) {
    fail('titles must be unique');
  }

  const contextSizes = [];
  for (const context of contexts) {
    const items = catalog.filter((item) => item.context === context);
    contextSizes.push(items.length);
    if (items.length < 66) fail(`context ${context} needs at least 66 meals`);
    for (const tag of tags) {
      if (items.filter((item) => item.tags.includes(tag)).length < 10) {
        fail(`context ${context} needs at least ten ${tag} meals`);
      }
    }
    const vegetarian = items.filter((item) => item.tags.some((tag) => tag === 'vegetarian' || tag === 'vegan'));
    const lactoseFree = items.filter((item) => !lactoseWords.test(dietaryCopy(item)));
    const porkFree = items.filter((item) => !porkWords.test(dietaryCopy(item)));
    const vegetarianLactoseFree = vegetarian.filter((item) => !lactoseWords.test(dietaryCopy(item)));
    for (const [preference, matches] of Object.entries({ vegetarian, lactoseFree, porkFree, vegetarianLactoseFree })) {
      if (matches.length < 3) fail(`${context}: fewer than three meals satisfy ${preference}`);
    }
  }
  if (Math.max(...contextSizes) - Math.min(...contextSizes) > 1) fail('contexts must stay balanced');

  const selectedIds = new Set();
  for (const remaining of budgets) {
    for (const preference of preferences) {
      for (const context of contexts) {
        const first = rank(catalog, context, remaining, preference);
        const second = rank(catalog, context, remaining, preference);
        if (first.length !== 3 || new Set(first.map((item) => item.id)).size !== 3) {
          fail(`${context}: ranking must return three unique meals`);
        }
        if (first.some((item) => item.context !== context)) fail(`${context}: ranking leaked another context`);
        if (first.map((item) => item.id).join() !== second.map((item) => item.id).join()) {
          fail(`${context}: ranking must be deterministic`);
        }
        if (preference && !first.some((item) => item.tags.includes(preference))) {
          fail(`${context}: ranking ignored ${preference}`);
        }
        first.forEach((item) => selectedIds.add(item.id));
        recommendationSets += 1;
      }
    }
  }
  if (selectedIds.size < 80) fail(`ranking coverage is too narrow: only ${selectedIds.size} meals reached the top three`);
  coverage[language] = selectedIds;
}

// --- The two catalogues must describe the same meals -----------------------
// Only the prose differs. If the macros or the tags drifted, a German and an
// English user with the same budget would be told to eat different things, and
// only one of the two sets would have been reviewed.
const [de, en] = [catalogs.de, catalogs.en];
const byId = (catalog) => new Map(catalog.map((item) => [item.id, item]));
const deById = byId(de);
const enById = byId(en);
if (deById.size !== enById.size) throw new Error('catalogues have different sizes');
for (const [id, german] of deById) {
  const english = enById.get(id);
  if (!english) throw new Error(`${id} is missing from the English catalog`);
  for (const field of ['context', 'calories', 'protein', 'carbs', 'fat', 'fiber']) {
    if (german[field] !== english[field]) {
      throw new Error(`${id}: ${field} differs between languages (${german[field]} vs ${english[field]})`);
    }
  }
  if (german.tags.join() !== english.tags.join()) throw new Error(`${id}: tags differ between languages`);
  if (german.title === english.title) throw new Error(`${id}: title was never translated`);
  if (german.detail === english.detail) throw new Error(`${id}: detail was never translated`);
}

// The dietary filters have to exclude the same meals in both languages,
// otherwise one language silently serves pork or dairy to someone avoiding it.
for (const [label, pattern] of [['pork', porkWords], ['lactose', lactoseWords]]) {
  const matching = (catalog) => new Set(catalog.filter((item) => pattern.test(dietaryCopy(item))).map((item) => item.id));
  const german = matching(de);
  const english = matching(en);
  const differing = [...german].filter((id) => !english.has(id)).concat([...english].filter((id) => !german.has(id)));
  if (differing.length) {
    throw new Error(`the ${label} filter matches different meals per language: ${differing.sort().join(', ')}`);
  }
  if (!german.size) throw new Error(`the ${label} filter matches nothing at all — the word list is broken`);
}

// Both languages must recommend the same meals: the ranking uses only numbers.
for (const language of ['de', 'en']) {
  if ([...coverage[language]].sort().join() !== [...coverage.de].sort().join()) {
    throw new Error(`${language} recommends a different set of meals than German`);
  }
}

console.log(`Validated ${de.length} Kandro catalog meals in 2 languages across ${contexts.length} contexts.`);
console.log(`Validated ${recommendationSets} deterministic recommendation sets; ${coverage.de.size} meals reached the top three.`);
console.log('Validated that both catalogs describe the same meals and that the pork and lactose filters match identically.');
