import AsyncStorage from '@react-native-async-storage/async-storage';

import { PendingAnalysis } from '@/services/contracts';
import { DEFAULT_PROFILE, isBiologicalSex } from '@/services/personalization';
import { Meal, UserProfile, WeightEntry } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';
import { defaultUnitSystem, isUnitSystem } from '@/utils/units';
import { isAnalysisRequestId, newAnalysisRequestId } from '@/utils/requestId';

const MEALS_KEY = '@kandro/meals:v1';
const QUEUE_KEY = '@kandro/analysis-queue:v1';
const PROFILE_KEY = '@kandro/profile:v1';
const WEIGHTS_KEY = '@kandro/weight-entries:v1';
const LIFETIME_SCANS_KEY = '@kandro/lifetime-scans:v1';
const COUNTED_SCAN_IDS_KEY = '@kandro/counted-analysis-ids:v1';
const DELETED_MEALS_KEY = '@kandro/deleted-meals:v1';
const ACCOUNT_SWITCH_PENDING_KEY = '@kandro/account-switch-pending:v1';
let scanCountMutation: Promise<number> = Promise.resolve(0);

/** Origins that count as "the user ate this". 'seed' is demo filler and never persists. */
const LOGGED_ORIGINS = new Set(['scan', 'plan']);

function isLogged(meal: Meal) {
  return LOGGED_ORIGINS.has(meal.origin ?? '');
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadMeals(): Promise<Meal[]> {
  const date = localDateKey();
  return loadStoredScans(date);
}

export async function loadStoredScans(date = localDateKey()): Promise<Meal[]> {
  const stored = await readJson<Meal[]>(MEALS_KEY, []);
  return stored.filter((meal) => isLogged(meal) && meal.date === date);
}

export async function loadAllStoredScans(): Promise<Meal[]> {
  const stored = await readJson<Meal[]>(MEALS_KEY, []);
  return stored
    .filter(isLogged)
    .sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
}

export async function saveMeal(meal: Meal): Promise<Meal[]> {
  const current = await readJson<Meal[]>(MEALS_KEY, []);
  const next = [...current.filter((entry) => isLogged(entry) && entry.id !== meal.id), meal];
  await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(next));
  return loadMeals();
}

export async function deleteMeal(id: string): Promise<Meal[]> {
  const current = await readJson<Meal[]>(MEALS_KEY, []);
  await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(current.filter((meal) => meal.id !== id)));
  return loadMeals();
}

/**
 * Ids the user removed. The local delete is immediate, but the cloud call can
 * fail offline: without a tombstone the next hydration would merge the meal
 * straight back onto the user's day. Kept small and pruned on success.
 */
export async function loadDeletedMealIds(): Promise<string[]> {
  const stored = await readJson<unknown>(DELETED_MEALS_KEY, []);
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string').slice(-200) : [];
}

export async function rememberDeletedMeal(id: string) {
  const current = await loadDeletedMealIds();
  if (current.includes(id)) return;
  await AsyncStorage.setItem(DELETED_MEALS_KEY, JSON.stringify([...current, id].slice(-200)));
}

export async function forgetDeletedMeal(id: string) {
  const current = await loadDeletedMealIds();
  await AsyncStorage.setItem(DELETED_MEALS_KEY, JSON.stringify(current.filter((entry) => entry !== id)));
}

export async function loadAnalysisQueue(): Promise<PendingAnalysis[]> {
  const stored = await readJson<PendingAnalysis[]>(QUEUE_KEY, []);
  let migrated = false;
  const queue = stored.map((job) => {
    if (isAnalysisRequestId(job.id)) return job;
    migrated = true;
    return { ...job, id: newAnalysisRequestId() };
  }).slice(-3);
  // Builds created before the server ledger used `scan-<timestamp>`. Persist a
  // UUID once so every later retry reaches the same idempotent reservation.
  if (migrated) await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return queue;
}

