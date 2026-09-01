import Ionicons from '@expo/vector-icons/Ionicons';

import { Meal } from '@/types/nutrition';

export function formatNumber(value: number, locale = 'de-DE') {
  return value.toLocaleString(locale);
}

export function mealTypeLabel(type: Meal['type']) {
  return {
    Breakfast: 'Frühstück',
    Lunch: 'Mittagessen',
    Dinner: 'Abendessen',
    Snack: 'Snack',
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
