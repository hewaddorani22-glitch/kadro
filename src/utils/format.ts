import Ionicons from '@expo/vector-icons/Ionicons';

import { getDictionary, getLocale } from '@/i18n/active';
import { Meal } from '@/types/nutrition';

/**
 * The locale defaults to the active language rather than to German: a caller
 * that forgets to pass one used to silently format 1950 as "1.950" for an
 * English reader.
 */
export function formatNumber(value: number, locale = getLocale()) {
  return value.toLocaleString(locale);
}

type MealLabels = { mealBreakfast: string; mealLunch: string; mealDinner: string; mealSnack: string };

export function mealTypeLabel(type: Meal['type'], labels?: MealLabels) {
  const source = labels ?? getDictionary().common;
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