export async function queueAnalysis(job: PendingAnalysis): Promise<number> {
  const current = await loadAnalysisQueue();
  const next = [...current.filter((entry) => entry.id !== job.id), job].slice(-3);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next.length;
}

export async function removeQueuedAnalysis(id: string): Promise<number> {
  const current = await loadAnalysisQueue();
  const next = current.filter((entry) => entry.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  return next.length;
}

export async function clearAnalysisQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

/**
 * Monotonic count of successful AI results on this device. Meal history is
 * pruned and a user may abandon Confirm, so the allowance cannot be derived
 * from saved meals alone.
 */
export async function loadLifetimeScanCount(): Promise<number> {
  const [stored, ledger] = await Promise.all([
    readJson<unknown>(LIFETIME_SCANS_KEY, 0),
    readJson<unknown>(COUNTED_SCAN_IDS_KEY, []),
  ]);
  const storedValue = Number(stored);
  const ledgerValue = ledger && typeof ledger === 'object' && !Array.isArray(ledger)
    ? Number((ledger as { count?: unknown }).count)
    : 0;
  return Math.max(
    Number.isFinite(storedValue) && storedValue > 0 ? Math.floor(storedValue) : 0,
    Number.isFinite(ledgerValue) && ledgerValue > 0 ? Math.floor(ledgerValue) : 0,
  );
}

export async function saveLifetimeScanCount(count: number): Promise<number> {
  const next = Math.max(0, Math.floor(count));
  await AsyncStorage.setItem(LIFETIME_SCANS_KEY, JSON.stringify(next));
  return next;
}

/**
 * Spend an analysis credit exactly once for a request id. Count and recent IDs
 * share one AsyncStorage value, so a crash cannot persist one without the
 * other. The legacy count is mirrored for backward compatibility.
 */
export function countLifetimeScanOnce(scanId: string): Promise<number> {
  const mutate = async () => {
    const counted = await readJson<unknown>(COUNTED_SCAN_IDS_KEY, []);
    const rawIds = Array.isArray(counted)
      ? counted
      : counted && typeof counted === 'object' && Array.isArray((counted as { ids?: unknown }).ids)
        ? (counted as { ids: unknown[] }).ids
        : [];
    const ids = rawIds.filter((id): id is string => typeof id === 'string').slice(-199);
    const current = await loadLifetimeScanCount();
    if (ids.includes(scanId)) return current;
    const next = current + 1;
    await AsyncStorage.setItem(COUNTED_SCAN_IDS_KEY, JSON.stringify({
      version: 1,
      count: next,
      ids: [...ids, scanId],
    }));
    await saveLifetimeScanCount(next);
    return next;
  };
  const next = scanCountMutation.then(mutate, mutate);
  scanCountMutation = next.catch(() => loadLifetimeScanCount());
  return next;
}

/** Keeps a stored value only when it is one the app can actually compute with. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function positiveNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function numberInRange(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : fallback;
}

export async function loadProfile(): Promise<UserProfile> {
  const stored = await readJson<Partial<UserProfile> | null>(PROFILE_KEY, null);
  if (!stored) return DEFAULT_PROFILE;
  // A stored value the app no longer knows: from an older build, a corrupted
  // write, or a cloud row written by a newer one: used to reach the target
  // maths unchecked and surface as "NaN kcal left" on the Today screen.
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    goal: oneOf(stored.goal, ['lose', 'maintain', 'gain'], DEFAULT_PROFILE.goal),
    activityLevel: oneOf(stored.activityLevel, ['low', 'light', 'high'], DEFAULT_PROFILE.activityLevel),
    age: numberInRange(stored.age, 14, 100, DEFAULT_PROFILE.age),
    heightCm: positiveNumber(stored.heightCm, DEFAULT_PROFILE.heightCm),
    weightKg: positiveNumber(stored.weightKg, DEFAULT_PROFILE.weightKg),
    // Profiles written before the rate existed must not deserialize as undefined.
    weeklyRateKg: stored.weeklyRateKg === 0.25 ? 0.25 : 0.5,
    // A profile written before units existed follows the device, so an
    // American upgrading the app is not suddenly asked to think in kilograms.
    unitSystem: isUnitSystem(stored.unitSystem) ? stored.unitSystem : defaultUnitSystem(),
    sex: isBiologicalSex(stored.sex) ? stored.sex : 'unspecified',
    preferences: Array.isArray(stored.preferences) ? stored.preferences.filter((item): item is string => typeof item === 'string') : [],
  };
}

export async function saveProfile(profile: UserProfile) {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadWeightEntries(): Promise<WeightEntry[]> {
  const stored = await readJson<WeightEntry[]>(WEIGHTS_KEY, []);
  return stored
    .filter((entry) => /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(entry.weightKg) && entry.weightKg >= 35 && entry.weightKg <= 350)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveWeightEntry(entry: WeightEntry): Promise<WeightEntry[]> {
  const current = await loadWeightEntries();
  const next = [...current.filter((item) => item.date !== entry.date), entry]
    .sort((a, b) => a.date.localeCompare(b.date));
  await AsyncStorage.setItem(WEIGHTS_KEY, JSON.stringify(next));
  return next;
}

export async function clearLocalKandroData() {
  await AsyncStorage.multiRemove([MEALS_KEY, QUEUE_KEY, PROFILE_KEY, WEIGHTS_KEY, LIFETIME_SCANS_KEY, COUNTED_SCAN_IDS_KEY, DELETED_MEALS_KEY]);
}

export type PendingLocalAccountSwitch = {
  previousUserId: string;
  startedAt: string;
};

export async function beginLocalAccountSwitch(previousUserId: string) {
  if (!previousUserId) throw new Error('missing_previous_account_id');
  // Written before auth changes. If the process dies during sign-in, launch
  // recovery knows never to merge the old local data into the current session.
  await AsyncStorage.setItem(ACCOUNT_SWITCH_PENDING_KEY, JSON.stringify({
    previousUserId,
    startedAt: new Date().toISOString(),
  } satisfies PendingLocalAccountSwitch));
}

export async function loadLocalAccountSwitch(): Promise<PendingLocalAccountSwitch | null> {
  const stored = await readJson<Partial<PendingLocalAccountSwitch> | null>(ACCOUNT_SWITCH_PENDING_KEY, null);
  return stored
    && typeof stored.previousUserId === 'string'
    && stored.previousUserId.length > 0
    && typeof stored.startedAt === 'string'
    ? { previousUserId: stored.previousUserId, startedAt: stored.startedAt }
    : null;
}

export async function completeLocalAccountSwitch() {
  await AsyncStorage.removeItem(ACCOUNT_SWITCH_PENDING_KEY);
}

/**
 * Replaces every account-scoped local value after signing in to a different
 * existing account. It is serialized behind any scan-credit mutation already
 * in progress so a late result from the previous identity cannot overwrite
 * the replacement count.
 */
export function replaceLocalAccountData(
  profile: UserProfile,
  mealHistory: Meal[],
  lifetimeScanCount: number,
): Promise<number> {
  const replace = async () => {
    const cleanMeals = mealHistory
      .filter(isLogged)
      .filter((meal, index, meals) => meals.findIndex((candidate) => candidate.id === meal.id) === index)
      .sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
    const count = Math.max(0, Math.floor(lifetimeScanCount));
    await AsyncStorage.multiSet([
      [MEALS_KEY, JSON.stringify(cleanMeals)],
      [PROFILE_KEY, JSON.stringify(profile)],
      [LIFETIME_SCANS_KEY, JSON.stringify(count)],
      [COUNTED_SCAN_IDS_KEY, JSON.stringify({ version: 1, count, ids: [] })],
    ]);
    await AsyncStorage.multiRemove([QUEUE_KEY, WEIGHTS_KEY, DELETED_MEALS_KEY]);
    return count;
  };

  const next = scanCountMutation.then(replace, replace);
  scanCountMutation = next.catch(() => loadLifetimeScanCount());
  return next;
}
