// Opt-in live model/USDA regression; creates and deletes only its own QA user.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.auth.signInAnonymously();
if (error || !data.user) throw error ?? new Error('No test account');
try {
  const consent = await client.from('profiles').upsert({ user_id: data.user.id, age: 29, privacy_version: '2026-09-04-ai-v2', wellness_consent_at: new Date().toISOString() });
  if (consent.error) throw consent.error;
  const response = await fetch(`${url}/functions/v1/nutrition/v1/describe`, {
    method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: '1000 g rohes Honigmelonen-Fruchtfleisch ohne Schale und Kerne', language: 'de', locale: 'de-DE', requestId: randomUUID() }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.code ?? 'Live analysis failed');
  const included = body.items.filter(item => item.included);
  assert.ok(included.length > 0);
  assert.ok(included.every(item => item.calories > 0 && item.carbs > 0));
  const total = included.reduce((sum, item) => sum + item.calories, 0);
  assert.ok(total >= 250 && total <= 450, `Unexpected 1000 g melon energy: ${total}`);
  console.log(JSON.stringify({ title: body.title, items: included.map(({name,amountG,calories,protein,carbs,fat,source})=>({name,amountG,calories,protein,carbs,fat,source})) }, null, 2));
} finally {
  const deleted = await client.functions.invoke('delete-account', { method: 'DELETE' });
  if (deleted.error) throw deleted.error;
  console.log('Disposable melon QA account deleted.');
}
