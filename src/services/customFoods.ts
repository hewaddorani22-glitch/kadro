import { getDictionary } from '@/i18n/active';
import type { FoodSearchResult } from '@/services/mealAnalysis';
import { getLocalDataGeneration, loadStoredCustomFoods, saveStoredCustomFoods, subscribePrivateDataInvalidation } from '@/services/localRepository';
import { ensureSupabaseUser, isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import type { Nutrition } from '@/types/nutrition';
import { newAnalysisRequestId } from '@/utils/requestId';

// The same physical limits the server table and the label form enforce.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { labelPlausibility } = require('../../supabase/functions/_shared/label-facts.mjs') as {
  labelPlausibility: (values: Record<string, number | null | undefined>) => { plausible: boolean; issues: string[]; blocking: string[] };
};

/**
 * "Mein Produkt": a food the user saved from a photographed nutrition label
 * (or entered by hand), optionally linked to the barcode they scanned.
 *
 * Stored on the device and, when the cloud is active, written through to
 * public.custom_foods (owner-only RLS, deleted with the account). Every value
 * is the one the user confirmed from their own pack; nothing is estimated.
 */
export type CustomFoodValues = Nutrition & { sugar?: number; saturatedFat?: number; salt?: number };

export type CustomFood = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  per100g: CustomFoodValues;
  servingG: number | null;
  packageG: number | null;
  origin: 'label' | 'manual';
  createdAt: string;
  updatedAt: string;
  /** Last confirmed cloud write; absent while the change is only local. */
  syncedAt?: string;
  /** Deleted on this device; the cloud delete is retried on the next sync. */
  pendingDelete?: boolean;
};

export const CUSTOM_FOOD_PREFIX = 'custom-';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const optional = (value: unknown, max: number) => value === undefined || value === null || finite(value, max);

/** Structural and physical validity; damaged records are dropped, never repaired. */
export function isValidCustomFood(value: unknown): value is CustomFood {
  const food = value as CustomFood | null;
  if (!food || typeof food !== 'object' || typeof food.id !== 'string' || !UUID.test(food.id)) return false;
  if (typeof food.name !== 'string' || !food.name.trim() || food.name.length > 80) return false;
  if (food.brand !== null && (typeof food.brand !== 'string' || food.brand.length > 60)) return false;
  if (food.barcode !== null && (typeof food.barcode !== 'string' || !/^\d{7,14}$/.test(food.barcode))) return false;
  const v = food.per100g;
  if (!v || !finite(v.calories, 950) || !finite(v.protein, 100) || !finite(v.carbs, 100) || !finite(v.fat, 100)) return false;
  if (!optional(v.fiber, 100) || !optional(v.sugar, 100) || !optional(v.saturatedFat, 100) || !optional(v.salt, 100)) return false;
  if (food.servingG !== null && !(finite(food.servingG, 2000) && food.servingG >= 1)) return false;
  if (food.packageG !== null && !(finite(food.packageG, 10000) && food.packageG >= 1)) return false;
  if (!['label', 'manual'].includes(food.origin) || typeof food.createdAt !== 'string' || typeof food.updatedAt !== 'string') return false;
  return labelPlausibility({ ...v }).blocking.length === 0;
}

let foods: CustomFood[] | null = null;
let loading: Promise<CustomFood[]> | null = null;
// Stable between changes, as useSyncExternalStore requires.
let snapshot: CustomFood[] = [];
const listeners = new Set<() => void>();
const notify = () => {
  snapshot = visible(foods ?? []);
  listeners.forEach((listener) => listener());
};

subscribePrivateDataInvalidation(async () => {
  // Account switch, reset or deletion: never show the previous account's products.
  foods = null;
  loading = null;
  notify();
});

