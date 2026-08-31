import AsyncStorage from '@react-native-async-storage/async-storage';

import { PendingAnalysis } from '@/services/contracts';
import { DEFAULT_PROFILE } from '@/services/personalization';
import { Meal, UserProfile, WeightEntry } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

const MEALS_KEY = '@kadro/meals:v1';
const QUEUE_KEY = '@kadro/analysis-queue:v1';
const PROFILE_KEY = '@kadro/profile:v1';
const WEIGHTS_KEY = '@kadro/weight-entries:v1';

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
  return stored.filter((meal) => meal.origin === 'scan' && meal.date === date);
}

export async function loadAllStoredScans(): Promise<Meal[]> {
  const stored = await readJson<Meal[]>(MEALS_KEY, []);
  return stored
    .filter((meal) => meal.origin === 'scan')
    .sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
}

export async function saveMeal(meal: Meal): Promise<Meal[]> {
  const current = await readJson<Meal[]>(MEALS_KEY, []);
  const next = [...current.filter((entry) => entry.origin === 'scan' && entry.id !== meal.id), meal];
  await AsyncStorage.setItem(MEALS_KEY, JSON.stringify(next));
  return loadMeals();
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

export async function loadProfile(): Promise<UserProfile> {
  const stored = await readJson<Partial<UserProfile> | null>(PROFILE_KEY, null);
  if (!stored) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...stored,
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

export async function clearLocalKadroData() {
  await AsyncStorage.multiRemove([MEALS_KEY, QUEUE_KEY, PROFILE_KEY, WEIGHTS_KEY]);
}
