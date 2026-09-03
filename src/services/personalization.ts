import { ActivityLevel, DailyTargets, NutritionGoal, UserProfile, WeeklyRateKg } from '@/types/nutrition';
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
 * woman and a 95 kg man the same deficit. Building muscle uses a gentler
 * surplus than the same rate of loss, because surplus beyond roughly 300 kcal
 * mostly becomes fat rather than muscle.
 */
const KCAL_PER_KG = 7700;

function dailyGoalOffset(goal: NutritionGoal, weeklyRateKg: WeeklyRateKg) {
  if (goal === 'maintain') return 0;
  const daily = (weeklyRateKg * KCAL_PER_KG) / 7;
  return goal === 'lose' ? -daily : Math.min(350, daily);
}

/** The pace the calorie target actually applies after Kandro's safety caps. */
export function effectiveWeeklyRate(goal: NutritionGoal, weeklyRateKg: WeeklyRateKg) {
  if (goal !== 'gain') return weeklyRateKg;
  const appliedDaily = dailyGoalOffset(goal, weeklyRateKg);
  return Math.round(((appliedDaily * 7) / KCAL_PER_KG) * 100) / 100;
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

export function calculateDailyTargets(profile: UserProfile): DailyTargets {
  // Gender-neutral midpoint of Mifflin-St Jeor. Kandro deliberately presents this
  // as a wellness estimate because onboarding does not collect sex or body fat.
  const restingEstimate = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 78;
  const maintenance = restingEstimate * activityMultipliers[profile.activityLevel];
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

  return { calories, protein, carbs, fat };
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
export function isRateLimited(profile: UserProfile) {
  if (profile.goal === 'gain') return effectiveWeeklyRate(profile.goal, profile.weeklyRateKg) < profile.weeklyRateKg;
  if (profile.goal !== 'lose') return false;
  const restingEstimate = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 78;
  const maintenance = restingEstimate * activityMultipliers[profile.activityLevel];
  const requested = maintenance + dailyGoalOffset(profile.goal, profile.weeklyRateKg ?? 0.5);
  return requested < Math.max(1_300, maintenance * 0.7);
}
