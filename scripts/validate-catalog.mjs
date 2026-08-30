import { readFile } from 'node:fs/promises';

const url = new URL('../src/data/mealCatalog.de.json', import.meta.url);
const catalog = JSON.parse(await readFile(url, 'utf8'));
const contexts = ['home', 'supermarket', 'eating-out'];

if (catalog.length < 40 || catalog.length > 60) throw new Error(`Expected 40–60 meals, got ${catalog.length}`);
if (new Set(catalog.map((item) => item.id)).size !== catalog.length) throw new Error('Catalog IDs must be unique');

for (const context of contexts) {
  const items = catalog.filter((item) => item.context === context);
  if (items.length < 3) throw new Error(`Context ${context} needs at least three meals`);
}

for (const item of catalog) {
  for (const field of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
    if (!Number.isFinite(item[field]) || item[field] < 0) throw new Error(`${item.id}: invalid ${field}`);
  }
  if (!item.title || !item.detail || !item.time || !Array.isArray(item.tags)) throw new Error(`${item.id}: incomplete record`);
}

console.log(`Validated ${catalog.length} Kadro catalog meals across ${contexts.length} contexts.`);

