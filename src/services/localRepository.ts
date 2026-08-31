import AsyncStorage from '@react-native-async-storage/async-storage';

import { PendingAnalysis } from '@/services/contracts';
import { INITIAL_MEALS } from '@/services/mockNutrition';
import { Meal } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

const MEALS_KEY = '@kadro/meals:v1';
const QUEUE_KEY = '@kadro/analysis-queue:v1';

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
  const scans = await loadStoredScans(date);
  return [...INITIAL_MEALS, ...scans];
}

export async function loadStoredScans(date = localDateKey()): Promise<Meal[]> {
  const stored = await readJson<Meal[]>(MEALS_KEY, []);
  return stored.filter((meal) => meal.origin === 'scan' && meal.date === date);
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
