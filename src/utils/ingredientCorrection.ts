import type { MealItem, Nutrition } from '@/types/nutrition';

/** Unknown values are internal draft placeholders, never zero-calorie foods. */
export function needsIngredientCorrection(item: MealItem): boolean {
  return item.source?.code === 'unmatched'
    || ![item.calories, item.protein, item.carbs, item.fat].every(value => Number.isFinite(value) && value >= 0)
    || (item.calories === 0 && item.protein * 4 + item.carbs * 4 + item.fat * 9 > 5);
}

export function canSaveMealDraft(items: MealItem[]): boolean {
  // Excluding an unresolved row is not enough. Replace it or explicitly remove it.
  const total = items.filter(item=>item.included).reduce((sum,item)=>({calories:sum.calories+item.calories,protein:sum.protein+item.protein,carbs:sum.carbs+item.carbs,fat:sum.fat+item.fat,fiber:(sum.fiber??0)+(item.fiber??0)}),{calories:0,protein:0,carbs:0,fat:0,fiber:0});
  return items.some(item => item.included) && !items.some(needsIngredientCorrection)
    && items.every(item=>Number.isFinite(item.amountG)&&item.amountG>=1&&item.amountG<=5000&&nutritionFitsStorage(item)) && nutritionFitsStorage(total);
}

export function replaceMealIngredient(items: MealItem[], id: string, replacement: MealItem): MealItem[] {
  if (needsIngredientCorrection(replacement) || !Number.isFinite(replacement.amountG)
    || replacement.amountG < 1 || replacement.amountG > 5000) return items;
  return items.map(item => item.id === id ? { ...replacement, id, included: true } : item);
}

/** Existing SQL parent/item bounds, checked before presenting a savable draft. */
export function nutritionFitsStorage(nutrition: Nutrition): boolean {
  return Object.entries({calories:10000,protein:1000,carbs:2000,fat:1000,fiber:500}).every(([key,max]) => {
    const value=nutrition[key as keyof Nutrition];
    return value === undefined ? key === 'fiber' : Number.isFinite(value) && value >= 0 && value <= max;
  });
}
