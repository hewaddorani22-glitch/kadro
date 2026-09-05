// Explicit live integration test. Creates only its own disposable account and
// removes it in finally. Run with: node scripts/validate-cloud-portions-live.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Public Supabase configuration required');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.auth.signInAnonymously();
if (error || !data.user) throw error ?? new Error('No disposable account');
const user_id = data.user.id;
try {
  const now = new Date().toISOString();
  const meal = { user_id, id: 'decimal-qa', title: 'Decimal QA', meal_type: 'Snack', eaten_at: now, meal_date: now.slice(0, 10), calories: 140, protein: 5, carbs: 21, fat: 3, confidence: 'high', origin: 'scan' };
  const savedMeal = await client.from('meals').insert(meal);
  if (savedMeal.error) throw savedMeal.error;
  const item = { user_id, meal_id: meal.id, id: 'oats', name: 'Hafer Flocken', amount_g: 40.3, base_amount_g: 110.3, portion_factor: 1, calories: 140, protein: 5, carbs: 21, fat: 3, confidence: 'high', source_provider: 'bls', source_label: 'BLS 4.0 C133000' };
  const savedItem = await client.from('meal_items').insert(item);
  if (savedItem.error) throw savedItem.error;
  const read = await client.from('meal_items').select('amount_g,base_amount_g').eq('meal_id', meal.id).single();
  if (read.error) throw read.error;
  assert.equal(read.data.amount_g, 40.3);
  assert.equal(read.data.base_amount_g, 110.3);
  for (const amount_g of [0, 5000.1]) {
    const invalid = await client.from('meal_items').update({ amount_g }).eq('meal_id', meal.id);
    assert.equal(invalid.error?.code, '23514', 'Existing gram bounds must remain enforced');
  }
  const whole = await client.from('meal_items').update({ amount_g: 100, base_amount_g: 100 }).eq('meal_id', meal.id).select('amount_g,base_amount_g').single();
  if (whole.error) throw whole.error;
  assert.equal(whole.data.amount_g, 100);
  assert.equal(whole.data.base_amount_g, 100);
  console.log('Live cloud portions: decimal round-trip, existing gram bounds and whole-gram compatibility passed.');
} finally {
  const deleted = await client.functions.invoke('delete-account', { method: 'DELETE' });
  if (deleted.error) throw deleted.error;
  console.log('Disposable decimal QA account deleted.');
}
