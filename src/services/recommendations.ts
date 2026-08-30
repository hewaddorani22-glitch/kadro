import catalog from '@/data/mealCatalog.de.json';
import { MealContext, MealSuggestion, Nutrition } from '@/types/nutrition';

type CatalogEntry = Omit<MealSuggestion, 'contexts' | 'preferences' | 'source'> & {
  context: MealContext;
  tags: string[];
};

function score(entry: CatalogEntry, remaining: Nutrition, preferences: string[]) {
  const calorieTarget = Math.min(550, Math.max(380, remaining.calories * 0.38));
  const proteinTarget = Math.min(45, Math.max(28, remaining.protein * 0.48));
  const macroDistance = Math.abs(entry.calories - calorieTarget) / 80
    + Math.abs(entry.protein - proteinTarget) / 12
    + Math.max(0, entry.fat - remaining.fat * 0.35) / 10;
  const preferenceBonus = preferences.some((preference) => entry.tags.includes(preference)) ? -1.5 : 0;
  return macroDistance + preferenceBonus;
}

export function recommendMeals(
  context: MealContext,
  remaining: Nutrition,
  preferences: string[] = [],
): MealSuggestion[] {
  return (catalog as CatalogEntry[])
    .filter((entry) => entry.context === context)
    .map((entry) => ({ entry, score: score(entry, remaining, preferences) }))
    .sort((a, b) => a.score - b.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, 3)
    .map(({ entry }) => ({
      ...entry,
      contexts: [entry.context],
      preferences: entry.tags,
      source: { provider: 'kadro-catalog', label: 'Kadro-Katalog · geprüfte Schätzung' },
    }));
}

