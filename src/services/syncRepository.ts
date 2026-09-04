import { deleteCloudMeal, hasCloudAnalyzedMeal, initializeCloudProfile, loadCloudMealHistory, saveCloudMeal, saveCloudProfile } from '@/services/cloudRepository';
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
import { calculateDailyTargets, DEFAULT_PROFILE } from '@/services/personalization';
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

export function hasAnalyzedMeal(meals: Meal[]) {
  return meals.some((meal) => meal.origin === 'scan');
}

export function shouldPromoteLocalProfile(
  localCompletedAt: string | null,
  cloudCompletedAt: string | null,
  cloudAgeDeclared: boolean,
) {
  return Boolean(
    localCompletedAt
    && cloudAgeDeclared
    && (!cloudCompletedAt || new Date(localCompletedAt) > new Date(cloudCompletedAt)),
  );
}

export async function hydrateCloudState(): Promise<HydratedCloudState | null> {
  const localProfile = await loadProfile();
  const initialTargets = localProfile.completedAt ? calculateDailyTargets(localProfile) : DEFAULT_TARGETS;
  let cloud = await initializeCloudProfile(localProfile, initialTargets);
  if (!cloud) return null;

  const localIsNewer = shouldPromoteLocalProfile(
    localProfile.completedAt,
    cloud.profile.completedAt,
    cloud.ageDeclared,
  );
  // A missing cloud age is authoritative. In particular, the release migration
  // deliberately clears ambiguous age=18 rows that may really have been 16/17
  // before an older schema rewrite. Never "heal" that safety marker from a
  // completed local copy. By contrast, age present + missing height/weight is
  // a normal interrupted onboarding and the completed local profile may repair
  // it without making the user answer everything twice.
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
  const [cloudMeals, cloudHasAnalyzedMeal] = await Promise.all([loadCloudMealHistory(), hasCloudAnalyzedMeal()]);
  const merged = [...cloudMeals, ...localScans]
    .filter((meal) => !deleted.has(meal.id))
    .filter((meal, index, meals) => meals.findIndex((candidate) => candidate.id === meal.id) === index)
    .sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
  const today = localDateKey();

  return {
    meals: merged.filter((meal) => meal.date === today),
    mealHistory: merged,
    hasEverLoggedScan: cloudHasAnalyzedMeal || hasAnalyzedMeal(localScans),
    targets: cloud.targets,
    profile: cloud.profile,
  };
}

/**
 * Loads an account that already existed before this device signed in.
 *
 * This path is deliberately cloud-authoritative. The regular hydration path
 * uploads local meals and may promote a newer local profile, which is correct
 * for one account recovering from offline use but would disclose one person's
 * wellness data to another account after a credential sign-in.
 */
export async function hydrateExistingCloudAccount(): Promise<HydratedCloudState | null> {
  const cloud = await initializeCloudProfile(DEFAULT_PROFILE, DEFAULT_TARGETS, true);
  if (!cloud) return null;

  const [cloudMeals, cloudHasAnalyzedMeal] = await Promise.all([
    loadCloudMealHistory(),
    hasCloudAnalyzedMeal(),
  ]);
  const mealHistory = cloudMeals
    .filter((meal, index, meals) => meals.findIndex((candidate) => candidate.id === meal.id) === index)
    .sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
  const today = localDateKey();

  return {
    meals: mealHistory.filter((meal) => meal.date === today),
    mealHistory,
    hasEverLoggedScan: cloudHasAnalyzedMeal,
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
