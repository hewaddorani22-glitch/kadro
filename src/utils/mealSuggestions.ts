import type { MealSuggestion, Nutrition } from '@/types/nutrition';

// A tiny remainder is not a reason to suggest a 20 kcal "meal". Offer a
// practical small portion instead; the UI must disclose any target overage.
export const SMALL_MEAL_CALORIES = 200;

export function suggestionBudget(remainingCalories: number) {
  return Math.max(SMALL_MEAL_CALORIES, Number.isFinite(remainingCalories) ? remainingCalories : 0);
}

export function suggestionCalorieTarget(remainingCalories: number) {
  const budget = suggestionBudget(remainingCalories);
  const remaining = Number.isFinite(remainingCalories) ? Math.max(0, remainingCalories) : 0;
  return Math.min(budget, 550, Math.max(380, remaining * 0.38));
}

export function scaleSuggestedNutrition(nutrition: Nutrition, factor: number): Nutrition {
  return {
    calories: Math.round(nutrition.calories * factor),
    protein: Math.round(nutrition.protein * factor),
    carbs: Math.round(nutrition.carbs * factor),
    fat: Math.round(nutrition.fat * factor),
    fiber: Math.round((nutrition.fiber ?? 0) * factor),
  };
}

// Always scale the original catalogue values, including when the user changes
// the proposed portion. This keeps recipe, preview and saved meal identical.
export function suggestedNutrition(suggestion: MealSuggestion, relativePortion = 1): Nutrition {
  return scaleSuggestedNutrition(suggestion.referenceNutrition ?? suggestion, (suggestion.portionScale ?? 1) * relativePortion);
}

export function recipePortion(value: unknown) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number >= 0.1 && number <= 2 ? number : 1;
}
