import { DailyTargets, Meal, MealContext, MealItem, MealSuggestion, Nutrition, UserProfile } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

import { ensureSupabaseUser, getCurrentSessionUserId, isSupabaseConfigured, supabase } from './supabaseClient';
import { isUnitSystem } from '@/utils/units';
import { calculateDailyTargets, isBiologicalSex } from '@/services/personalization';
import { formatClockTime } from '@/utils/format';
import { acknowledgeMealSync, forgetDeletedMeal, getLocalDataGeneration, loadDeletedMeals, markDeletedMealConflict, markMealConflict, pendingMealForSync } from './localRepository';
import { newAnalysisRequestId } from '@/utils/requestId';

export type CloudProfile = {
  userId: string;
  /** False only for a never-declared or deliberately invalidated cloud age. */
  ageDeclared: boolean;
  profile: UserProfile;
  targets: DailyTargets;
};

type MealItemRow = {
  id: string;
  name: string;
  amount_g: number;
  base_amount_g: number;
  portion_factor: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  confidence: 'high' | 'medium';
  optional: boolean;
  included: boolean;
  source_provider: MealItem['source']['provider'];
  source_reference_id: string | null;
  source_label: string;
  nutrition_per_100g: Nutrition | null;
  portions: MealItem['portions'] | null;
  source_estimated_reference: boolean;
  item_position: number;
};

type MealRow = {
  id: string;
  title: string;
  meal_type: Meal['type'];
  eaten_at: string;
  meal_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  confidence: 'high' | 'medium';
  origin: 'scan' | 'plan';
  saved_at: string;
  meal_items: MealItemRow[];
  cloud_revision: number;
};

function mealRow(meal: Meal, userId: string) {
  const savedAt = meal.savedAt ?? new Date().toISOString();
  return {
    user_id: userId,
    id: meal.id,
    title: meal.title,
    meal_type: meal.type,
    eaten_at: savedAt,
    meal_date: meal.date ?? localDateKey(new Date(savedAt)),
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    fiber: meal.fiber ?? 0,
    confidence: meal.confidence,
    origin: meal.origin === 'plan' ? 'plan' : 'scan',
    saved_at: savedAt,
  };
}

function itemRow(item: MealItem, mealId: string, userId: string) {
  return {
    user_id: userId,
    meal_id: mealId,
    id: item.id,
    name: item.name,
    amount_g: item.amountG,
    base_amount_g: item.baseAmountG,
    portion_factor: item.portionFactor,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber ?? 0,
    confidence: item.confidence,
    optional: Boolean(item.optional),
    included: item.included,
    source_provider: item.source.provider,
    source_reference_id: item.source.referenceId ?? null,
    source_label: item.source.label,
    nutrition_per_100g: item.nutritionPer100g ?? null,
    portions: item.portions ?? null,
    source_estimated_reference: Boolean(item.source.estimatedReference),
  };
}

function mapMeal(row: MealRow, userId: string): Meal {
  const eatenAt = new Date(row.eaten_at);
  return {
    id: row.id,
    title: row.title,
    type: row.meal_type,
    time: formatClockTime(eatenAt),
    date: row.meal_date,
    savedAt: row.saved_at,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber ?? 0,
    confidence: row.confidence,
    origin: row.origin === 'plan' ? 'plan' : 'scan',
    sync: { mealId: row.id, ownerId: userId, revision: row.cloud_revision, status: 'synced' },
    items: [...(row.meal_items ?? [])].sort((a,b) => a.item_position - b.item_position).map((item) => ({
      id: item.id,
      name: item.name,
      amountG: item.amount_g,
      baseAmountG: item.base_amount_g,
      portionFactor: item.portion_factor,
      ...(item.nutrition_per_100g ? { nutritionPer100g: item.nutrition_per_100g } : {}),
      ...(item.portions ? { portions: item.portions } : {}),
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber ?? 0,
      confidence: item.confidence,
      optional: item.optional,
      included: item.included,
      source: {
        provider: item.source_provider,
        referenceId: item.source_reference_id ?? undefined,
        label: item.source_label,
        ...(item.source_estimated_reference ? { estimatedReference: true } : {}),
      },
    })),
  };
}

