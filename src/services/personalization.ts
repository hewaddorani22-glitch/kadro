import { BiologicalSex, ActivityLevel, DailyTargets, NutritionGoal, UserProfile, WeeklyRateKg } from '@/types/nutrition';
import { getDictionary } from '@/i18n/active';
import { UnitSystem, formatWeeklyRate } from '@/utils/units';

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  goal: 'lose',
  age: 29,
  heightCm: 178,
  weightKg: 78,
  activityLevel: 'light',
  weeklyRateKg: 0.5,
  unitSystem: 'metric',
  sex: 'unspecified',
  preferences: ['high-protein'],
  completedAt: null,
};

const activityMultipliers: Record<ActivityLevel, number> = {
  low: 1.2,
  light: 1.375,
  high: 1.6,
};

/**
 * Roughly 7700 kcal are stored in a kilogram of body fat, so a weekly rate
 * converts to a daily offset by (rate * 7700) / 7 = rate * 1100.
 *
 * The old model used a flat -350 / 0 / +250 for everyone, which gave a 55 kg
 * woman and a 95 kg man the same deficit.
 *
 * A surplus is deliberately not capped, while a deficit still is. Eating too
 * little is a health question; eating 550 kcal above maintenance is not — it
 * only shifts how much of the gain is muscle versus fat, and that is the
 * user's call to make. Capping it at a flat 350 meant somebody who picked
 * 0.5 kg a week was quietly given 0.32, a number that matches nothing they
 * were offered.
 */
const KCAL_PER_KG = 7700;

export const BIOLOGICAL_SEXES: BiologicalSex[] = ['female', 'male', 'unspecified'];

export function isBiologicalSex(value: unknown): value is BiologicalSex {
  return BIOLOGICAL_SEXES.includes(value as BiologicalSex);
}

const SEX_CONSTANT: Record<BiologicalSex, number> = {
  male: 5,
  female: -161,
  unspecified: -78,
};

function dailyGoalOffset(goal: NutritionGoal, weeklyRateKg: WeeklyRateKg) {
  if (goal === 'maintain') return 0;
  const daily = (weeklyRateKg * KCAL_PER_KG) / 7;
  return goal === 'lose' ? -daily : daily;
}

/**
 * The pace the calorie target actually applies.
 *
 * Only the deficit floor can move it now, and that is reported separately by
 * isRateLimited — so for a surplus this is simply the rate the user picked.
 */
export function effectiveWeeklyRate(goal: NutritionGoal, weeklyRateKg: WeeklyRateKg) {
  return weeklyRateKg;
}

type PaceLabels = { paceHold: string; paceLose: (rate: string) => string; paceGain: (rate: string) => string };

export function weeklyRateLabel(
  goal: NutritionGoal,
  weeklyRateKg: WeeklyRateKg,
  labels?: PaceLabels,
  unitSystem: UnitSystem = 'metric',
) {
  const source = labels ?? getDictionary().common;
  if (goal === 'maintain') return source.paceHold;
  // The unit travels with the number so "0,5 kg" can become "1 lb" without
  // rewriting the sentence around it.
  const value = formatWeeklyRate(effectiveWeeklyRate(goal, weeklyRateKg), unitSystem);
  return goal === 'lose' ? source.paceLose(value) : source.paceGain(value);
}

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

/**
 * Mifflin-St Jeor times an activity factor. The constant is +5 for men and
 * -161 for women; the midpoint of -78 applies when someone would rather not
 * say. Skipping the question cost about 115 kcal a day in a fixed direction —
 * a fifth of a 0.5 kg weekly goal, always the same way for the same person.
 *
 * One function, because the target and the safety floor have to agree on what
 * maintenance means.
 */
export function maintenanceCalories(profile: UserProfile) {
  const resting = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age
    + SEX_CONSTANT[profile.sex ?? 'unspecified'];
  return resting * activityMultipliers[profile.activityLevel];
}

