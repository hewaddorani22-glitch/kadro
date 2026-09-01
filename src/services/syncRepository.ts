import { deleteCloudMeal, hasCloudMeal, initializeCloudProfile, loadCloudMealHistory, saveCloudMeal, saveCloudProfile } from '@/services/cloudRepository';
import {
  deleteMeal as deleteLocalMeal,
  forgetDeletedMeal,
  loadAllStoredScans,
  loadDeletedMealIds,
  loadProfile,
  rememberDeletedMeal,
  saveMeal as saveLocalMeal,
} from '@/services/localRepository';
import { DEFAULT_TARGETS } from '@/services/mockNutrition';
import { calculateDailyTargets } from '@/services/personalization';
import { DailyTargets, Meal, UserProfile } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

export type SyncMode = 'local' | 'syncing' | 'cloud' | 'error';

export type HydratedCloudState = {
  meals: Meal[];
  mealHistory: Meal[];
  hasEverLoggedScan: boolean;
  targets: DailyTargets;
  profile: UserProfile;
};

export async function hydrateCloudState(): Promise<HydratedCloudState | null> {
  const localProfile = await loadProfile();
  const initialTargets = localProfile.completedAt ? calculateDailyTargets(localProfile) : DEFAULT_TARGETS;
  let cloud = await initializeCloudProfile(localProfile, initialTargets);
  if (!cloud) return null;

  const localIsNewer = Boolean(
    localProfile.completedAt
    && (!cloud.profile.completedAt || new Date(localProfile.completedAt) > new Date(cloud.profile.completedAt)),
  );
  if (localIsNewer) {
    await saveCloudProfile(localProfile, initialTargets);
    cloud = { ...cloud, profile: localProfile, targets: initialTargets };
  }

  const [localScans, deletedIds] = await Promise.all([loadAllStoredScans(), loadDeletedMealIds()]);
  const deleted = new Set(deletedIds);

  // Retry deletions that never reached the cloud, and drop the tombstone once
  // the server confirms. Until then the id stays filtered out below.
  await Promise.all(deletedIds.map((id) => deleteCloudMeal(id).then(
    (removed) => (removed ? forgetDeletedMeal(id) : undefined),
    () => undefined,
  )));

  await Promise.all(localScans.map((meal) => saveCloudMeal(meal)));
  const [cloudMeals, cloudHasMeal] = await Promise.all([loadCloudMealHistory(), hasCloudMeal()]);
  const merged = [...cloudMeals, ...localScans]
    .filter((meal) => !deleted.has(meal.id))
    .filter((meal, index, meals) => meals.findIndex((candidate) => candidate.id === meal.id) === index)
    .sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
  const today = localDateKey();

  return {
    meals: merged.filter((meal) => meal.date === today),
    mealHistory: merged,
    hasEverLoggedScan: cloudHasMeal || localScans.length > 0,
    targets: cloud.targets,
    profile: cloud.profile,
  };
}

export async function syncUserSetup(profile: UserProfile, targets: DailyTargets) {
  return saveCloudProfile(profile, targets);
}

export async function deleteSyncedMeal(id: string): Promise<Meal[]> {
  const localMeals = await deleteLocalMeal(id);
  // Recorded before the network call, so an offline delete still sticks.
  await rememberDeletedMeal(id);
  void deleteCloudMeal(id)
    .then((removed) => (removed ? forgetDeletedMeal(id) : undefined))
    .catch(() => {
      // Retried on the next hydration; the tombstone keeps it off screen meanwhile.
    });
  return localMeals;
}

export async function saveSyncedMeal(meal: Meal): Promise<Meal[]> {
  const localMeals = await saveLocalMeal(meal);
  void saveCloudMeal(meal).catch(() => {
    // The local record remains authoritative until the next successful hydration.
  });
  return localMeals;
}
