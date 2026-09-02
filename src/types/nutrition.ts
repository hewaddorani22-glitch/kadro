import type { UnitSystem } from '@/utils/units';

export type MacroKey = 'protein' | 'carbs' | 'fat';

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
};

export type NutritionSource = {
  provider: 'usda' | 'bls' | 'open-food-facts' | 'kandro-catalog' | 'demo';
  referenceId?: string;
  label: string;
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
  source: NutritionSource;
};

export type Meal = Nutrition & {
  id: string;
  title: string;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  time: string;
  confidence: 'high' | 'medium';
  items: MealItem[];
  /** 'scan' = analysed by the user, 'plan' = chosen from Kandro's suggestions. */
  origin?: 'seed' | 'scan' | 'plan';
  date?: string;
  savedAt?: string;
};

export type DailyTargets = Nutrition;

export type MealContext = 'home' | 'supermarket' | 'eating-out';

export type MealSuggestion = Nutrition & {
  id: string;
  title: string;
  detail: string;
  time: string;
  contexts?: MealContext[];
  preferences?: string[];
  source?: NutritionSource;
};

export type PortionFactor = 0.7 | 1 | 1.4;

export type NutritionGoal = 'lose' | 'maintain' | 'gain';

export type ActivityLevel = 'low' | 'light' | 'high';

/** Target change in body weight per week, in kilograms. */
export type WeeklyRateKg = 0.25 | 0.5;

export type UserProfile = {
  displayName: string;
  goal: NutritionGoal;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  /** Only meaningful when goal is 'lose' or 'gain'. */
  weeklyRateKg: WeeklyRateKg;
  /** Display only: height and weight are always stored in cm and kg. */
  unitSystem: UnitSystem;
  preferences: string[];
  completedAt: string | null;
};

export type WeightEntry = {
  date: string;
  weightKg: number;
};
