import type { Meal } from '@/types/nutrition';

export type RepeatCandidate = {
  /** Stable key across days: same title and roughly the same size. */
  key: string;
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  count: number;
  lastEatenAt: string;
  source: Meal;
};

function bucket(calories: number) {
  // 50 kcal buckets, so "Skyr mit Beeren" at 340 and 355 is one entry rather
  // than two, while a genuinely different portion stays separate.
  return Math.round(calories / 50);
}

function keyOf(meal: Meal) {
  // Invariant: this is a grouping key, so it must not shift with the
  // interface language or the same meal would stop matching itself.
  return `${meal.title.trim().toLowerCase()}|${bucket(meal.calories)}`;
}

/**
 * The meals worth offering as one tap.
 *
 * People eat the same fifteen things. Repeating one costs no analysis call and
 * no waiting, which beats a larger food database for everyday use. Ordering
 * puts frequency first and recency second, so a daily breakfast outranks
 * yesterday's one-off.
 */
export function repeatCandidates(history: Meal[], limit = 8): RepeatCandidate[] {
  const groups = new Map<string, RepeatCandidate>();

  for (const meal of history) {
    if (meal.origin !== 'scan' && meal.origin !== 'plan') continue;
    if (!meal.title?.trim()) continue;

    const key = keyOf(meal);
    const savedAt = meal.savedAt ?? '';
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        title: meal.title.trim(),
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        fiber: meal.fiber ?? 0,
        count: 1,
        lastEatenAt: savedAt,
        source: meal,
      });
      continue;
    }

    existing.count += 1;
    if (savedAt > existing.lastEatenAt) {
      // Keep the most recent version's numbers: a corrected portion should win.
      existing.lastEatenAt = savedAt;
      existing.calories = meal.calories;
      existing.protein = meal.protein;
      existing.carbs = meal.carbs;
      existing.fat = meal.fat;
      existing.fiber = meal.fiber ?? 0;
      existing.source = meal;
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.lastEatenAt.localeCompare(a.lastEatenAt))
    .slice(0, limit);
}

/** Candidates not already logged today, so the list never suggests a duplicate. */
export function availableRepeats(history: Meal[], today: Meal[], limit = 8) {
  const eatenToday = new Set(today.map(keyOf));
  return repeatCandidates(history, limit + eatenToday.size)
    .filter((candidate) => !eatenToday.has(candidate.key))
    .slice(0, limit);
}

/** Yesterday's actual breakfast, including foods saved individually by search.
 * Reuse the ordinary repeat save path; never analyse or modify historical data.
 * Hide once any breakfast is logged today, including a corrected repeat.
 */
export function yesterdayBreakfast(history: Meal[], today: Meal[], day: string): RepeatCandidate | null {
  const logged = (meal: Meal) => meal.origin === 'scan' || meal.origin === 'plan';
  if (today.some(meal => logged(meal) && meal.type === 'Breakfast' && meal.date === day)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  // Calendar subtraction at local noon preserves the previous day over DST.
  const date = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return null;
  date.setDate(date.getDate() - 1);
  const yesterday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const seen = new Set<string>();
  const breakfast = history.filter(meal => {
    if (!logged(meal) || meal.type !== 'Breakfast' || meal.date !== yesterday || !meal.title?.trim() || seen.has(meal.id)) return false;
    seen.add(meal.id); return true;
  }).sort((a, b) => (a.savedAt ?? a.time).localeCompare(b.savedAt ?? b.time) || a.id.localeCompare(b.id));
  if (!breakfast.length) return null;
  const totals = breakfast.reduce((sum, meal) => ({
    calories: sum.calories + meal.calories, protein: sum.protein + meal.protein,
    carbs: sum.carbs + meal.carbs, fat: sum.fat + meal.fat, fiber: sum.fiber + (meal.fiber ?? 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const source: Meal = {
    ...breakfast[0], ...totals,
    id: `yesterday-breakfast-${yesterday}`,
    title: breakfast.map(meal => meal.title.trim()).join(' + '),
    confidence: breakfast.some(meal => meal.confidence === 'medium') ? 'medium' : 'high',
    items: breakfast.flatMap((meal, mealIndex) => meal.items.map((item, itemIndex) => ({ ...item, id: `repeat-${mealIndex}-${itemIndex}-${item.id}` }))),
    savedAt: breakfast[breakfast.length - 1].savedAt,
    sync: undefined,
  };
  return { key: keyOf(source), title: source.title, ...totals, count: 1, lastEatenAt: source.savedAt ?? '', source };
}
