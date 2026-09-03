#!/usr/bin/env node
/**
 * Resolves the recipe ingredient vocabulary against USDA FoodData Central and
 * writes src/data/ingredients.json.
 *
 * Recipes are only worth showing if their numbers agree with the numbers the
 * app already promised for the dish. That is only possible if every ingredient
 * has a sourced per-100 g value rather than one somebody remembered, so this
 * runs once, records the FDC id it used, and the result is checked in.
 *
 * Run with: node scripts/build-ingredients.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';

const key = (await readFile(new URL('../.env', import.meta.url), 'utf8'))
  .split('\n').find((line) => line.startsWith('USDA_API_KEY='))?.slice('USDA_API_KEY='.length).trim();
if (!key) throw new Error('USDA_API_KEY missing from .env');

/** [ingredient key, USDA query, preferred data types] */
const WANTED = [
  // Protein
  ['chicken-breast', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted'],
  ['turkey-breast', 'Turkey, breast, meat only, roasted'],
  ['turkey-mince', 'Turkey, ground, cooked'],
  ['beef-lean', 'Beef, round, top round, separable lean only, cooked, braised'],
  ['beef-mince-lean', 'Beef, ground, 93% lean meat, cooked, pan-browned'],
  ['salmon', 'Fish, salmon, Atlantic, farmed, cooked, dry heat'],
  ['cod', 'Fish, cod, Atlantic, cooked, dry heat'],
  ['pollock', 'Fish, pollock, Alaska, cooked'],
  ['tuna-canned', 'Fish, tuna, light, canned in water, drained solids'],
  ['prawns', 'Crustaceans, shrimp, cooked'],
  ['egg', 'Egg, whole, cooked, hard-boiled'],
  ['tofu', 'Tofu, firm, prepared with calcium sulfate and magnesium chloride'],
  ['tempeh', 'Tempeh'],
  // Dairy
  ['skyr', 'Yogurt, Icelandic style, plain, nonfat'],
  ['yoghurt-plain', 'Yogurt, plain, low fat'],
  ['cottage-cheese', 'Cheese, cottage, lowfat, 2% milkfat'],
  ['cream-cheese-light', 'Cheese, cream, low fat'],
  ['feta', 'Cheese, feta'],
  ['ricotta', 'Cheese, ricotta, part skim milk'],
  ['parmesan', 'Cheese, parmesan, grated'],
  ['milk-lowfat', 'Milk, lowfat, fluid, 1% milkfat'],
  // Grains and starch
  ['rice-white-cooked', 'Rice, white, long-grain, regular, enriched, cooked'],
  ['rice-basmati-cooked', 'Rice, white, long-grain, regular, enriched, cooked'],
  ['rice-risotto-dry', 'Rice, white, short-grain, raw'],
  ['pasta-wholegrain-cooked', 'Pasta, whole-wheat, cooked'],
  ['pasta-cooked', 'Pasta, cooked, enriched'],
  ['rice-noodles-cooked', 'Noodles, rice, cooked'],
  ['couscous-cooked', 'Couscous, cooked'],
  ['bulgur-cooked', 'Bulgur, cooked'],
  ['quinoa-cooked', 'Quinoa, cooked'],
  ['oats-dry', 'Oats, raw'],
  ['semolina-dry', 'Semolina, enriched'],
  ['potato-cooked', 'Potatoes, boiled, cooked without skin, flesh, without salt'],
  ['sweet-potato-cooked', 'Sweet potato, cooked, baked in skin, flesh, without salt'],
  ['gnocchi', 'Gnocchi, potato'],
  ['bread-wholegrain', 'Bread, whole-wheat, commercially prepared'],
  ['bread-rye', 'Bread, rye'],
  ['flatbread', 'Bread, pita, white, enriched'],
  ['lasagne-sheets-dry', 'Pasta, dry, enriched'],
  // Pulses
  ['lentils-cooked', 'Lentils, mature seeds, cooked, boiled, without salt'],
  ['lentils-red-dry', 'Lentils, raw'],
  ['chickpeas-cooked', 'Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt'],
  ['black-beans-cooked', 'Beans, black, mature seeds, cooked, boiled, without salt'],
  ['kidney-beans-cooked', 'Beans, kidney, all types, mature seeds, cooked, boiled, without salt'],
  ['white-beans-cooked', 'Beans, white, mature seeds, cooked, boiled, without salt'],
  ['peas-cooked', 'Peas, green, cooked, boiled, drained, without salt'],
  // Vegetables
  ['broccoli-cooked', 'Broccoli, cooked, boiled, drained, without salt'],
  ['spinach-cooked', 'Spinach, cooked, boiled, drained, without salt'],
  ['spinach-raw', 'Spinach, raw'],
  ['tomato-raw', 'Tomatoes, red, ripe, raw, year round average'],
  ['tomato-passata', 'Tomato products, canned, puree, without salt added'],
  ['bell-pepper', 'Peppers, sweet, red, raw'],
  ['courgette', 'Squash, summer, zucchini, includes skin, raw'],
  ['aubergine-cooked', 'Eggplant, cooked, boiled, drained, without salt'],
  ['carrot', 'Carrots, raw'],
  ['onion', 'Onions, raw'],
  ['leek', 'Leeks, (bulb and lower leaf-portion), raw'],
  ['mushrooms', 'Mushrooms, white, raw'],
  ['cucumber', 'Cucumber, with peel, raw'],
  ['rocket', 'Arugula, raw'],
  ['lettuce', 'Lettuce, cos or romaine, raw'],
  ['red-cabbage', 'Cabbage, red, raw'],
  ['pak-choi', 'Cabbage, chinese (pak-choi), raw'],
  ['green-beans-cooked', 'Beans, snap, green, cooked, boiled, drained, without salt'],
  ['sweetcorn', 'Corn, sweet, yellow, canned, drained solids'],
  ['mixed-stirfry-veg', 'Vegetables, mixed, frozen, cooked, boiled, drained, without salt'],
  ['salsa', 'Sauce, salsa, ready-to-serve'],
  ['olives', 'Olives, ripe, canned (small-extra large)'],
  // Fruit
  ['banana', 'Bananas, raw'],
  ['berries-mixed', 'Strawberries, raw'],
  ['plums', 'Plums, raw'],
  ['apple', 'Apples, raw, with skin'],
  ['lemon-juice', 'Lemon juice, raw'],
  // Fats, nuts, extras
  ['olive-oil', 'Oil, olive, salad or cooking'],
  ['rapeseed-oil', 'Oil, canola'],
  ['almonds', 'Nuts, almonds'],
  ['peanut-butter', 'Peanut butter, smooth style, without salt'],
  ['tahini', 'Seeds, sesame butter, tahini'],
  ['pesto', 'Sauce, pesto, ready-to-serve, refrigerated'],
  ['coconut-milk-light', 'Nuts, coconut milk, canned'],
  ['soy-sauce', 'Soy sauce made from soy and wheat (shoyu)'],
  ['mustard', 'Mustard, prepared, yellow'],
];

/**
 * Three ingredients USDA simply does not carry. Matching them anyway gave
 * "Magerquark" the values of a beef flank steak and halloumi those of Monterey
 * Jack — wrong enough to make every recipe using them wrong. Open Food Facts
 * has all three, and a barcode is as citable as an FDC id.
 */
const OFF_SOURCED = [
  ['quark-lowfat', '7061318012171'],
  ['halloumi', '5291803005148'],
  ['seitan', '5600722732057'],
];

const search = async (query) => {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, pageSize: 12, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] }),
  });
  if (!response.ok) throw new Error(`usda_${response.status} for ${query}`);
  return (await response.json()).foods || [];
};

