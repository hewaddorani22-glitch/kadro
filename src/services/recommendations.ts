import dietaryTerms from '@/data/dietaryTerms.json';
import ingredientDiet from '@/data/ingredientDiet.json';
import recipeStore from '@/data/recipes.json';
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
const recipes = recipeStore as Record<string, { ingredients: { key: string; grams: number }[] }>;
const porkWords = new RegExp(dietaryTerms.pork.join('|'), 'i');
const lactoseWords = new RegExp(dietaryTerms.lactose.join('|'), 'i');
/** "without cheese" names an absence; matching it would hide a safe meal. */
const negated = /\b(?:ohne|without|no)\s+\S+/gi;

const diet = ingredientDiet as {
  diet: { meat: string[]; fish: string[]; vegetarian: string[]; vegan: string[] };
  lactose: string[];
  pork: string[];
};
const lactoseIngredients = new Set(diet.lactose);
const porkIngredients = new Set(diet.pork);
const meatIngredients = new Set([...diet.diet.meat, ...diet.diet.fish]);
const veganIngredients = new Set(diet.diet.vegan);

/**
 * The ingredient list, when there is one, beats the description.
 *
 * Reading the prose was all there was before recipes existed, and it let four
 * dishes through whose descriptions never mentioned the yoghurt, parmesan or
 * cream cheese their recipes contain — a lactose-free reader was offered all
 * four. Where a recipe exists it is what the person will actually cook, so it
 * is what gets checked; the prose stays the answer for bought food.
 */
function matchesDietaryConstraints(entry: CatalogEntry, preferences: string[]) {
  const recipe = recipes[entry.id];
  if (recipe) {
    const keys = recipe.ingredients.map((item) => item.key);
    if (preferences.includes('vegan') && keys.some((key) => !veganIngredients.has(key))) return false;
    if (preferences.includes('vegetarian') && keys.some((key) => meatIngredients.has(key))) return false;
    if (preferences.includes('pork-free') && keys.some((key) => porkIngredients.has(key))) return false;
    if (preferences.includes('lactose-free') && keys.some((key) => lactoseIngredients.has(key))) return false;
    return true;
  }
  const copy = `${entry.title} ${entry.detail}`.replace(negated, ' ');
  if (preferences.includes('vegan') && !entry.tags.includes('vegan')) return false;
  if (preferences.includes('vegetarian') && !entry.tags.some((tag) => tag === 'vegetarian' || tag === 'vegan')) return false;
  if (preferences.includes('pork-free') && porkWords.test(copy)) return false;
  if (preferences.includes('lactose-free') && lactoseWords.test(copy)) return false;
  return true;
}

function score(entry: CatalogEntry, remaining: Nutrition, preferences: string[]) {
  const calorieTarget = Math.min(550, Math.max(380, remaining.calories * 0.38));
  const proteinTarget = Math.min(45, Math.max(28, remaining.protein * 0.48));
  const macroDistance = Math.abs(entry.calories - calorieTarget) / 80
    + Math.abs(entry.protein - proteinTarget) / 12
    + Math.max(0, entry.fat - remaining.fat * 0.35) / 10;
  // One bonus per preference the meal actually satisfies, so choosing two
  // things you care about outranks a meal that only happens to fit one.
  // 'quick' is a tag now rather than a phrase parsed out of the localised time
  // string, which only ever matched German.
  const matched = preferences.filter((preference) => entry.tags.includes(preference)).length;
  return macroDistance - matched * 1.5;
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
