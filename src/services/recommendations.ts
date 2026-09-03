import dietaryTerms from '@/data/dietaryTerms.json';
import catalogDe from '@/data/mealCatalog.de.json';
import catalogEn from '@/data/mealCatalog.en.json';
import { getDictionary, getLanguage } from '@/i18n/active';
import { MealContext, MealSuggestion, Nutrition } from '@/types/nutrition';

type CatalogEntry = Omit<MealSuggestion, 'contexts' | 'preferences' | 'source'> & {
  context: MealContext;
  tags: string[];
};

/**
 * The dietary words live in a shared file because both catalogues describe the
 * same 200 meals and must filter identically. A German-only word list silently
 * stopped excluding pork and dairy the moment the app also spoke English.
 */
const porkWords = new RegExp(dietaryTerms.pork.join('|'), 'i');
const lactoseWords = new RegExp(dietaryTerms.lactose.join('|'), 'i');
/** "without cheese" names an absence; matching it would hide a safe meal. */
const negated = /\b(?:ohne|without|no)\s+\S+/gi;

function matchesDietaryConstraints(entry: CatalogEntry, preferences: string[]) {
  const copy = `${entry.title} ${entry.detail}`.replace(negated, ' ');
  if (preferences.includes('vegetarian') && !entry.tags.some((tag) => tag === 'vegetarian' || tag === 'vegan')) return false;
  if (preferences.includes('pork-free') && porkWords.test(copy)) return false;
  if (preferences.includes('lactose-free') && lactoseWords.test(copy)) return false;
  return true;
}

function isQuick(entry: CatalogEntry) {
  if (/direkt|ohne kochen|mikrowelle/i.test(entry.time)) return true;
  const minutes = Number(entry.time.match(/\d+/)?.[0] ?? 99);
  return minutes <= 20;
}

function score(entry: CatalogEntry, remaining: Nutrition, preferences: string[]) {
  const calorieTarget = Math.min(550, Math.max(380, remaining.calories * 0.38));
  const proteinTarget = Math.min(45, Math.max(28, remaining.protein * 0.48));
  const macroDistance = Math.abs(entry.calories - calorieTarget) / 80
    + Math.abs(entry.protein - proteinTarget) / 12
    + Math.max(0, entry.fat - remaining.fat * 0.35) / 10;
  const preferenceBonus = preferences.some((preference) => entry.tags.includes(preference)) ? -1.5 : 0;
  const quickBonus = preferences.includes('quick') && isQuick(entry) ? -1.2 : 0;
  return macroDistance + preferenceBonus + quickBonus;
}

/** The dish name in the reader's language, for screens that only have an id. */
export function recipeTitle(mealId: string) {
  const catalog = getLanguage() === 'de' ? catalogDe : catalogEn;
  return (catalog as CatalogEntry[]).find((entry) => entry.id === mealId)?.title ?? '';
}

export function recommendMeals(
  context: MealContext,
  remaining: Nutrition,
  preferences: string[] = [],
): MealSuggestion[] {
  const catalog = (getLanguage() === 'de' ? catalogDe : catalogEn) as CatalogEntry[];
  return catalog
    .filter((entry) => entry.context === context)
    .filter((entry) => matchesDietaryConstraints(entry, preferences))
    .map((entry) => ({ entry, score: score(entry, remaining, preferences) }))
    .sort((a, b) => a.score - b.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, 3)
    .map(({ entry }) => ({
      ...entry,
      contexts: [entry.context],
      preferences: entry.tags,
      // These are hand-built typical values, not sourced measurements. Calling
      // them "geprüft" claimed a provenance the catalog does not have.
      source: { provider: 'kandro-catalog', label: getDictionary().errors.catalogSourceLabel },
    }));
}
