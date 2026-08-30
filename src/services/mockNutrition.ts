import { DailyTargets, Meal, MealContext, MealItem, MealSuggestion, Nutrition } from '@/types/nutrition';

export const DEFAULT_TARGETS: DailyTargets = {
  calories: 2230,
  protein: 140,
  carbs: 245,
  fat: 72,
};

export const INITIAL_MEALS: Meal[] = [
  {
    id: 'breakfast-1',
    title: 'Skyr, berries & granola',
    type: 'Breakfast',
    time: '08:12',
    calories: 430,
    protein: 40,
    carbs: 52,
    fat: 9,
    fiber: 8,
    confidence: 'High confidence',
    items: [],
  },
];

export const DETECTED_ITEMS: MealItem[] = [
  {
    id: 'chicken',
    name: 'Grilled chicken',
    amountG: 180,
    calories: 297,
    protein: 36,
    carbs: 0,
    fat: 12,
    confidence: 'high',
    included: true,
  },
  {
    id: 'rice',
    name: 'White rice',
    amountG: 220,
    calories: 286,
    protein: 6,
    carbs: 62,
    fat: 1,
    confidence: 'high',
    included: true,
  },
  {
    id: 'avocado',
    name: 'Avocado',
    amountG: 70,
    calories: 112,
    protein: 2,
    carbs: 6,
    fat: 10,
    confidence: 'high',
    included: true,
  },
  {
    id: 'sauce',
    name: 'Sesame sauce',
    amountG: 30,
    calories: 15,
    protein: 4,
    carbs: 8,
    fat: 1,
    confidence: 'medium',
    optional: true,
    included: true,
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
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 8 },
  );
}

export function createScannedMeal(items: MealItem[]): Meal {
  return {
    id: 'scan-chicken-bowl',
    title: 'Chicken rice bowl',
    type: 'Lunch',
    time: '13:24',
    confidence: 'High confidence',
    items,
    ...nutritionFromItems(items),
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
    { id: 'home-1', title: 'Herby chicken plate', detail: 'Chicken, potatoes, greens & yogurt', time: '20 min', calories: 520, protein: 46, carbs: 48, fat: 14 },
    { id: 'home-2', title: 'Egg-white taco bowl', detail: 'Eggs, black beans, salsa & rice', time: '15 min', calories: 485, protein: 40, carbs: 52, fat: 11 },
    { id: 'home-3', title: 'Warm tuna pasta salad', detail: 'Tuna, pasta, tomatoes & rocket', time: '18 min', calories: 505, protein: 43, carbs: 57, fat: 10 },
  ],
  supermarket: [
    { id: 'market-1', title: 'High-protein yogurt bowl', detail: 'Skyr, berries, oats & almonds', time: 'No prep', calories: 440, protein: 42, carbs: 47, fat: 9 },
    { id: 'market-2', title: 'Chicken wrap + skyr', detail: 'One fresh wrap and a plain skyr', time: 'Grab & go', calories: 510, protein: 48, carbs: 56, fat: 12 },
    { id: 'market-3', title: 'Protein sandwich + fruit', detail: 'Wholegrain chicken sandwich & apple', time: 'Grab & go', calories: 485, protein: 39, carbs: 61, fat: 10 },
  ],
  'eating-out': [
    { id: 'out-1', title: 'Chicken pho', detail: 'Broth-based, extra chicken, herbs', time: 'Vietnamese', calories: 500, protein: 41, carbs: 58, fat: 9 },
    { id: 'out-2', title: 'Grilled chicken salad', detail: 'Dressing on the side, add potatoes', time: 'Casual dining', calories: 470, protein: 45, carbs: 38, fat: 14 },
    { id: 'out-3', title: 'Sushi protein set', detail: 'Sashimi, edamame & six maki', time: 'Japanese', calories: 530, protein: 43, carbs: 62, fat: 11 },
  ],
};
