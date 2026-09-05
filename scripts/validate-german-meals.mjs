import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { GERMAN_MEAL_EVALUATION } from '../src/data/germanMealEvaluation.mjs';
import {
  BLS_REFERENCE_KEYS,
  buildMealItem,
  detectionSchema,
  getBlsReference,
  resolveBlsFacts,
} from '../server/core.mjs';

assert.ok(
  GERMAN_MEAL_EVALUATION.length >= 50 && GERMAN_MEAL_EVALUATION.length <= 100,
  'Die deutsche Evaluationsmenge muss 50 bis 100 Mahlzeiten enthalten.',
);
assert.equal(new Set(GERMAN_MEAL_EVALUATION.map((entry) => entry.id)).size, GERMAN_MEAL_EVALUATION.length, 'IDs müssen eindeutig sein.');
assert.equal(new Set(GERMAN_MEAL_EVALUATION.map((entry) => entry.referenceKey)).size, GERMAN_MEAL_EVALUATION.length, 'BLS-Schlüssel müssen eindeutig sein.');
assert.deepEqual(
  new Set(detectionSchema.properties.items.items.properties.referenceKey.enum),
  new Set([...BLS_REFERENCE_KEYS, 'other']),
  'Das Modellschema und der geprüfte BLS-Katalog dürfen nicht auseinanderlaufen.',
);

for (const [index, entry] of GERMAN_MEAL_EVALUATION.entries()) {
  assert.match(entry.source.code, /^[A-Z0-9]{7}$/, `${entry.id}: ungültiger BLS-Code`);
  assert.equal(entry.source.provider, 'bls', `${entry.id}: falscher Provider`);
  assert.equal(entry.source.license, 'CC BY 4.0', `${entry.id}: Lizenzhinweis fehlt`);
  assert.ok(entry.grams >= 50 && entry.grams <= 750, `${entry.id}: unplausible Referenzportion`);

  const reference = getBlsReference(entry.referenceKey);
  assert.ok(reference, `${entry.id}: Referenz fehlt`);
  assert.deepEqual(reference.per100g, entry.per100g, `${entry.id}: Referenzwerte sind gedriftet`);

  const macroCalories = entry.per100g.protein * 4 + entry.per100g.carbs * 4 + entry.per100g.fat * 9;
  const delta = Math.abs(macroCalories - entry.per100g.calories) / Math.max(1, entry.per100g.calories);
  assert.ok(delta <= 0.25, `${entry.id}: Kalorien und Makros sind nicht plausibel konsistent`);

  const item = {
    nameDe: reference.nameDe,
    searchTermEn: reference.nameEn,
    referenceKey: reference.key,
    estimatedGrams: entry.grams,
    estimatedGramsLow: entry.grams,
    estimatedGramsHigh: entry.grams,
    preparation: 'mixed',
    hiddenCaloriesRisk: 'low',
    confidence: 'high',
    optional: false,
  };
  const mapped = buildMealItem(item, resolveBlsFacts(item), index);
  assert.equal(mapped.source.provider, 'bls', `${entry.id}: BLS-Quelle geht beim Mapping verloren`);
  assert.equal(mapped.source.referenceId, entry.source.code, `${entry.id}: falsche Quellen-ID`);
  for (const nutrient of ['calories', 'protein', 'carbs', 'fat', 'fiber']) {
    assert.equal(mapped[nutrient], entry.expected[nutrient], `${entry.id}: ${nutrient} weicht vom BLS-Soll ab`);
  }
}

// Independent spot values copied from the published BLS 4.0 workbook. They
// catch accidental edits even though the runtime and evaluation share a catalog.
const spotChecks = {
  goulash_beef: [124, 12.95, 4.2, 5.9],
  goulash_pork: [150, 18.2, 0.6, 8.3],
  currywurst_pommes: [217, 6.58, 17.44, 13.04],
  doner_chicken: [199, 13.08, 18, 7.9],
  pizza_margherita: [238, 7.77, 20, 13.55],
  pasta_bolognese: [164, 8.3, 13.9, 8],
  kaesespaetzle: [155, 8, 16.6, 5.84],
  lentil_soup: [82, 4.53, 10, 1.9],
  scrambled_eggs: [203, 12.88, 0.39, 16.61],
  milk_rice_cinnamon: [142, 4.83, 23.2, 3.18],
  chicken_wrap: [153, 12.18, 15.9, 4.2],
  salmon_vegetables: [136, 11.64, 1.9, 8.6],
};
for (const [key, expected] of Object.entries(spotChecks)) {
  const meal = getBlsReference(key);
  assert.deepEqual(
    [meal.per100g.calories, meal.per100g.protein, meal.per100g.carbs, meal.per100g.fat],
    expected,
    `${key}: veröffentlichter BLS-Spotcheck ist gedriftet`,
  );
}

const digest = createHash('sha256')
  .update(JSON.stringify(GERMAN_MEAL_EVALUATION))
  .digest('hex');
// Added Y1A1000 and Y341023 from the independently checksum-locked full BLS
// snapshot, to distinguish goulash from the pre-existing soup reference.
assert.equal(digest, '41584493d6001f10f5af489e32231ed946b9495f1e3f15bf65c562a724f5250b', 'BLS-Evaluationssnapshot wurde verändert; Quelle und Änderung bewusst prüfen.');

console.log(`Validated ${GERMAN_MEAL_EVALUATION.length} sourced German BLS 4.0 meal references.`);
