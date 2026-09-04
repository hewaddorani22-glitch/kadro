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

/**
 * A current logging streak remains alive until the end of today. If the user
 * has not logged yet today, yesterday is therefore the starting point. Meal
 * dates, not UTC timestamps, decide the day so travel and DST do not split it.
 */
export function currentLoggingStreak(meals: Meal[], today = new Date()): number {
  const loggedDates = new Set(meals.map((meal) => meal.date).filter((date): date is string => Boolean(date)));
  const todayKey = localDateKey(today);
  const cursor = dateFromKey(todayKey);
  if (!loggedDates.has(todayKey)) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (loggedDates.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