export async function initializeCloudProfile(
  defaultProfile: UserProfile,
  defaultTargets: DailyTargets,
  deriveMissingTargetsFromCloud = false,
  ownership?: { userId: string | null; generation: number },
): Promise<CloudProfile | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  const user = await ensureSupabaseUser();
  if (!user) return null;
  if (ownership?.userId && ownership.userId !== user.id) throw new Error('cloud_identity_changed');
  await assertCloudOwner(user.id, ownership?.generation);

  const today = localDateKey();
  const now = new Date().toISOString();
  const profileWrite = await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      display_name: defaultProfile.displayName,
      goal: defaultProfile.goal,
      ...(defaultProfile.completedAt ? {
        age: defaultProfile.age,
        height_cm: defaultProfile.heightCm,
        weight_kg: defaultProfile.weightKg,
      } : {}),
      activity_level: defaultProfile.activityLevel,
      weekly_rate_kg: defaultProfile.weeklyRateKg,
      unit_system: defaultProfile.unitSystem,
      sex: defaultProfile.sex,
      preferences: defaultProfile.preferences,
      updated_at: now,
    },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (profileWrite.error) throw profileWrite.error;

  // Read the destination profile before creating today's target. A returning
  // account often has no row yet for a new calendar day; writing generic
  // defaults first would permanently replace its personalised plan.
  const profileResult = await supabase.from('profiles')
    .select('display_name,goal,age,height_cm,weight_kg,activity_level,weekly_rate_kg,unit_system,sex,preferences,updated_at')
    .eq('user_id', user.id)
    .single();
  if (profileResult.error) throw profileResult.error;

  const profile: UserProfile = {
    displayName: profileResult.data.display_name,
    goal: profileResult.data.goal,
    age: Number(profileResult.data.age ?? defaultProfile.age),
    heightCm: Number(profileResult.data.height_cm ?? defaultProfile.heightCm),
    weightKg: Number(profileResult.data.weight_kg ?? defaultProfile.weightKg),
    activityLevel: profileResult.data.activity_level === 'high' ? 'high' : profileResult.data.activity_level === 'low' ? 'low' : 'light',
    weeklyRateKg: Number(profileResult.data.weekly_rate_kg) === 0.25 ? 0.25 : 0.5,
    unitSystem: isUnitSystem(profileResult.data.unit_system) ? profileResult.data.unit_system : defaultProfile.unitSystem,
    sex: isBiologicalSex(profileResult.data.sex) ? profileResult.data.sex : 'unspecified',
    preferences: profileResult.data.preferences ?? [],
    completedAt: profileResult.data.age && profileResult.data.height_cm && profileResult.data.weight_kg
      ? profileResult.data.updated_at
      : null,
  };
  const missingTargetDefaults = deriveMissingTargetsFromCloud && profile.completedAt
    ? calculateDailyTargets(profile)
    : defaultTargets;
  const targetWrite = await supabase.from('daily_targets').upsert(
    {
      user_id: user.id,
      target_date: today,
      calories: missingTargetDefaults.calories,
      protein: missingTargetDefaults.protein,
      carbs: missingTargetDefaults.carbs,
      fat: missingTargetDefaults.fat,
      updated_at: now,
    },
    { onConflict: 'user_id,target_date', ignoreDuplicates: true },
  );
  if (targetWrite.error) throw targetWrite.error;
  const targetResult = await supabase.from('daily_targets')
    .select('calories,protein,carbs,fat')
    .eq('user_id', user.id)
    .eq('target_date', today)
    .single();
  if (targetResult.error) throw targetResult.error;

  await assertCloudOwner(user.id);
  return {
    userId: user.id,
    ageDeclared: profileResult.data.age !== null,
    profile,
    targets: targetResult.data,
  };
}

export async function saveCloudProfile(profile: UserProfile, targets: DailyTargets): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const user = await ensureSupabaseUser();
  if (!user) return false;

  const now = new Date().toISOString();
  const today = localDateKey();
  const [profileWrite, targetWrite] = await Promise.all([
    supabase.from('profiles').upsert({
      user_id: user.id,
      display_name: profile.displayName,
      goal: profile.goal,
      age: profile.age,
      height_cm: profile.heightCm,
      weight_kg: profile.weightKg,
      activity_level: profile.activityLevel,
      weekly_rate_kg: profile.weeklyRateKg,
      unit_system: profile.unitSystem,
      sex: profile.sex,
      preferences: profile.preferences,
      updated_at: now,
    }, { onConflict: 'user_id' }),
    supabase.from('daily_targets').upsert({
      user_id: user.id,
      target_date: today,
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      updated_at: now,
    }, { onConflict: 'user_id,target_date' }),
  ]);
  if (profileWrite.error) throw profileWrite.error;
  if (targetWrite.error) throw targetWrite.error;
  return true;
}

