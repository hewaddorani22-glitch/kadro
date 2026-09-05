// Opt-in only: paid production model calls, at most three successful analyses
// on one disposable QA account. Never run automatically in CI.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.auth.signInAnonymously();
if (error || !data.user) throw error ?? new Error('No QA account');
try {
  const consent = await client.from('profiles').upsert({ user_id: data.user.id, age: 29,
    privacy_version: '2026-09-04-ai-v2', wellness_consent_at: new Date().toISOString() });
  if (consent.error) throw consent.error;
  for (const [description, expected] of [
    ['Eine Scheibe Vollkornbrot, 50 g, mit 20 g Nutella', [180, 270]],
    ['50 g helle Rosinen', [120, 180]],
    ['2 hartgekochte Eier, 100 g ohne Schale, mit 30 g Mandeln natur', [280, 350]],
  ]) {
    const response = await fetch(`${url}/functions/v1/nutrition/v1/describe`, { method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, language: 'de', locale: 'de-DE', requestId: randomUUID() }) });
    const body = await response.json();
    assert.equal(response.status, 200, body.code);
    assert.ok(body.items?.length);
    assert.ok(body.items.every(item => item.included && item.calories > 0 && item.source?.code !== 'unmatched'));
    const total = body.items.reduce((sum,item) => sum + item.calories, 0);
    assert.ok(total >= expected[0] && total <= expected[1], `${description}: ${total} outside reference range`);
    if (description.includes('Eier')) assert.ok(body.items.every(item => item.source.referenceId !== 'Y710142'), 'boiled eggs became fried eggs');
    console.log(JSON.stringify({ description, status: response.status, total, items: body.items.map(({name,amountG,calories,source}) => ({name,amountG,calories,source})) }));
  }
} finally {
  const deleted = await client.functions.invoke('delete-account', { method: 'DELETE' });
  if (deleted.error) throw deleted.error;
  console.log('Disposable wording QA account deleted.');
}
