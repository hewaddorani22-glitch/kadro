import {
  BLS_REFERENCE_MEALS,
  BLS_SOURCE,
} from '../../supabase/functions/_shared/bls-reference.mjs';

const scale = (value, grams) => Math.round(value * grams / 100);

/**
 * 64 reproducible German meal cases for deterministic nutrition regression.
 * The input includes a weighed portion; the expected result is therefore a
 * database-grounded target, not another model's opinion.
 */
export const GERMAN_MEAL_EVALUATION = Object.freeze(BLS_REFERENCE_MEALS.map((meal) => Object.freeze({
  id: meal.key.replaceAll('_', '-'),
  inputDe: `${meal.defaultGrams} g ${meal.nameDe}`,
  referenceKey: meal.key,
  source: Object.freeze({
    provider: 'bls',
    code: meal.code,
    version: BLS_SOURCE.version,
    license: BLS_SOURCE.license,
    doi: BLS_SOURCE.doi,
  }),
  grams: meal.defaultGrams,
  per100g: meal.per100g,
  expected: Object.freeze({
    calories: scale(meal.per100g.calories, meal.defaultGrams),
    protein: scale(meal.per100g.protein, meal.defaultGrams),
    carbs: scale(meal.per100g.carbs, meal.defaultGrams),
    fat: scale(meal.per100g.fat, meal.defaultGrams),
    fiber: scale(meal.per100g.fiber, meal.defaultGrams),
  }),
})));
