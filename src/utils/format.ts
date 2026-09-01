import Ionicons from '@expo/vector-icons/Ionicons';

import { Meal } from '@/types/nutrition';

export function formatNumber(value: number, locale = 'de-DE') {
  return value.toLocaleString(locale);
}

type MealLabels = { mealBreakfast: string; mealLunch: string; mealDinner: string; mealSnack: string };

export function mealTypeLabel(type: Meal['type'], labels?: MealLabels) {
  const fallback: MealLabels = {
    mealBreakfast: 'Frühstück', mealLunch: 'Mittagessen', mealDinner: 'Abendessen', mealSnack: 'Snack',
  };
  const source = labels ?? fallback;
  return {
    Breakfast: source.mealBreakfast,
    Lunch: source.mealLunch,
    Dinner: source.mealDinner,
    Snack: source.mealSnack,
  }[type];
}

/** Distinct glyph per meal moment; three identical rows read as a bug. */
export function mealTypeIcon(type: Meal['type']): keyof typeof Ionicons.glyphMap {
  return {
    Breakfast: 'cafe-outline',
    Lunch: 'restaurant-outline',
    // Not a moon: the evening summary row already owns that glyph, and two
    // different things sharing one icon on the same screen reads as a bug.
    Dinner: 'pizza-outline',
    Snack: 'nutrition-outline',
  }[type] as keyof typeof Ionicons.glyphMap;
}

export const MEAL_TYPES: Meal['type'][] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
