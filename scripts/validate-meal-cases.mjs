import assert from 'node:assert/strict';

import {
  chooseFood,
  classifyDetection,
  mapUsdaFood,
  validateAnalysisInput,
} from '../server/core.mjs';

const representativeMeals = [
  ['haehnchen-reis-bowl', 'Hähnchen-Reis-Bowl', 480, 148, 10, 18, 5],
  ['doener', 'Döner im Fladenbrot', 420, 216, 12, 20, 3],
  ['currywurst-pommes', 'Currywurst mit Pommes', 500, 238, 8, 24, 3],
  ['spaghetti-bolognese', 'Spaghetti Bolognese', 460, 158, 8, 21, 4],
  ['pizza-margherita', 'Pizza Margherita', 360, 245, 10, 31, 3],
  ['linsencurry', 'Linsencurry mit Reis', 520, 132, 6, 22, 5],
  ['falafel-teller', 'Falafel-Teller', 480, 184, 8, 23, 7],
  ['schnitzel-kartoffeln', 'Schnitzel mit Kartoffeln', 510, 201, 9, 18, 4],
  ['lachs-gemuese', 'Lachs mit Gemüse', 390, 166, 10, 7, 3],
  ['ruehrei-brot', 'Rührei mit Vollkornbrot', 330, 188, 11, 16, 3],
  ['skyr-bowl', 'Skyr-Bowl mit Beeren', 360, 114, 8, 15, 4],
  ['porridge', 'Porridge mit Banane', 380, 126, 4, 21, 5],
  ['kaesebroetchen', 'Käsebrötchen', 170, 278, 12, 31, 2],
  ['huehnersuppe', 'Hühnersuppe', 420, 72, 4, 6, 2],
  ['gemischter-salat', 'Gemischter Salat', 310, 86, 4, 9, 4],
  ['chili-sin-carne', 'Chili sin Carne', 460, 119, 6, 17, 7],
  ['tofu-wok', 'Tofu-Gemüse-Wok', 430, 132, 7, 12, 5],
  ['sushi-set', 'Sushi-Set', 390, 151, 4, 25, 2],
  ['pho', 'Hähnchen-Pho', 520, 92, 3, 13, 2],
  ['burrito-bowl', 'Burrito-Bowl', 530, 146, 6, 20, 6],
  ['kartoffelsalat', 'Kartoffelsalat mit Ei', 390, 162, 7, 17, 3],
  ['quark-obst', 'Magerquark mit Obst', 340, 91, 3, 13, 3],
  ['thunfisch-sandwich', 'Thunfisch-Sandwich', 310, 173, 10, 20, 3],
  ['kantinen-eintopf', 'Kantinen-Eintopf', 470, 104, 5, 14, 4],
  ['protein-wrap', 'Hähnchen-Wrap', 350, 192, 12, 20, 3],
];

function usdaFood(index, calories, protein, carbs, fat, fiber) {
  return {
    fdcId: 100000 + index,
    dataType: 'Foundation',
    foodNutrients: [
      { nutrientId: 1008, value: calories },
      { nutrientId: 1003, value: protein },
      { nutrientId: 1005, value: carbs },
      { nutrientId: 1004, value: fat },
      { nutrientId: 1079, value: fiber },
    ],
  };
}

for (const [index, [id, title, grams, calories, protein, carbs, fat]] of representativeMeals.entries()) {
  const detection = {
    title,
    clarity: 'clear',
    dishCount: 1,
    confidence: index % 4 === 0 ? 'medium' : 'high',
    items: [{
      nameDe: title,
      searchTermEn: id,
      estimatedGrams: grams,
      confidence: index % 4 === 0 ? 'medium' : 'high',
      optional: false,
    }],
  };
  assert.equal(classifyDetection(detection), null, `${id}: sollte analysierbar sein`);
  const mapped = mapUsdaFood(
    detection.items[0],
    usdaFood(index, calories, protein, carbs, fat, 4),
    index,
  );
  assert.equal(mapped.amountG, grams, `${id}: Grammzahl bleibt erhalten`);
  assert.equal(mapped.calories, Math.round(calories * grams / 100), `${id}: Kalorien werden portionsbezogen skaliert`);
  assert.equal(mapped.source.provider, 'usda', `${id}: Quelle bleibt nachvollziehbar`);
  assert.ok(mapped.calories > 0 && mapped.protein >= 0 && mapped.carbs >= 0 && mapped.fat >= 0, `${id}: Nährwerte sind plausibel`);
}

const edgeCases = [
  ['poor-light', { clarity: 'unclear', dishCount: 1, items: [{ nameDe: 'Teller' }] }, 'unclear_image'],
  ['blurred', { clarity: 'unclear', dishCount: 1, items: [] }, 'unclear_image'],
  ['partial-plate', { clarity: 'clear', dishCount: 1, items: [] }, 'unclear_image'],
  ['multiple-dishes', { clarity: 'clear', dishCount: 2, items: [{ nameDe: 'Teller 1' }] }, 'multiple_dishes'],
];

for (const [id, detection, code] of edgeCases) {
  assert.equal(classifyDetection(detection)?.body.code, code, `${id}: erwarteter Korrekturhinweis`);
}

const unknown = mapUsdaFood({ nameDe: 'Unbekannte Sauce', estimatedGrams: 30 }, null, 0);
assert.equal(unknown.calories, 0, 'unknown-ingredient: keine erfundene Nährwertzahl');
assert.equal(unknown.optional, true, 'unknown-ingredient: Nutzerprüfung bleibt nötig');
assert.equal(unknown.confidence, 'medium', 'unknown-ingredient: Unsicherheit wird sichtbar');

assert.equal(representativeMeals.length + edgeCases.length + 1, 30, 'Die Tag-4-Matrix muss genau 30 Fälle enthalten.');
assert.equal(validateAnalysisInput({ mimeType: 'image/jpeg', imageBase64: 'x'.repeat(100) }), true);
assert.equal(validateAnalysisInput({ mimeType: 'image/png', imageBase64: 'x'.repeat(100) }), false);
assert.equal(chooseFood([{ dataType: 'Branded' }, { dataType: 'Foundation' }]).dataType, 'Foundation');

console.log('Validated 30 representative Kandro meal and image-quality cases.');