export function subscribeCustomFoods(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Synchronous snapshot for render; empty until the first load finished. */
export function getCustomFoodsSnapshot(): CustomFood[] {
  return snapshot;
}

function visible(list: CustomFood[]) {
  return list.filter((food) => !food.pendingDelete);
}

export async function loadCustomFoods(): Promise<CustomFood[]> {
  if (foods) return visible(foods);
  const generation = getLocalDataGeneration();
  loading ??= loadStoredCustomFoods()
    .then((stored) => stored.filter(isValidCustomFood))
    .catch(() => [] as CustomFood[]);
  const loaded = await loading;
  if (generation === getLocalDataGeneration() && !foods) {
    foods = loaded;
    notify();
  }
  return visible(foods ?? loaded);
}

async function persist(next: CustomFood[]) {
  foods = next;
  notify();
  await saveStoredCustomFoods(next);
}

type CloudRow = {
  id: string; name: string; brand: string | null; barcode: string | null;
  calories: number | string; protein: number | string; carbs: number | string; sugar: number | string | null;
  fat: number | string; saturated_fat: number | string | null; fiber: number | string | null; salt: number | string | null;
  serving_g: number | string | null; package_g: number | string | null; origin: 'label' | 'manual';
  created_at: string; updated_at: string;
};
const num = (value: number | string | null | undefined) => (value === null || value === undefined ? undefined : Number(value));

function toRow(food: CustomFood, userId: string) {
  const v = food.per100g;
  return {
    user_id: userId, id: food.id, name: food.name, brand: food.brand, barcode: food.barcode,
    calories: v.calories, protein: v.protein, carbs: v.carbs, sugar: v.sugar ?? null, fat: v.fat,
    saturated_fat: v.saturatedFat ?? null, fiber: v.fiber ?? null, salt: v.salt ?? null,
    serving_g: food.servingG, package_g: food.packageG, origin: food.origin,
    created_at: food.createdAt, updated_at: food.updatedAt,
  };
}

function fromRow(row: CloudRow, syncedAt: string): CustomFood | null {
  const per100g: CustomFoodValues = {
    calories: Number(row.calories), protein: Number(row.protein), carbs: Number(row.carbs), fat: Number(row.fat),
    ...(num(row.fiber) === undefined ? {} : { fiber: num(row.fiber) }),
    ...(num(row.sugar) === undefined ? {} : { sugar: num(row.sugar) }),
    ...(num(row.saturated_fat) === undefined ? {} : { saturatedFat: num(row.saturated_fat) }),
    ...(num(row.salt) === undefined ? {} : { salt: num(row.salt) }),
  };
  const food: CustomFood = {
    id: row.id, name: row.name, brand: row.brand, barcode: row.barcode, per100g,
    servingG: num(row.serving_g) ?? null, packageG: num(row.package_g) ?? null, origin: row.origin,
    createdAt: row.created_at, updatedAt: row.updated_at, syncedAt,
  };
  return isValidCustomFood(food) ? food : null;
}

/** The cloud user for a write, or null when the cloud is off or unavailable. */
async function cloudUser(generation: number) {
  if (!supabase || !isSupabaseConfigured) return null;
  const user = await ensureSupabaseUser().catch(() => null);
  if (!user || generation !== getLocalDataGeneration()) return null;
  return user;
}

async function pushFood(food: CustomFood, generation: number): Promise<boolean> {
  const user = await cloudUser(generation);
  if (!user || !supabase) return false;
  const { error } = food.pendingDelete
    ? await supabase.from('custom_foods').delete().eq('user_id', user.id).eq('id', food.id)
    : await supabase.from('custom_foods').upsert(toRow(food, user.id), { onConflict: 'user_id,id' });
  return !error && generation === getLocalDataGeneration();
}

export type CustomFoodDraft = {
  name: string; brand: string | null; barcode: string | null; per100g: CustomFoodValues;
  servingG: number | null; packageG: number | null; origin: 'label' | 'manual';
};

/**
 * Saves (or replaces) one product. A product with the same barcode keeps its
 * id, so a re-scanned label updates the existing entry instead of adding a
 * second. Returns the saved food and whether the cloud copy was written.
 */
export async function saveCustomFood(draft: CustomFoodDraft): Promise<{ food: CustomFood; cloud: boolean }> {
  const generation = getLocalDataGeneration();
  const current = await loadCustomFoods();
  const all = foods ?? current;
  const now = new Date().toISOString();
  const existing = draft.barcode ? all.find((food) => food.barcode === draft.barcode) : undefined;
  const food: CustomFood = {
    id: existing?.id ?? newAnalysisRequestId(),
    name: draft.name.trim().slice(0, 80),
    brand: draft.brand?.trim() ? draft.brand.trim().slice(0, 60) : null,
    barcode: draft.barcode && /^\d{7,14}$/.test(draft.barcode) ? draft.barcode : null,
    per100g: { ...draft.per100g },
    servingG: draft.servingG,
    packageG: draft.packageG,
    origin: draft.origin,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (!isValidCustomFood(food)) throw new Error('invalid_custom_food');
  if (generation !== getLocalDataGeneration()) throw new Error('cloud_identity_changed');
  await persist([food, ...all.filter((entry) => entry.id !== food.id)].slice(0, 500));
  const cloud = await pushFood(food, generation).catch(() => false);
  if (cloud) await markSynced(food.id, food.updatedAt, generation);
  return { food, cloud };
}

async function markSynced(id: string, updatedAt: string, generation: number) {
  if (!foods || generation !== getLocalDataGeneration()) return;
  await persist(foods.map((food) => (food.id === id && food.updatedAt === updatedAt ? { ...food, syncedAt: new Date().toISOString() } : food)));
}

export async function deleteCustomFood(id: string) {
  const generation = getLocalDataGeneration();
  await loadCustomFoods();
  const target = foods?.find((food) => food.id === id);
  if (!target || !foods) return;
  const tombstone = { ...target, pendingDelete: true, updatedAt: new Date().toISOString() };
  await persist(foods.map((food) => (food.id === id ? tombstone : food)));
  // Never uploaded: nothing to delete in the cloud.
  const cloud = !target.syncedAt || await pushFood(tombstone, generation).catch(() => false);
  if (cloud && foods && generation === getLocalDataGeneration()) await persist(foods.filter((food) => food.id !== id));
}

/**
 * Pulls the account's products and pushes local-only changes. Newest
 * confirmation wins per product; a product deleted on another device (synced
 * before, absent now) is removed here too. Silently local-only without cloud.
 */
export async function syncCustomFoods(): Promise<void> {
  const generation = getLocalDataGeneration();
  await loadCustomFoods();
  const user = await cloudUser(generation);
  if (!user || !supabase) return;
  const { data, error } = await supabase.from('custom_foods')
    .select('id,name,brand,barcode,calories,protein,carbs,sugar,fat,saturated_fat,fiber,salt,serving_g,package_g,origin,created_at,updated_at')
    .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(500);
  if (error || !Array.isArray(data) || generation !== getLocalDataGeneration() || !foods) return;
  const syncedAt = new Date().toISOString();
  const remote = new Map((data as CloudRow[]).map((row) => [row.id, fromRow(row, syncedAt)]).filter((entry): entry is [string, CustomFood] => Boolean(entry[1])));
  const merged: CustomFood[] = [];
  const pending: CustomFood[] = [];
  for (const local of foods) {
    const cloud = remote.get(local.id);
    remote.delete(local.id);
    if (!cloud) {
      if (local.syncedAt && !local.pendingDelete) continue; // deleted elsewhere
      if (local.pendingDelete && !local.syncedAt) continue;
      merged.push(local);
      pending.push(local);
    } else if (local.pendingDelete || local.updatedAt > cloud.updatedAt) {
      merged.push(local);
      pending.push(local);
    } else {
      merged.push(cloud);
    }
  }
  merged.push(...remote.values());
  await persist(merged.slice(0, 500));
  for (const food of pending) {
    if (!await pushFood(food, generation).catch(() => false)) continue;
    if (!foods || generation !== getLocalDataGeneration()) return;
    await persist(food.pendingDelete
      ? foods.filter((entry) => entry.id !== food.id)
      : foods.map((entry) => (entry.id === food.id && entry.updatedAt === food.updatedAt ? { ...entry, syncedAt: new Date().toISOString() } : entry)));
  }
}

export async function findCustomFoodByBarcode(barcode: string): Promise<CustomFood | null> {
  if (!/^\d{7,14}$/.test(barcode)) return null;
  const list = await loadCustomFoods().catch(() => [] as CustomFood[]);
  return list.find((food) => food.barcode === barcode) ?? null;
}

export function isCustomFoodResult(result: Pick<FoodSearchResult, 'source'>) {
  return result.source?.provider === 'manual' && Boolean(result.source.referenceId?.startsWith(CUSTOM_FOOD_PREFIX));
}

/** The product as a search row: user's own values, source "Mein Produkt". */
export function customFoodResult(food: CustomFood): FoodSearchResult {
  const t = getDictionary().labelScan;
  const name = food.brand && !food.name.toLowerCase().includes(food.brand.toLowerCase()) ? `${food.name} (${food.brand})` : food.name;
  const portions = [
    ...(food.servingG ? [{ label: t.portionServing(food.servingG), grams: food.servingG }] : []),
    ...(food.packageG && food.packageG <= 5000 && food.packageG !== food.servingG ? [{ label: t.portionPackage(food.packageG), grams: food.packageG }] : []),
  ];
  const v = food.per100g;
  return {
    id: `${CUSTOM_FOOD_PREFIX}${food.id}`,
    name: name.slice(0, 160),
    per100g: { calories: v.calories, protein: v.protein, carbs: v.carbs, fat: v.fat, ...(v.fiber === undefined ? {} : { fiber: v.fiber }) },
    defaultGrams: food.servingG ?? 100,
    portions,
    source: { provider: 'manual', referenceId: `${CUSTOM_FOOD_PREFIX}${food.id}`, label: t.sourceLabel },
    ...(food.barcode ? { barcode: food.barcode } : {}),
  };
}

const foldText = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();

/** Own products whose name, brand or barcode match every typed word. */
export function matchCustomFoods(query: string, list: CustomFood[], limit = 5): FoodSearchResult[] {
  const tokens = foldText(query).split(' ').filter(Boolean);
  if (!tokens.length) return [];
  return list
    .map((food) => {
      const words = foldText(`${food.name} ${food.brand ?? ''}`).split(' ');
      let score = 0;
      for (const token of tokens) {
        if (food.barcode && /^\d+$/.test(token) && food.barcode.startsWith(token)) { score += 3; continue; }
        if (words.includes(token)) score += 3;
        else if (words.some((word) => word.startsWith(token))) score += 2;
        else if (token.length >= 4 && words.some((word) => word.includes(token))) score += 1;
        else return null;
      }
      return { food, score };
    })
    .filter((entry): entry is { food: CustomFood; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score || b.food.updatedAt.localeCompare(a.food.updatedAt))
    .slice(0, limit)
    .map((entry) => customFoodResult(entry.food));
}
