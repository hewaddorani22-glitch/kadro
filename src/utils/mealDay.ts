import type { Meal } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';
import { mealTypeForHour } from '@/utils/daypart';

/** Logging reaches back four weeks; older days are history, not a diary to fill. */
export const MAX_BACKDATE_DAYS = 30;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A believable clock time for a meal logged after the fact. "Yesterday's
 * lunch" saved at 21:40 tonight would otherwise sort after dinner and show
 * the wrong time everywhere the meal appears.
 */
const SLOT_CLOCK: Record<Meal['type'], [number, number]> = {
  Breakfast: [8, 0],
  Lunch: [12, 30],
  Snack: [15, 30],
  Dinner: [19, 0],
};

/** The slot the clock suggests when nobody has chosen one (the shared daypart clock). */
export function mealTypeForTime(date = new Date()): Meal['type'] {
  return mealTypeForHour(date.getHours());
}

/** Calendar arithmetic at local noon, so a DST change never skips a day. */
export function shiftDateKey(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

/** Whole days from `key` back to `today` (0 = today, 1 = yesterday). */
export function daysAgo(key: string, today = localDateKey()) {
  const from = new Date(`${key}T12:00:00`).getTime();
  const to = new Date(`${today}T12:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/** Never in the future, never older than the back-dating window. */
export function clampLogDate(key: string | null | undefined, today = localDateKey()) {
  if (!key || !DAY_KEY.test(key) || key >= today) return today;
  const earliest = shiftDateKey(today, -MAX_BACKDATE_DAYS);
  return key < earliest ? earliest : key;
}

/**
 * When a meal is filed: now for today, otherwise the slot's usual time on the
 * chosen day. The timestamp becomes eaten_at in the cloud, so it must belong
 * to the same calendar day as meal_date.
 */
export function mealMoment(date: string | null | undefined, type: Meal['type'], now = new Date()) {
  const today = localDateKey(now);
  const day = clampLogDate(date, today);
  if (day === today) return { date: today, at: now };
  const [hours, minutes] = SLOT_CLOCK[type];
  return { date: day, at: new Date(`${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`) };
}
