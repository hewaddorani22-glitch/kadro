import { Meal } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';
import { getLocale } from '@/i18n/active';

export type DayProtein = {
  key: string;
  /** Single-letter German weekday, for the compact strip. */
  label: string;
  protein: number;
  /** Share of the target, clamped to 1.2 so one huge day cannot flatten the rest. */
  ratio: number;
  reached: boolean;
  logged: boolean;
  today: boolean;
};

// Narrow German weekdays collide: Mo and Mi are both "M", Di and Do both "D".
// Two letters cost nothing and are actually readable.
/**
 * Weekday initials from the platform, not a hardcoded German list: the strip
 * read "Do Fr Sa So Mo Di Mi" to English users.
 */
function shortWeekday(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
}

/**
 * Protein per day for the last `days` days.
 *
 * Weight is a poor daily signal for this audience: it swings a kilo or two on
 * water alone, and when someone is building muscle "up" is the goal, which
 * inverts the usual reading. Hitting the protein target is the thing they
 * actually control day to day, so that is what the screen leads with.
 */
export function proteinByDay(meals: Meal[], targetProtein: number, days = 7): DayProtein[] {
  const todayKey = localDateKey();
  const safeTarget = targetProtein > 0 ? targetProtein : 1;

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const key = localDateKey(date);
    const onDay = meals.filter((meal) => meal.date === key);
    const protein = onDay.reduce((sum, meal) => sum + meal.protein, 0);

    return {
      key,
      label: shortWeekday(date, getLocale()),
      protein,
      ratio: Math.min(1.2, protein / safeTarget),
      // 90% counts as reached: demanding the exact number would make the strip
      // punish a day that went fine.
      reached: protein >= safeTarget * 0.9,
      logged: onDay.length > 0,
      today: key === todayKey,
    };
  });
}

export type ConsistencySummary = {
  days: DayProtein[];
  reachedCount: number;
  loggedCount: number;
  averageProtein: number;
};

export function proteinConsistency(meals: Meal[], targetProtein: number, days = 7): ConsistencySummary {
  const byDay = proteinByDay(meals, targetProtein, days);
  const logged = byDay.filter((day) => day.logged);

  return {
    days: byDay,
    reachedCount: byDay.filter((day) => day.reached).length,
    loggedCount: logged.length,
    // Averaged over logged days only; empty days would otherwise read as a
    // failure the user never had.
    averageProtein: logged.length
      ? Math.round(logged.reduce((sum, day) => sum + day.protein, 0) / logged.length)
      : 0,
  };
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export const WEEKLY_LOG_GOAL = 4;

export type WeeklyLoggingGoal = {
  days: { key: string; logged: boolean; today: boolean }[];
  logged: number;
  goal: number;
  reached: boolean;
};

/**
 * A forgiving weekly goal instead of a streak: how many of the last seven
 * local days (today included) have at least one entry, against a goal of four.
 * A missed day never resets anything, so there is nothing to "lose" and the
 * promise "keine Serien, kein Druck" stays true. Meal dates, not UTC
 * timestamps, decide the day so travel and DST do not split it.
 */
export function weeklyLoggingGoal(meals: Meal[], today = new Date()): WeeklyLoggingGoal {
  const loggedDates = new Set(meals.filter((meal) => meal.origin !== 'seed').map((meal) => meal.date).filter((date): date is string => Boolean(date)));
  const anchor = dateFromKey(localDateKey(today));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - (6 - index));
    const key = localDateKey(date);
    return { key, logged: loggedDates.has(key), today: index === 6 };
  });
  const logged = days.filter((day) => day.logged).length;
  return { days, logged, goal: WEEKLY_LOG_GOAL, reached: logged >= WEEKLY_LOG_GOAL };
}

/** Newest real save; older rows without a timestamp count from midday of their day. */
export function lastMealSavedAt(meals: Meal[]): number | null {
  let latest: number | null = null;
  for (const meal of meals) {
    if (meal.origin === 'seed') continue;
    const saved = meal.savedAt ? Date.parse(meal.savedAt) : meal.date ? Date.parse(`${meal.date}T12:00:00`) : NaN;
    if (Number.isFinite(saved) && (latest === null || saved > latest)) latest = saved;
  }
  return latest;
}
