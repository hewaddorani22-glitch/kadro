import type { Meal } from '@/types/nutrition';

/**
 * One clock for the whole app. The greeting and the meal a new entry is filed
 * under used to disagree ("Guten Tag" until 18:00, while a 16:00 entry was
 * already dinner); both now read the same boundaries.
 */
export const DAYPART_BOUNDARIES = { breakfastUntil: 11, lunchUntil: 15, dinnerUntil: 21, dayGreetingUntil: 17 } as const;

/** Default meal slot for something eaten at this local hour. */
export function mealTypeForHour(hour: number): Meal['type'] {
  if (hour < DAYPART_BOUNDARIES.breakfastUntil) return 'Breakfast';
  if (hour < DAYPART_BOUNDARIES.lunchUntil) return 'Lunch';
  if (hour < DAYPART_BOUNDARIES.dinnerUntil) return 'Dinner';
  return 'Snack';
}

/** Morning while breakfast is the default slot, evening from late afternoon. */
export function greetingForHour(hour: number): 'morning' | 'day' | 'evening' {
  if (hour < DAYPART_BOUNDARIES.breakfastUntil) return 'morning';
  if (hour < DAYPART_BOUNDARIES.dayGreetingUntil) return 'day';
  return 'evening';
}
