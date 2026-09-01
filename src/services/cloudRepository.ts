import { DailyTargets, Meal, MealContext, MealItem, MealSuggestion, Nutrition, UserProfile } from '@/types/nutrition';
import { localDateKey } from '@/utils/date';

import { ensureSupabaseUser, isSupabaseConfigured, supabase } from './supabaseClient';

export type CloudProfile = {
  userId: string;
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
  origin: 'scan';
  saved_at: string;
  meal_items: MealItemRow[];
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
    origin: 'scan',
    saved_at: savedAt,
    updated_at: new Date().toISOString(),
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
  };
}

function mapMeal(row: MealRow): Meal {
  const eatenAt = new Date(row.eaten_at);
  return {
    id: row.id,
    title: row.title,
    type: row.meal_type,
    time: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(eatenAt),
    date: row.meal_date,
    savedAt: row.saved_at,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber ?? 0,
    confidence: row.confidence,
    origin: 'scan',
    items: (row.meal_items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      amountG: item.amount_g,
      baseAmountG: item.base_amount_g,
      portionFactor: item.portion_factor,
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
      },
    })),
  };
}

export async function initializeCloudProfile(defaultProfile: UserProfile, defaultTargets: DailyTargets): Promise<CloudProfile | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  const user = await ensureSupabaseUser();
  if (!user) return null;

  const today = localDateKey();
  const now = new Date().toISOString();
  const [profileWrite, targetWrite] = await Promise.all([
    supabase.from('profiles').upsert(
      {
        user_id: user.id,
        display_name: defaultProfile.displayName,
        goal: defaultProfile.goal,
        activity_level: defaultProfile.activityLevel,
        weekly_rate_kg: defaultProfile.weeklyRateKg,
        preferences: defaultProfile.preferences,
        updated_at: now,
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    ),
    supabase.from('daily_targets').upsert(
      {
        user_id: user.id,
        target_date: today,
        calories: defaultTargets.calories,
        protein: defaultTargets.protein,
        carbs: defaultTargets.carbs,
        fat: defaultTargets.fat,
        updated_at: now,
      },
      { onConflict: 'user_id,target_date', ignoreDuplicates: true },
    ),
  ]);
  if (profileWrite.error) throw profileWrite.error;
  if (targetWrite.error) throw targetWrite.error;

  const [profileResult, targetResult] = await Promise.all([
    supabase.from('profiles').select('display_name,goal,age,height_cm,weight_kg,activity_level,weekly_rate_kg,preferences,updated_at').eq('user_id', user.id).single(),
    supabase.from('daily_targets').select('calories,protein,carbs,fat').eq('user_id', user.id).eq('target_date', today).single(),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (targetResult.error) throw targetResult.error;

  return {
    userId: user.id,
    profile: {
      displayName: profileResult.data.display_name,
      goal: profileResult.data.goal,
      age: Number(profileResult.data.age ?? defaultProfile.age),
      heightCm: Number(profileResult.data.height_cm ?? defaultProfile.heightCm),
      weightKg: Number(profileResult.data.weight_kg ?? defaultProfile.weightKg),
      activityLevel: profileResult.data.activity_level === 'high' ? 'high' : profileResult.data.activity_level === 'low' ? 'low' : 'light',
      weeklyRateKg: Number(profileResult.data.weekly_rate_kg) === 0.25 ? 0.25 : 0.5,
      preferences: profileResult.data.preferences ?? [],
      completedAt: profileResult.data.age && profileResult.data.height_cm && profileResult.data.weight_kg
        ? profileResult.data.updated_at
        : null,
    },
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

export async function saveCloudMeal(meal: Meal): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const user = await ensureSupabaseUser();
  if (!user) return false;

  const mealResult = await supabase.from('meals').upsert(mealRow(meal, user.id), { onConflict: 'user_id,id' });
  if (mealResult.error) throw mealResult.error;

  if (meal.items.length) {
    const itemResult = await supabase
      .from('meal_items')
      .upsert(meal.items.map((item) => itemRow(item, meal.id, user.id)), { onConflict: 'user_id,meal_id,id' });
    if (itemResult.error) throw itemResult.error;
  }
  return true;
}

export async function deleteCloudMeal(id: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const user = await ensureSupabaseUser();
  if (!user) return false;

  // meal_items cascades on the composite foreign key, so removing the meal is
  // enough and cannot leave orphaned ingredients behind.
  const result = await supabase.from('meals').delete().eq('user_id', user.id).eq('id', id);
  if (result.error) throw result.error;
  return true;
}

export async function loadCloudMeals(date = localDateKey()): Promise<Meal[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const user = await ensureSupabaseUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('meals')
    .select('id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at,meal_items(id,name,amount_g,base_amount_g,portion_factor,calories,protein,carbs,fat,fiber,confidence,optional,included,source_provider,source_reference_id,source_label)')
    .eq('user_id', user.id)
    .eq('meal_date', date)
    .order('eaten_at', { ascending: true });
  if (error) throw error;
  return (data as MealRow[]).map(mapMeal);
}

export async function loadCloudMealHistory(days = 90): Promise<Meal[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const user = await ensureSupabaseUser();
  if (!user) return [];

  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, days - 1));
  const { data, error } = await supabase
    .from('meals')
    .select('id,title,meal_type,eaten_at,meal_date,calories,protein,carbs,fat,fiber,confidence,origin,saved_at,meal_items(id,name,amount_g,base_amount_g,portion_factor,calories,protein,carbs,fat,fiber,confidence,optional,included,source_provider,source_reference_id,source_label)')
    .eq('user_id', user.id)
    .gte('meal_date', localDateKey(since))
    .order('eaten_at', { ascending: true });
  if (error) throw error;
  return (data as MealRow[]).map(mapMeal);
}

export async function hasCloudMeal(): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) return false;
  const user = await ensureSupabaseUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('meals')
    .select('id')
    .eq('user_id', user.id)
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