// Writes for one account/meal must reach the server in the same order as
// local edits. A delayed correction must never resurrect a deleted meal.
const mealWrites = new Map<string, Promise<unknown>>();
function orderedMealWrite<T>(userId: string, mealId: string, operation: () => Promise<T>): Promise<T> {
  const key = `${userId}:${mealId}`;
  const previous = mealWrites.get(key) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(async () => {
    if (await getCurrentSessionUserId() !== userId) throw new Error('cloud_identity_changed');
    return operation();
  });
  mealWrites.set(key, result);
  void result.finally(() => { if (mealWrites.get(key) === result) mealWrites.delete(key); }).catch(() => undefined);
  return result;
}

export async function assertCloudOwner(userId: string, generation?: number) {
  if (await getCurrentSessionUserId() !== userId
    || (generation !== undefined && generation !== getLocalDataGeneration())) throw new Error('cloud_identity_changed');
}

export async function saveCloudMeal(meal: Meal): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const generation = getLocalDataGeneration();
  const user = await ensureSupabaseUser();
  if (!user) return false;
  if (meal.sync?.ownerId && meal.sync.ownerId !== user.id) throw new Error('cloud_identity_changed');
  const client = supabase;
  return orderedMealWrite(user.id, meal.id, async () => {
    await assertCloudOwner(user.id, generation);
    // Coalesce queued local edits. A stale closure is never uploaded over the
    // latest durable draft, and a local deletion cannot be resurrected.
    const pending = await pendingMealForSync(meal.id, user.id, generation);
    if (!pending) return true;
    const sync = pending.sync!;
    await assertCloudOwner(user.id, generation);
    const { data, error } = await client.rpc('mutate_meal_v2', {
      expected_user_id: user.id, mutation_id: sync.mutationId,
      expected_revision: sync.revision, ancestors: sync.ancestors ?? [], operation: 'save',
      meal: mealRow(pending, user.id), items: pending.items.map((item) => itemRow(item, pending.id, user.id)),
    });
    await assertCloudOwner(user.id, generation);
    if (error) {
      if (['meal_revision_conflict','meal_deleted'].includes(error.message)) await markMealConflict(meal.id, user.id);
      throw error;
    }
    if (!data || !Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('invalid_meal_sync_ack');
    await acknowledgeMealSync(meal.id, sync.mutationId!, data.revision, user.id);
    return true;
  });
}

export async function deleteCloudMeal(id: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const generation = getLocalDataGeneration();
  const user = await ensureSupabaseUser();
  if (!user) return false;
  const client = supabase;
  return orderedMealWrite(user.id, id, async () => {
    await assertCloudOwner(user.id, generation);
    const tombstone = (await loadDeletedMeals()).find((entry) => entry.id === id);
    if (!tombstone) return true;
    const sync = tombstone.sync;
    if (sync.status === 'conflict') throw new Error('meal_revision_conflict');
    if (sync.ownerId && sync.ownerId !== user.id) throw new Error('cloud_identity_changed');
    const { data, error } = await client.rpc('mutate_meal_v2', {
      expected_user_id: user.id, mutation_id: sync.mutationId ?? newAnalysisRequestId(),
      expected_revision: sync.revision, ancestors: sync.ancestors ?? [], operation: 'delete', meal: { id }, items: [],
    });
    await assertCloudOwner(user.id, generation);
    if (error) {
      if (error.message === 'meal_revision_conflict') await markDeletedMealConflict(id, user.id);
      throw error;
    }
    if (!data || !Number.isSafeInteger(data.revision) || !data.deleted) throw new Error('invalid_meal_sync_ack');
    await forgetDeletedMeal(id, sync.mutationId, user.id);
    return true;
  });
}

