import type { MealItem } from '@/types/nutrition';

/** Unknown values are internal draft placeholders, never zero-calorie foods. */
export function needsIngredientCorrection(item: MealItem): boolean {
  return item.source?.code === 'unmatched'
    || ![item.calories, item.protein, item.carbs, item.fat].every(value => Number.isFinite(value) && value >= 0)
    || (item.calories === 0 && item.protein * 4 + item.carbs * 4 + item.fat * 9 > 5);
}

export function canSaveMealDraft(items: MealItem[]): boolean {
  // Excluding an unresolved row is not enough. Replace it or explicitly remove it.
  return items.some(item => item.included) && !items.some(needsIngredientCorrection);
}

export function replaceMealIngredient(items: MealItem[], id: string, replacement: MealItem): MealItem[] {
  if (needsIngredientCorrection(replacement) || !Number.isFinite(replacement.amountG)
    || replacement.amountG < 1 || replacement.amountG > 5000) return items;
  return items.map(item => item.id === id ? { ...replacement, id, included: true } : item);
}
