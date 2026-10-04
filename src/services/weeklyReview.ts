import type { Meal } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

function calendarDate(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === key ? date : null;
}

function entriesByDay(meals: Meal[]) {
  const days = new Map<string, { calories: number; protein: number }>();
  const seen = new Set<string>();
  for (const meal of meals) {
    if (seen.has(meal.id) || meal.origin === 'seed' || !meal.date || !calendarDate(meal.date)
      || !Number.isFinite(meal.calories) || meal.calories < 0 || !Number.isFinite(meal.protein) || meal.protein < 0) continue;
    seen.add(meal.id);
    const totals = days.get(meal.date) ?? { calories: 0, protein: 0 };
    days.set(meal.date, { calories: totals.calories + meal.calories, protein: totals.protein + meal.protein });
  }
  return days;
}

function summarize(keys: string[], days: ReturnType<typeof entriesByDay>, currentCalorieTarget: number) {
  const logged = keys.flatMap(key => days.has(key) ? [days.get(key)!] : []);
  const totalProtein = logged.reduce((sum, day) => sum + day.protein, 0);
  return {
    from: keys[0], to: keys.at(-1)!, loggedDays: logged.length,
    totalProtein,
    averageCalories: logged.length ? Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / logged.length) : null,
    averageProtein: logged.length ? Math.round(totalProtein / logged.length) : null,
    // This is a comparison with today's target, never a claim about a past target
    // or complete dietary intake. A missing entry is not a successful zero day.
    daysNearCurrentTarget: currentCalorieTarget > 0 && Number.isFinite(currentCalorieTarget)
      ? logged.filter(day => Math.abs(day.calories - currentCalorieTarget) <= currentCalorieTarget * 0.1).length : null,
  };
}

/** Seven completed local calendar days versus the preceding seven. */
export function weeklyReview(meals: Meal[], currentCalorieTarget: number, today = localDateKey()) {
  const cursor = calendarDate(today);
  if (!cursor) throw new Error('invalid_review_day');
  const keys: string[] = [];
  for (let offset = 14; offset >= 1; offset--) {
    const date = new Date(cursor);
    date.setDate(date.getDate() - offset);
    keys.push(localDateKey(date));
  }
  const days = entriesByDay(meals);
  const current = summarize(keys.slice(7), days, currentCalorieTarget);
  const previous = summarize(keys.slice(0, 7), days, currentCalorieTarget);
  const proteinChangePercent = current.loggedDays >= 3 && previous.loggedDays >= 3 && previous.totalProtein > 0
    ? Math.round(((current.totalProtein / current.loggedDays) / (previous.totalProtein / previous.loggedDays) - 1) * 100) : null;
  return { current, previous, proteinChangePercent };
}

/** Actual logged days during the confirmed trial; no synthetic streak. */
export function trialActivity(meals: Meal[], startedAt: string | null | undefined, today = localDateKey()) {
  const started = startedAt ? new Date(startedAt) : null;
  if (!started || !Number.isFinite(started.getTime()) || !calendarDate(today)) return null;
  const from = localDateKey(started);
  if (from > today) return null;
  const days = entriesByDay(meals.filter(meal => {
    const saved = meal.savedAt ? Date.parse(meal.savedAt) : NaN;
    return Number.isFinite(saved) && saved >= started.getTime();
  }));
  const keys = [...days.keys()].filter(key => key >= from && key <= today).sort();
  return summarize(keys.length ? keys : [from], days, 0);
}
