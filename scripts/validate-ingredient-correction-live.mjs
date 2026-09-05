// Explicit opt-in only: hosted model calls on a disposable QA identity.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await client.auth.signInAnonymously();
if (error || !data.user) throw new Error('Disposable QA sign-in failed');
try {
  const consent = await client.from('profiles').upsert({ user_id: data.user.id, age: 29, privacy_version: '2026-09-04-ai-v2', wellness_consent_at: new Date().toISOString() });
  if (consent.error) throw consent.error;
  const cases = [
    { name: 'Nutella description', description: 'Nutella mit Scheibe Brot', protocol: 1, complete: true },
    { name: 'Seven foods, text lookup only', description: '30 g Kartoffelchips, 5 g roher Ingwer, 100 g Tomate, 120 g Birne, 150 g Apfel, 75 g Kiwi und 50 g Rosinen', protocol: 1, complete: true },
    { name: 'Unknown food, correction client', description: '100 g Banane und 30 g bittere Lindenzapfen', protocol: 1, complete: false },
    { name: 'Unknown food, legacy client', description: '100 g Banane und 30 g bittere Lindenzapfen', protocol: undefined, complete: false },
  ];
  for (const test of cases) {
    const response = await fetch(`${url}/functions/v1/nutrition/v1/describe`, {
      method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: test.description, language: 'de', locale: 'de-DE', requestId: randomUUID(), ingredientCorrection: test.protocol }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await response.json();
    console.log(JSON.stringify({ case: test.name, status: response.status, code: body.code, correctionRequired: body.correctionRequired, items: body.items?.map(({ name, amountG, calories, source }) => ({ name, amountG, calories, source })) }));
    if (test.complete) {
      assert.equal(response.status, 200, body.code);
      assert.notEqual(body.correctionRequired, true);
      assert.ok(body.items.length >= (test.name.startsWith('Seven') ? 7 : 2));
      assert.ok(body.items.every(item => item.included && item.calories > 0 && item.source?.code !== 'unmatched'));
      if (test.name.startsWith('Seven')) {
        const chips = body.items.find(item => /chips/i.test(item.name));
        assert.equal(chips?.source.referenceId, 'K280100', 'Potato chips must not silently use the BLS British fries translation');
        assert.equal(chips.calories, Math.round(526 * chips.amountG / 100));
      }
    } else if (test.protocol === 1 && response.status === 200) {
      assert.equal(body.correctionRequired, true, 'Do not turn unknown/non-food identities into resolved nutrition');
      assert.ok(body.items.some(item => item.source?.code === 'unmatched'));
    } else {
      assert.equal(response.status, 422, 'Unknown input must remain unresolved');
      assert.ok(['missing_nutrition', 'unclear_image'].includes(body.code));
    }
  }
} finally {
  const deleted = await client.functions.invoke('delete-account', { method: 'DELETE' });
  if (deleted.error) throw deleted.error;
  console.log('Disposable ingredient-correction QA account deleted.');
}
