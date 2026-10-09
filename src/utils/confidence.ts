import type { MealItem } from '@/types/nutrition';
import { needsIngredientCorrection } from '@/utils/ingredientCorrection';

/**
 * Three honest states instead of one label for everything:
 * - sure: database values at an amount the user gave or picked,
 * - estimated: a recognised food at a guessed portion,
 * - check: something Kandro could not match on its own.
 */
export type ConfidenceLevel = 'sure' | 'estimated' | 'check';

export function draftConfidence(
  items: MealItem[],
  { autoMatchedIds = [], portionEstimated = false, uncertainHint = false }: { autoMatchedIds?: string[]; portionEstimated?: boolean; uncertainHint?: boolean } = {},
): ConfidenceLevel {
  const included = items.filter((item) => item.included);
  // An unresolved row blocks saving even when excluded, so it always asks for a check.
  if (items.some(needsIngredientCorrection) || included.some((item) => autoMatchedIds.includes(item.id))) return 'check';
  if (portionEstimated || uncertainHint || included.some((item) => item.confidence === 'medium')) return 'estimated';
  return 'sure';
}
