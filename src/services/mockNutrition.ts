import { DailyTargets, Meal, MealContext, MealItem, MealSuggestion, Nutrition, PortionFactor } from '@/types/nutrition';

export const DEFAULT_TARGETS: DailyTargets = {
  calories: 2230,
  protein: 140,
  carbs: 245,
  fat: 72,
};

export const INITIAL_MEALS: Meal[] = [
  {
    id: 'breakfast-1',
    title: 'Skyr mit Beeren und Granola',
    type: 'Breakfast',
    time: '08:12',
    calories: 430,
    protein: 40,
    carbs: 52,
    fat: 9,
    fiber: 8,
    confidence: 'high',
    items: [],
    origin: 'seed',
  },
];

export const DETECTED_ITEMS: MealItem[] = [
  {
    id: 'chicken',
    name: 'Gegrilltes Hähnchen',
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
    name: 'Weißer Reis',
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
    name: 'Avocado',
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
    name: 'Sesamsauce',
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

export function createScannedMeal(items: MealItem[], title = 'Hähnchen-Reis-Bowl', id = 'scan-chicken-bowl'): Meal {
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
    amountG: 100,
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
    source: suggestion.source ?? { provider: 'kandro-catalog', label: 'Kandro-Katalog · typischer Richtwert' },
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

export const SUGGESTIONS: Record<MealContext, MealSuggestion[]> = {
  home: [
    { id: 'home-1', title: 'Kräuter-Hähnchen-Teller', detail: 'Hähnchen, Kartoffeln, Gemüse und Joghurt', time: '20 Min.', calories: 520, protein: 46, carbs: 48, fat: 14 },
    { id: 'home-2', title: 'Eier-Taco-Bowl', detail: 'Eier, schwarze Bohnen, Salsa und Reis', time: '15 Min.', calories: 485, protein: 40, carbs: 52, fat: 11 },
    { id: 'home-3', title: 'Warmer Thunfisch-Nudelsalat', detail: 'Thunfisch, Nudeln, Tomaten und Rucola', time: '18 Min.', calories: 505, protein: 43, carbs: 57, fat: 10 },
  ],
  supermarket: [
    { id: 'market-1', title: 'Proteinreiche Skyr-Bowl', detail: 'Skyr, Beeren, Haferflocken und Mandeln', time: 'Ohne Kochen', calories: 440, protein: 42, carbs: 47, fat: 9 },
    { id: 'market-2', title: 'Hähnchen-Wrap und Skyr', detail: 'Ein frischer Wrap und ein Natur-Skyr', time: 'Direkt essen', calories: 510, protein: 48, carbs: 56, fat: 12 },
    { id: 'market-3', title: 'Protein-Sandwich und Obst', detail: 'Vollkorn-Hähnchen-Sandwich und Apfel', time: 'Direkt essen', calories: 485, protein: 39, carbs: 61, fat: 10 },
  ],
  'eating-out': [
    { id: 'out-1', title: 'Hähnchen-Pho', detail: 'Klare Brühe, extra Hähnchen und Kräuter', time: 'Vietnamesisch', calories: 500, protein: 41, carbs: 58, fat: 9 },
    { id: 'out-2', title: 'Gegrillter Hähnchensalat', detail: 'Dressing separat, dazu Kartoffeln', time: 'Bistro', calories: 470, protein: 45, carbs: 38, fat: 14 },
    { id: 'out-3', title: 'Proteinreiches Sushi-Set', detail: 'Sashimi, Edamame und sechs Maki', time: 'Japanisch', calories: 530, protein: 43, carbs: 62, fat: 11 },
  ],
};
