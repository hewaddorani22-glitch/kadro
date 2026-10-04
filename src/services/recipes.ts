import ingredientNames from '@/data/ingredientNames.json';
import ingredients from '@/data/ingredients.json';
import recipeSteps from '@/data/recipeSteps.json';
import recipes from '@/data/recipes.json';
import { getDictionary, getLanguage } from '@/i18n/active';
import type { Nutrition } from '@/types/nutrition';
import { recipePortion, scaleSuggestedNutrition } from '@/utils/mealSuggestions';

export type RecipeIngredient = {
  key: string;
  name: string;
  grams: number;
  /** Where the per-100 g values came from, so the screen can name its source. */
  source: string;
  referenceState: string;
  weighingState: string;
  weighingLabel: string;
};

export type Recipe = {
  id: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  nutrition: Nutrition;
};

type IngredientRecord = { usda?: string; off?: string; bls?: string; name: string; per100g: Nutrition; referenceState: string; weighingState: string };

const table = ingredients as Record<string, IngredientRecord>;
const names = ingredientNames as Record<string, { de: string; en: string }>;
const steps = recipeSteps as Record<string, { de: string[]; en: string[] }>;
const store = recipes as Record<string, {
  servings: number;
  ingredients: { key: string; grams: number }[];
  nutrition: Nutrition;
}>;

/** True when a meal suggestion has cooking instructions behind it. */
export function hasRecipe(mealId: string) {
  return Boolean(store[mealId]);
}

/**
 * A suggestion that ends at "520 kcal" leaves the reader with the question
 * they actually had, which is how to make it. Only the home dishes carry a
 * recipe; a bakery sandwich is bought, not cooked.
 */
export function getRecipe(mealId: string, requestedPortion = 1): Recipe | null {
  const entry = store[mealId];
  const text = steps[mealId];
  if (!entry || !text) return null;
  const language = getLanguage();
  const factor = recipePortion(requestedPortion);
  return {
    id: mealId,
    servings: entry.servings * factor,
    nutrition: scaleSuggestedNutrition(entry.nutrition, factor),
    // Scale explicit quantities too, leaving cooking times and temperatures
    // untouched. Existing recipes use ml and tablespoons for cooking liquid.
    steps: [getDictionary().recipe.weighingInstructions,
      ...(text[language] ?? text.en)].map((step) => factor === 1 ? step : step.replace(
      /\b(\d+(?:[.,]\d+)?)\s*(ml|g|EL|TL|tbsp|tsp)\b/g,
      (_, value: string, unit: string) => `${(Math.round(Number(value.replace(',', '.')) * factor * 10) / 10).toLocaleString(language)} ${unit}`,
    )),
    ingredients: entry.ingredients.map((item) => {
      const record = table[item.key];
      return {
        key: item.key,
        grams: Math.round(item.grams * factor * 10) / 10,
        name: names[item.key]?.[language] ?? names[item.key]?.en ?? item.key,
        referenceState: record.referenceState,
        weighingState: record.weighingState,
        weighingLabel: getDictionary().recipe.weighingStates[record.weighingState as keyof ReturnType<typeof getDictionary>['recipe']['weighingStates']] ?? '',
        source: record?.bls ? `BLS 4.0 ${record.bls}` : record?.usda ? `USDA FDC ${record.usda}` : record?.off ? `Open Food Facts ${record.off}` : '',
      };
    }),
  };
}
