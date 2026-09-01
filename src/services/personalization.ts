import { ActivityLevel, DailyTargets, NutritionGoal, UserProfile } from '@/types/nutrition';

export const DEFAULT_PROFILE: UserProfile = {
  displayName: 'Du',
  goal: 'lose',
  age: 29,
  heightCm: 178,
  weightKg: 78,
  activityLevel: 'light',
  preferences: ['high-protein'],
  completedAt: null,
};

const activityMultipliers: Record<ActivityLevel, number> = {
  low: 1.2,
  light: 1.375,
  high: 1.6,
};

const goalAdjustments: Record<NutritionGoal, number> = {
  lose: -350,
  maintain: 0,
  gain: 250,
};

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function calculateDailyTargets(profile: UserProfile): DailyTargets {
  // Gender-neutral midpoint of Mifflin-St Jeor. Kandro deliberately presents this
  // as a wellness estimate because onboarding does not collect sex or body fat.
  const restingEstimate = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age - 78;
  const calories = Math.min(
    4_000,
    Math.max(1_300, roundTo(restingEstimate * activityMultipliers[profile.activityLevel] + goalAdjustments[profile.goal], 10)),
  );
  const proteinFactor = profile.goal === 'maintain' ? 1.6 : 1.8;
  const protein = Math.min(260, Math.max(70, roundTo(profile.weightKg * proteinFactor, 5)));
  const fat = Math.min(140, Math.max(45, roundTo(profile.weightKg * 0.8, 5)));
  const carbs = Math.min(550, Math.max(80, roundTo((calories - protein * 4 - fat * 9) / 4, 5)));

  return { calories, protein, carbs, fat };
}

export function goalLabel(goal: NutritionGoal) {
  if (goal === 'maintain') return 'Halten';
  if (goal === 'gain') return 'Stärker werden';
  return 'Reduzieren';
}

export function activityLabel(activity: ActivityLevel) {
  if (activity === 'low') return 'Meist sitzend';
  if (activity === 'high') return 'Sehr aktiv';
  return 'Leicht aktiv';
}

export function estimatedPace(goal: NutritionGoal) {
  if (goal === 'lose') return 'ca. 0,3 kg/Wo.';
  if (goal === 'gain') return 'ruhiger Aufbau';
  return 'Gewicht halten';
}
