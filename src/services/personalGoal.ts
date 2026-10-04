import type { NutritionGoal, UserProfile } from '@/types/nutrition';

export const ONBOARDING_STEPS = ['goal', 'about', 'body', 'activity', 'target', 'preferences', 'plan'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export function onboardingSteps(age: number, goal: NutritionGoal): readonly OnboardingStep[] {
  return age >= 18 && goal !== 'maintain' ? ONBOARDING_STEPS : ONBOARDING_STEPS.filter(step => step !== 'target');
}

/** Strict calendar dates, independent of locale, timezone and Date.parse rollover. */
export function isPersonalGoalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
const validWeight = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 40 && value <= 200;
type GoalFields = { targetWeightKg: number | null; targetDate: string | null };
type GoalProfile = Pick<UserProfile, 'age' | 'goal'> & Partial<GoalFields>;

/** Optional wishes only: never an input to nutrition, and never a youth claim. */
export function normalizePersonalGoal(profile: GoalProfile): GoalFields {
  if (profile.age < 18 || !Number.isFinite(profile.age) || !['lose', 'gain'].includes(profile.goal) || !validWeight(profile.targetWeightKg)) {
    return { targetWeightKg: null, targetDate: null };
  }
  return { targetWeightKg: Math.round(profile.targetWeightKg * 100) / 100,
    targetDate: isPersonalGoalDate(profile.targetDate) ? profile.targetDate : null };
}

/** Validate deliberate edits; an expired previously saved wish may still be read. */
export function personalGoalError(weightKg: number | null, date: string | null, today: string): 'weight' | 'date' | null {
  if (weightKg === null && date === null) return null;
  if (!validWeight(weightKg)) return 'weight';
  if (date !== null && (!isPersonalGoalDate(date) || date < today)) return 'date';
  return null;
}

/** Two decimal places preserve a stored kg value converted from pounds. */
export function parsePersonalGoalWeight(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}