export function calculateDailyTargets(profile: UserProfile): DailyTargets {
  const maintenance = maintenanceCalories(profile);
  const offset = dailyGoalOffset(profile.goal, profile.weeklyRateKg ?? 0.5);
  // Never cut below 1300 kcal and never below 70% of maintenance, whichever is
  // higher. A fast rate on a light person would otherwise produce a target that
  // no responsible app should show.
  const floor = Math.max(1_300, maintenance * 0.7);
  const calories = Math.min(4_000, Math.max(floor, roundTo(maintenance + offset, 10)));
  // Protein and fat come from body weight, but the day's energy has to be able
  // to pay for them. Scaling protein from *total* weight meant that a heavy
  // person on a deficit was given macros that added up to far more than their
  // calorie target: 1320 kcal shown, 1845 kcal once the three were summed. The
  // 35% ceilings are what make the three numbers describe the same day.
  const proteinFactor = profile.goal === 'maintain' ? 1.6 : 1.8;
  const proteinCeiling = Math.min(260, Math.floor((calories * 0.35) / 4));
  const protein = Math.max(70, Math.min(proteinCeiling, roundTo(profile.weightKg * proteinFactor, 5)));
  const fatCeiling = Math.max(45, Math.floor((calories * 0.35) / 9));
  const fat = Math.max(45, Math.min(140, fatCeiling, roundTo(profile.weightKg * 0.8, 5)));
  // Carbs take what is left. The old 80 g floor was applied even when the
  // budget could not cover it, which is where the mismatch came from.
  const carbs = Math.min(550, Math.max(0, roundTo((calories - protein * 4 - fat * 9) / 4, 5)));

  // A large surplus can exhaust the carb ceiling and leave energy unassigned:
  // 3720 kcal against 550 g of carbs left 250 kcal that appeared nowhere. Fat
  // absorbs the remainder, then protein — both still bounded.
  const unassigned = calories - (protein * 4 + carbs * 4 + fat * 9);
  const fatTop = Math.min(140, fat + Math.max(0, roundTo(unassigned / 9, 5)));
  const stillUnassigned = calories - (protein * 4 + carbs * 4 + fatTop * 9);
  const proteinTop = Math.min(260, protein + Math.max(0, roundTo(stillUnassigned / 4, 5)));

  return { calories, protein: proteinTop, carbs, fat: fatTop };
}

export type TargetStep = {
  id: 'resting' | 'activity' | 'goal' | 'floor' | 'cap' | 'protein';
  /** The number this step arrives at, already rounded for display. */
  value: number;
  unit: 'kcal' | 'g';
};

/**
 * The same arithmetic as calculateDailyTargets, exposed step by step.
 *
 * The onboarding used to pause for a second and a half under the word
 * "building", which is a loading bar pretending to be thought. These are the
 * actual intermediate values, so the wait shows the calculation instead of
 * standing in for it. It deliberately re-derives rather than instrumenting the
 * real function: a display concern must not be able to change a target.
 */
export function explainTargets(profile: UserProfile): TargetStep[] {
  // Derived from maintenanceCalories rather than restating Mifflin-St Jeor:
  // a second copy of the formula is a second thing to keep in step, and the
  // safety floor is calculated from the first one.
  const maintenance = maintenanceCalories(profile);
  const resting = maintenance / activityMultipliers[profile.activityLevel];
  const offset = dailyGoalOffset(profile.goal, profile.weeklyRateKg ?? 0.5);
  const targets = calculateDailyTargets(profile);
  // Rounded to ten like the target itself, so the chain ends on exactly the
  // number the next screen shows rather than four kilocalories beside it.
  const steps: TargetStep[] = [
    { id: 'resting', value: roundTo(resting, 10), unit: 'kcal' },
    { id: 'activity', value: roundTo(maintenance, 10), unit: 'kcal' },
  ];
  if (profile.goal !== 'maintain') {
    steps.push({ id: 'goal', value: roundTo(maintenance + offset, 10), unit: 'kcal' });
  }
  // Only when a bound actually moved the number. Comparing against the
  // unrounded value called a 4 kcal rounding "raised to the safety floor",
  // and the 4000 kcal ceiling was not shown at all, so the chain ended on a
  // number the next screen contradicted.
  const requested = roundTo(maintenance + offset, 10);
  if (targets.calories > requested) steps.push({ id: 'floor', value: targets.calories, unit: 'kcal' });
  if (targets.calories < requested) steps.push({ id: 'cap', value: targets.calories, unit: 'kcal' });
  steps.push({ id: 'protein', value: targets.protein, unit: 'g' });
  return steps;
}

type GoalLabels = { goalLose: string; goalMaintain: string; goalGain: string };
type ActivityLabels = { activityLow: string; activityLight: string; activityHigh: string };

export function goalLabel(goal: NutritionGoal, labels?: GoalLabels) {
  const source = labels ?? getDictionary().common;
  if (goal === 'maintain') return source.goalMaintain;
  if (goal === 'gain') return source.goalGain;
  return source.goalLose;
}

export function activityLabel(activity: ActivityLevel, labels?: ActivityLabels) {
  const source = labels ?? getDictionary().common;
  if (activity === 'low') return source.activityLow;
  if (activity === 'high') return source.activityHigh;
  return source.activityLight;
}

export function estimatedPace(
  goal: NutritionGoal,
  weeklyRateKg: WeeklyRateKg = 0.5,
  labels?: PaceLabels,
  unitSystem: UnitSystem = 'metric',
) {
  return weeklyRateLabel(goal, weeklyRateKg, labels, unitSystem);
}

/** True when the safety floor overrode the requested rate. */
/** True when the safety floor overrode the requested rate. Only a deficit can. */
export function isRateLimited(profile: UserProfile) {
  if (profile.goal !== 'lose') return false;
  const maintenance = maintenanceCalories(profile);
  const requested = maintenance + dailyGoalOffset(profile.goal, profile.weeklyRateKg ?? 0.5);
  return requested < Math.max(1_300, maintenance * 0.7);
}
