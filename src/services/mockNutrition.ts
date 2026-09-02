import { getDictionary } from '@/i18n/active';
import { DailyTargets, Meal, MealItem, MealSuggestion, Nutrition, PortionFactor } from '@/types/nutrition';

export const DEFAULT_TARGETS: DailyTargets = {
  calories: 2230,
  protein: 140,
  carbs: 245,
  fat: 72,
};

export const DETECTED_ITEMS: MealItem[] = [
  {
    id: 'chicken',
    name: getDictionary().errors.demoChicken,
    amountG: 180,
    baseAmountG: 180,
    portionFactor: 1,
    calories: 297,
    protein: 36,
    carbs: 0,
    fat: 12,
    fiber: 0,
    confidence: 'high',
    included: true,
    source: { provider: 'demo', label: 'Kandro Demo' },
  },
  {
    id: 'rice',
    name: getDictionary().errors.demoRice,
    amountG: 220,
    baseAmountG: 220,
    portionFactor: 1,
    calories: 286,
    protein: 6,
    carbs: 62,
    fat: 1,
    fiber: 1,
    confidence: 'high',
    included: true,
    source: { provider: 'demo', label: 'Kandro Demo' },
  },
  {
    id: 'avocado',
    name: getDictionary().errors.demoAvocado,
    amountG: 70,
    baseAmountG: 70,
    portionFactor: 1,
    calories: 112,
    protein: 2,
    carbs: 6,
    fat: 10,
    fiber: 5,
    confidence: 'high',
    included: true,
    source: { provider: 'demo', label: 'Kandro Demo' },
  },
  {
    id: 'sauce',
    name: getDictionary().errors.demoSauce,
    amountG: 30,
    baseAmountG: 30,
    portionFactor: 1,
    calories: 15,
    protein: 4,
    carbs: 8,
    fat: 1,
    fiber: 1,
    confidence: 'medium',
    optional: true,
    included: true,
    source: { provider: 'demo', label: 'Kandro Demo' },
  },
];

export function nutritionFromItems(items: MealItem[]): Nutrition {
  return items.filter((item) => item.included).reduce<Nutrition>(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
      fiber: (sum.fiber ?? 0) + (item.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

export function createScannedMeal(items: MealItem[], title = getDictionary().errors.demoMealTitle, id = 'scan-chicken-bowl'): Meal {
  const now = new Date();
  const hour = now.getHours();
  return {
    id,
    title,
    type: hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snack',
    time: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now),
    confidence: items.some((item) => item.included && item.confidence === 'medium') ? 'medium' : 'high',
    items,
    origin: 'scan',
    ...nutritionFromItems(items),
  };
}

/**
 * Turns a chosen recommendation into a logged meal.
 *
 * The suggestion is one dish, not a detected ingredient list, so it becomes a
 * single item. That keeps the meal shape identical to a scanned one, so the
 * timeline, the cloud sync and the ingredient list all work unchanged.
 */
export function createPlannedMeal(suggestion: MealSuggestion, portion: PortionFactor, id: string): Meal {
  const now = new Date();
  const hour = now.getHours();
  const scale = (value: number) => Math.round(value * portion);

  const item: MealItem = {
    id: `${suggestion.id}-portion`,
    name: suggestion.title,
    // baseAmountG stays at the unscaled reference so a later correction can
    // return to exactly 1x instead of drifting from whatever was picked first.
    amountG: Math.round(100 * portion),
    baseAmountG: 100,
    portionFactor: portion,
    calories: scale(suggestion.calories),
    protein: scale(suggestion.protein),
    carbs: scale(suggestion.carbs),
    fat: scale(suggestion.fat),
    fiber: scale(suggestion.fiber ?? 0),
    // A catalog value is a typical preparation, never a measurement of the
    // plate in front of the user.
    confidence: 'medium',
    optional: false,
    included: true,
    source: suggestion.source ?? { provider: 'kandro-catalog', label: getDictionary().errors.catalogSourceLabel },
  };

  return {
    id,
    title: suggestion.title,
    type: hour < 11 ? 'Breakfast' : hour < 15 ? 'Lunch' : hour < 21 ? 'Dinner' : 'Snack',
    time: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now),
    confidence: 'medium',
    items: [item],
    origin: 'plan',
    ...nutritionFromItems([item]),
  };
}

export function sumMeals(meals: Meal[]): Nutrition {
  return meals.reduce<Nutrition>(
    (sum, meal) => ({
      calories: sum.calories + meal.calories,
      protein: sum.protein + meal.protein,
      carbs: sum.carbs + meal.carbs,
      fat: sum.fat + meal.fat,
      fiber: (sum.fiber ?? 0) + (meal.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

export function getRemaining(targets: DailyTargets, consumed: Nutrition): Nutrition {
  return {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
  };
}

