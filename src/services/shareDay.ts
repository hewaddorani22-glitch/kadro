import type { Meal } from '@/types/nutrition';
import { mealTypeForHour } from '@/utils/daypart';

/**
 * The shareable day: what the Story card shows and what the text share says.
 *
 * Privacy is decided here, not in the view. The card carries only what the
 * person switched on, weight stays off by default and is only ever a change,
 * and the text message never contains a body measurement at all.
 */

export type MealSlot = Meal['type'];
const ORDER: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** Below this the day counts as complete, same threshold as Today and Result. */
export const DAY_DONE_BELOW = 200;

/**
 * The slot the next ideas are for: the one after the meal just logged, but
 * never one the clock has already passed. A snack hands over to the clock.
 */
export function nextMealSlot(logged: MealSlot | null | undefined, hour: number): MealSlot {
  const clock = mealTypeForHour(hour);
  if (!logged || logged === 'Snack') return clock;
  const after = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(logged) + 1)];
  return ORDER[Math.max(ORDER.indexOf(after), ORDER.indexOf(clock))];
}

/** The latest main meal of the day by its place in the day; snacks do not move it. */
export function latestMainSlot(types: MealSlot[]): MealSlot | null {
  const main = types.filter((type) => type !== 'Snack').map((type) => ORDER.indexOf(type));
  return main.length ? ORDER[Math.max(...main)] : null;
}

export type ShareDayOptions = { showProtein: boolean; showWeight: boolean };
/** Weight is never on the card unless the person turns it on for this share. */
export const DEFAULT_SHARE_OPTIONS: ShareDayOptions = { showProtein: true, showWeight: false };

export type ShareDayInput = {
  consumedCalories: number;
  targetCalories: number;
  consumedProtein: number;
  targetProtein: number;
  /** Ranges for the next meal, from the recommendation preview. */
  next: { calories: [number, number]; protein: [number, number] } | null;
  slot: MealSlot;
  /** Change over the visible window in kilograms, or null without two readings. */
  weightChangeKg: number | null;
  /** Adults only; the teen view never offers weight. */
  weightAllowed: boolean;
};

export type ShareDayCardModel = {
  remainingCalories: number;
  overCalories: number;
  dayDone: boolean;
  ringRatio: number;
  protein: { current: number; target: number } | null;
  next: { slot: MealSlot; calories: [number, number]; protein: [number, number] } | null;
  weightChangeKg: number | null;
};

const finite = (value: number) => (Number.isFinite(value) ? value : 0);

export function shareDayCard(input: ShareDayInput, options: ShareDayOptions = DEFAULT_SHARE_OPTIONS): ShareDayCardModel {
  const consumed = Math.max(0, Math.round(finite(input.consumedCalories)));
  const target = Math.max(0, Math.round(finite(input.targetCalories)));
  const remaining = Math.max(0, target - consumed);
  const dayDone = remaining < DAY_DONE_BELOW;
  return {
    remainingCalories: remaining,
    overCalories: Math.max(0, consumed - target),
    dayDone,
    ringRatio: target > 0 ? Math.min(1, consumed / target) : 0,
    protein: options.showProtein && input.targetProtein > 0
      ? { current: Math.max(0, Math.round(finite(input.consumedProtein))), target: Math.round(input.targetProtein) }
      : null,
    next: !dayDone && input.next ? { slot: input.slot, calories: input.next.calories, protein: input.next.protein } : null,
    weightChangeKg: options.showWeight && input.weightAllowed && input.weightChangeKg !== null && Number.isFinite(input.weightChangeKg)
      ? input.weightChangeKg
      : null,
  };
}

export type ShareMessageCopy = { message: (kcal: string) => string; messageDone: string; appStoreHint: string };

/**
 * The text share. It always ends with the App Store hint, and it only ever
 * mentions the calories left: no weight, no meals, no name.
 */
export function shareDayMessage(copy: ShareMessageCopy, card: Pick<ShareDayCardModel, 'remainingCalories' | 'dayDone'>, formatKcal: (value: number) => string) {
  const body = card.dayDone ? copy.messageDone : copy.message(formatKcal(card.remainingCalories));
  return `${body} ${copy.appStoreHint}`;
}
