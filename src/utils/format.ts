import { Meal } from '@/types/nutrition';

export function formatNumber(value: number) {
  return value.toLocaleString('de-DE');
}

export function mealTypeLabel(type: Meal['type']) {
  return {
    Breakfast: 'Frühstück',
    Lunch: 'Mittagessen',
    Dinner: 'Abendessen',
    Snack: 'Snack',
  }[type];
}
