import { initializeCloudProfile, loadCloudMeals, saveCloudMeal } from '@/services/cloudRepository';
import { loadStoredScans, saveMeal as saveLocalMeal } from '@/services/localRepository';
import { DEFAULT_TARGETS, INITIAL_MEALS } from '@/services/mockNutrition';
import { DailyTargets, Meal } from '@/types/nutrition';

export type SyncMode = 'local' | 'syncing' | 'cloud' | 'error';

export type HydratedCloudState = {
  meals: Meal[];
  targets: DailyTargets;
  userName: string;
};

export async function hydrateCloudState(): Promise<HydratedCloudState | null> {
  const profile = await initializeCloudProfile(DEFAULT_TARGETS);
  if (!profile) return null;

  const localScans = await loadStoredScans();
  await Promise.all(localScans.map((meal) => saveCloudMeal(meal)));
  const cloudMeals = await loadCloudMeals();

  return {
    meals: [...INITIAL_MEALS, ...cloudMeals],
    targets: profile.targets,
    userName: profile.userName,
  };
}

export async function saveSyncedMeal(meal: Meal): Promise<Meal[]> {
  const localMeals = await saveLocalMeal(meal);
  void saveCloudMeal(meal).catch(() => {
    // The local record remains authoritative until the next successful hydration.
  });
  return localMeals;
}
