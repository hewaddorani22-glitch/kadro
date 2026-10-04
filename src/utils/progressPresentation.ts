import type { Meal, UserProfile, WeightEntry } from '@/types/nutrition';
import { isTeenProfile } from '@/services/personalization';
import { localDateKey } from '@/utils/date';

/** Display selection only: no new targets, stored state or inferred measurements. */
export function progressPresentation(profile: UserProfile, meals: Meal[], weights: WeightEntry[], today: string) {
  const [year, month, day] = today.split('-').map(Number);
  const start = new Date(year, month - 1, day, 12);
  start.setDate(start.getDate() - 29);
  const firstDay = localDateKey(start);
  const inWindow = (date: string) => date >= firstDay && date <= today;
  const visibleWeights = weights.filter(entry => inWindow(entry.date)).sort((a, b) => a.date.localeCompare(b.date));
  const chartWeights = visibleWeights.slice(-12);
  const currentWeight = visibleWeights.at(-1)?.weightKg ?? profile.weightKg;
  return {
    context: isTeenProfile(profile) ? 'teen' as const : profile.goal,
    visibleWeights,
    chartWeights,
    visibleMeals: meals.filter(meal => inWindow(meal.date ?? '')),
    currentWeight,
    weightChange: visibleWeights.length > 1 ? currentWeight - visibleWeights[0].weightKg : 0,
  };
}
