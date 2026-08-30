export type MacroKey = 'protein' | 'carbs' | 'fat';

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

export type MealItem = Nutrition & {
  id: string;
  name: string;
  amountG: number;
  baseAmountG: number;
  portionFactor: number;
  confidence: 'high' | 'medium';
  optional?: boolean;
  included: boolean;
};

export type Meal = Nutrition & {
  id: string;
  title: string;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  time: string;
  confidence: 'high' | 'medium';
  items: MealItem[];
};

export type DailyTargets = Nutrition;

export type MealContext = 'home' | 'supermarket' | 'eating-out';

export type MealSuggestion = Nutrition & {
  id: string;
  title: string;
  detail: string;
  time: string;
};

export type PortionFactor = 0.7 | 1 | 1.4;
