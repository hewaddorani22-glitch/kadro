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

const DAY_MS = 24 * 60 * 60 * 1000;
/** Local noon keeps a DST switch from turning one day into 0.96 or 1.04. */
function dayNumber(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(new Date(year, month - 1, day, 12).getTime() / DAY_MS);
}

export type WeightChartPoint = { date: string; weightKg: number; day: number; x: number; y: number };

/**
 * Plot positions for the weight line. The x axis is time: two readings a week
 * apart sit a week apart, and a gap of ten days looks like a gap. It used to
 * space readings by their order, so three readings on consecutive days took up
 * as much width as a fortnight.
 */
export function weightChartLayout(
  entries: { date: string; weightKg: number }[],
  width: number,
  height: number,
  padding = { x: 10, y: 14 },
): { points: WeightChartPoint[]; spanDays: number } {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return { points: [], spanDays: 0 };
  const first = dayNumber(sorted[0].date);
  const spanDays = dayNumber(sorted[sorted.length - 1].date) - first;
  const min = Math.min(...sorted.map((entry) => entry.weightKg));
  const max = Math.max(...sorted.map((entry) => entry.weightKg));
  const range = max - min;
  const innerWidth = Math.max(0, width - padding.x * 2);
  const innerHeight = Math.max(0, height - padding.y * 2);
  return {
    spanDays,
    points: sorted.map((entry) => {
      const day = dayNumber(entry.date) - first;
      // A single day (or one reading) sits in the middle instead of on the edge.
      const x = padding.x + (spanDays > 0 ? (day / spanDays) * innerWidth : innerWidth / 2);
      // Equal readings are a flat trend, not a row of minimum values.
      const normalized = range === 0 ? 0.5 : (entry.weightKg - min) / range;
      const y = padding.y + (1 - normalized) * innerHeight;
      return { date: entry.date, weightKg: entry.weightKg, day, x, y };
    }),
  };
}
