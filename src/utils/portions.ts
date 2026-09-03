import type { Nutrition } from '@/types/nutrition';

export type FoodPortion = { label: string; grams: number };

/** Wider than any real meal, narrow enough to catch a typed "1000000". */
export const MIN_PORTION_G = 1;
export const MAX_PORTION_G = 5000;

/**
 * Turn what the user typed into grams.
 *
 * German keyboards produce "1,5" and English ones "1.5" for the same half
 * portion, so both are accepted. A count is multiplied by the chosen portion
 * weight; with no portion chosen the number already is grams.
 */
export function resolveGrams(input: string, portion?: FoodPortion): number | null {
  const parsed = Number(String(input).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const grams = Math.round(portion ? parsed * portion.grams : parsed);
  if (grams < MIN_PORTION_G || grams > MAX_PORTION_G) return null;
  return grams;
}

/** Per-100 g reference values scaled to an actual amount. */
export function scaleNutrition(per100g: Nutrition, grams: number): Nutrition {
  const scale = grams / 100;
  return {
    calories: Math.round(per100g.calories * scale),
    protein: Math.round(per100g.protein * scale),
    carbs: Math.round(per100g.carbs * scale),
    fat: Math.round(per100g.fat * scale),
  };
}