export async function loadCloudDeletedMealIds(ids: string[], userId: string): Promise<string[]> {
  if (!supabase || ids.length === 0) return [];
  const result: string[] = [];
  const unique = [...new Set(ids)];
  for (let offset = 0; offset < unique.length; offset += 500) {
    await assertCloudOwner(userId);
    const { data, error } = await supabase.rpc('deleted_meal_ids', { expected_user_id: userId, ids: unique.slice(offset, offset + 500) });
    await assertCloudOwner(userId);
    if (error) throw error;
    if (!Array.isArray(data) || data.some((id) => typeof id !== 'string')) throw new Error('invalid_deletion_snapshot');
    result.push(...data);
  }
  return result;
}

export async function loadCloudMeals(date = localDateKey()): Promise<Meal[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const user = await ensureSupabaseUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('meals')
    .select('id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at,cloud_revision,meal_items(id,name,amount_g,base_amount_g,portion_factor,calories,protein,carbs,fat,fiber,confidence,optional,included,source_provider,source_reference_id,source_label,nutrition_per_100g,portions,source_estimated_reference,item_position)')
    .eq('user_id', user.id)
    .eq('meal_date', date)
    .order('eaten_at', { ascending: true });
  if (error) throw error;
  await assertCloudOwner(user.id);
  return (data as MealRow[]).map((row) => mapMeal(row, user.id));
}

/** A missing exact row is distinguished from a truncated history page. */
export async function loadCloudMealById(id: string, userId: string): Promise<Meal | null> {
  if (!supabase || !isSupabaseConfigured) throw new Error('cloud_unavailable');
  await assertCloudOwner(userId);
  const { data, error } = await supabase.from('meals').select('id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at,cloud_revision,meal_items(id,name,amount_g,base_amount_g,portion_factor,calories,protein,carbs,fat,fiber,confidence,optional,included,source_provider,source_reference_id,source_label,nutrition_per_100g,portions,source_estimated_reference,item_position)').eq('user_id', userId).eq('id', id).maybeSingle();
  await assertCloudOwner(userId);
  if (error) throw error;
  return data ? mapMeal(data as MealRow, userId) : null;
}

export async function loadCloudMealHistory(days = 90): Promise<Meal[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const user = await ensureSupabaseUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, days - 1));
  const rows: MealRow[] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    await assertCloudOwner(user.id);
    const { data, error } = await supabase.from('meals')
      .select('id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at,cloud_revision,meal_items(id,name,amount_g,base_amount_g,portion_factor,calories,protein,carbs,fat,fiber,confidence,optional,included,source_provider,source_reference_id,source_label,nutrition_per_100g,portions,source_estimated_reference,item_position)').eq('user_id', user.id).gte('meal_date', localDateKey(since))
      .order('eaten_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    await assertCloudOwner(user.id);
    rows.push(...(data as MealRow[]));
    if (data.length < pageSize) break;
  }
  return [...new Map(rows.map((row) => [row.id, mapMeal(row, user.id)])).values()];
}

/**
 * A stored meal only proves that an AI analysis happened when its origin is
 * `scan`. Search, barcode, demo and Kandro's own plan are deliberately stored
 * as `plan`, because none of those paths spends an analysis credit.
 */
export async function hasCloudAnalyzedMeal(): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const user = await ensureSupabaseUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('meals')
    .select('id')
    .eq('user_id', user.id)
    .eq('origin', 'scan')
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function recordRecommendationSet(
  context: MealContext,
  remaining: Nutrition,
  suggestions: MealSuggestion[],
) {
  if (!supabase || suggestions.length !== 3) return;
  const user = await ensureSupabaseUser();
  if (!user) return;
  const { error } = await supabase.from('recommendations').insert({
    user_id: user.id,
    recommendation_date: localDateKey(),
    context,
    remaining_calories: remaining.calories,
    remaining_protein: remaining.protein,
    remaining_carbs: remaining.carbs,
    remaining_fat: remaining.fat,
    suggestion_ids: suggestions.map((suggestion) => suggestion.id),
  });
  if (error) throw error;
}

export async function recordRecommendationFeedback(context: MealContext, suggestionId: string, action: 'accepted' | 'rejected') {
  if (!supabase) return;
  const user = await ensureSupabaseUser();
  if (!user) return;
  const { error } = await supabase.from('recommendation_feedback').insert({
    user_id: user.id,
    context,
    suggestion_id: suggestionId,
    action,
  });
  if (error) throw error;
}
