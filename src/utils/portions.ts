import type { MealItem, Nutrition } from '@/types/nutrition';

export function itemNutritionPer100g(item: MealItem): Nutrition {
  if (item.nutritionPer100g) return item.nutritionPer100g;
  const factor = item.amountG > 0 ? 100 / item.amountG : 0;
  return { calories: item.calories * factor, protein: item.protein * factor, carbs: item.carbs * factor, fat: item.fat * factor, fiber: (item.fiber ?? 0) * factor };
}

export type FoodPortion = { label: string; grams: number; estimated?: boolean };

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
  const normalized = String(input).trim().replace(',', '.');
  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const grams = Math.round((portion ? parsed * portion.grams : parsed) * 10) / 10;
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

/**
 * Where the sheet should open.
 *
 * Two different situations, and treating them the same broke one of them
 * each way round. Picking a food from search opens on its friendliest unit :
 * "1 banana", not the database's generic 100 g. Re-opening an amount someone
 * already set has to show that amount: it reset to "1 × 1 banana", so a person
 * checking their 252 g was shown 126 g and had to set it again.
 */
export function initialSelection(
  grams: number,
  portions: FoodPortion[] = [],
  { chosen = false }: { chosen?: boolean } = {},
): { unitIndex: number; amount: string } {
  const amount = Math.round(grams * 10) / 10;
  if (!chosen) return portions.length ? { unitIndex: 0, amount: '1' } : { unitIndex: -1, amount: String(amount > 0 ? amount : 100) };
  if (!Number.isFinite(amount) || amount < MIN_PORTION_G) return { unitIndex: -1, amount: '100' };
  for (const [index, portion] of portions.entries()) {
    if (!portion.grams) continue;
    const count = amount / portion.grams;
    // Half steps only: 1.5 bananas is a portion, 1.37 is arithmetic.
    if (count >= 0.5 && count <= 99 && Math.abs(amount - Math.round(count * 2) / 2 * portion.grams) < 0.05) {
      return { unitIndex: index, amount: String(Math.round(count * 2) / 2) };
    }
  }
  return { unitIndex: -1, amount: String(amount) };
}