const NUTRIENTS = { 1008: 'calories', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber' };

const out = {};
const missing = [];
for (const [id, query] of WANTED) {
  const foods = await search(query);
  // Prefer the row whose description is closest to the query asked for.
  const wanted = query.toLowerCase();
  // Some Foundation rows carry no energy value at all, in either the search
  // payload or the detail record. A row without calories is not a candidate.
  const withEnergy = foods.filter((food) =>
    (food.foodNutrients || []).some((nutrient) => nutrient.nutrientId === 1008));
  const best = (withEnergy.length ? withEnergy : foods)
    .map((food) => {
      const description = String(food.description || '').toLowerCase();
      const shared = wanted.split(/[\s,]+/).filter((word) => word.length > 2 && description.includes(word)).length;
      return { food, score: shared - Math.abs(description.length - wanted.length) / 200 };
    })
    .sort((a, b) => b.score - a.score)[0]?.food;
  const values = {};
  const collect = (nutrients) => {
    for (const nutrient of nutrients || []) {
      const name = NUTRIENTS[nutrient.nutrientId ?? nutrient.nutrient?.id];
      const amount = nutrient.value ?? nutrient.amount;
      if (name && amount !== undefined) values[name] = Math.round(Number(amount) * 10) / 10;
    }
  };
  collect(best?.foodNutrients);
  // Foundation rows sometimes omit energy from the abbreviated search payload;
  // the detail endpoint always has it.
  if (best && values.calories === undefined) {
    const detail = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${best.fdcId}?api_key=${key}`);
    if (detail.ok) collect((await detail.json()).foodNutrients);
  }
  if (!best || values.calories === undefined) {
    missing.push([id, query, best?.description]);
    continue;
  }
  out[id] = {
    usda: String(best.fdcId),
    name: String(best.description),
    per100g: {
      calories: values.calories ?? 0,
      protein: values.protein ?? 0,
      carbs: values.carbs ?? 0,
      fat: values.fat ?? 0,
      fiber: values.fiber ?? 0,
    },
  };
  process.stdout.write('.');
}
for (const [id, barcode] of OFF_SOURCED) {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,nutriments`,
    { headers: { 'User-Agent': 'Kandro/1.0 (https://getkandro.com; hewaddorani22@gmail.com)' } },
  );
  if (!response.ok) throw new Error(`off_${response.status} for ${id}`);
  const product = (await response.json())?.product || {};
  const values = product.nutriments || {};
  const round = (value) => Math.round((Number(value) || 0) * 10) / 10;
  if (!Number.isFinite(Number(values['energy-kcal_100g']))) throw new Error(`no energy for ${id}`);
  out[id] = {
    off: barcode,
    name: String(product.product_name || id),
    per100g: {
      calories: round(values['energy-kcal_100g']),
      protein: round(values.proteins_100g),
      carbs: round(values.carbohydrates_100g),
      fat: round(values.fat_100g),
      fiber: round(values.fiber_100g),
    },
  };
  process.stdout.write('+');
}
process.stdout.write('\n');

await writeFile(
  new URL('../src/data/ingredients.json', import.meta.url),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(`Resolved ${Object.keys(out).length} ingredients (${WANTED.length} from USDA, ${OFF_SOURCED.length} from Open Food Facts).`);
if (missing.length) {
  console.log('Unresolved:');
  for (const [id, query, got] of missing) console.log(`  ${id} <- "${query}" (best: ${got ?? 'none'})`);
}
