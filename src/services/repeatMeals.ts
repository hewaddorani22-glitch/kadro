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
