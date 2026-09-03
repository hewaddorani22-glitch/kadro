import ingredientNames from '@/data/ingredientNames.json';
import ingredients from '@/data/ingredients.json';
import recipeSteps from '@/data/recipeSteps.json';
import recipes from '@/data/recipes.json';
import { getLanguage } from '@/i18n/active';
import type { Nutrition } from '@/types/nutrition';

export type RecipeIngredient = {
  key: string;
  name: string;
  grams: number;
  /** Where the per-100 g values came from, so the screen can name its source. */
  source: string;
};

export type Recipe = {
  id: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  nutrition: Nutrition;
};

type IngredientRecord = { usda?: string; off?: string; name: string; per100g: Nutrition };

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
export function getRecipe(mealId: string): Recipe | null {
  const entry = store[mealId];
  const text = steps[mealId];
  if (!entry || !text) return null;
  const language = getLanguage();
  return {
    id: mealId,
    servings: entry.servings,
    nutrition: entry.nutrition,
    steps: text[language] ?? text.en,
    ingredients: entry.ingredients.map((item) => {
      const record = table[item.key];
      return {
        key: item.key,
        grams: item.grams,
        name: names[item.key]?.[language] ?? names[item.key]?.en ?? item.key,
        source: record?.usda ? `USDA FDC ${record.usda}` : record?.off ? `Open Food Facts ${record.off}` : '',
      };
    }),
  };
}
