// Explicit network check. No AI call; creates and deletes its own QA account.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.auth.signInAnonymously();
if (error || !data.user) throw error ?? Error('No QA account');
try {
  const setup = await client.from('profiles').upsert({ user_id: data.user.id, age: 29, privacy_version: '2026-09-04-ai-v2', wellness_consent_at: new Date().toISOString() });
  if (setup.error) throw setup.error;
  const response = await fetch(`${url}/functions/v1/nutrition/v1/barcode/8000500310427?language=de`, {
    headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: key },
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.code);
  for (const field of ['calories', 'protein', 'carbs', 'fat']) assert.ok(Number.isFinite(body.per100g[field]) && body.per100g[field] >= 0, field);
  assert.ok(body.per100g.calories > 0);
  console.log(JSON.stringify({ status: response.status, name: body.name, per100g: body.per100g }));
} finally {
  const removed = await client.functions.invoke('delete-account', { method: 'DELETE' });
  if (removed.error) throw removed.error;
  console.log('Disposable barcode QA account deleted.');
}
