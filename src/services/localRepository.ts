import AsyncStorage from '@react-native-async-storage/async-storage';

import { PendingAnalysis } from '@/services/contracts';
import { DEFAULT_PROFILE, isBiologicalSex } from '@/services/personalization';
import { Meal, UserProfile, WeightEntry } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';
import { defaultUnitSystem, isUnitSystem } from '@/utils/units';

const MEALS_KEY = '@kandro/meals:v1';
const QUEUE_KEY = '@kandro/analysis-queue:v1';
const PROFILE_KEY = '@kandro/profile:v1';
const WEIGHTS_KEY = '@kandro/weight-entries:v1';
const LIFETIME_SCANS_KEY = '@kandro/lifetime-scans:v1';
const DELETED_MEALS_KEY = '@kandro/deleted-meals:v1';

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
 * fail offline — without a tombstone the next hydration would merge the meal
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
  return readJson(QUEUE_KEY, []);
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
 * Monotonic count of meals this device has ever logged. Meal history is pruned
 * (locally by day, in the cloud after 90 days), so the free allowance cannot be
 * derived from it alone without silently handing out more free scans.
 */
export async function loadLifetimeScanCount(): Promise<number> {
  const stored = await readJson<unknown>(LIFETIME_SCANS_KEY, 0);
  const value = Number(stored);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export async function saveLifetimeScanCount(count: number): Promise<number> {
  const next = Math.max(0, Math.floor(count));
  await AsyncStorage.setItem(LIFETIME_SCANS_KEY, JSON.stringify(next));
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
  // A stored value the app no longer knows — from an older build, a corrupted
  // write, or a cloud row written by a newer one — used to reach the target
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
  await AsyncStorage.multiRemove([MEALS_KEY, QUEUE_KEY, PROFILE_KEY, WEIGHTS_KEY, LIFETIME_SCANS_KEY, DELETED_MEALS_KEY]);
}
