// Explicit live smoke test: creates and deletes its own synthetic adult account.
// It calls paid model inference; keep it outside the default verification suite.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { BLS_SEARCH_ROWS } from '../supabase/functions/_shared/bls-search-data.mjs';

if (!process.argv.includes('--live')) throw new Error('Explicit --live is required.');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, 'Public Supabase configuration is required');
const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const report = { timestamp: new Date().toISOString(), cases: [], cleanup: false };
const output = process.env.KANDRO_QA_OUTPUT;
const saveReport = () => {
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
};
let token;
let userId;
async function request(path, body, authenticated = true) {
  const response = await fetch(`${url}/functions/v1/nutrition${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { apikey: key, 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  return { status: response.status, body: await response.json() };
}

try {
  const unauthenticated = await request('/v1/search?q=muesli&language=en', undefined, false);
  assert.equal(unauthenticated.status, 401, 'Anonymous public requests must remain rejected');
  report.unauthenticatedStatus = unauthenticated.status;
  const signIn = await client.auth.signInAnonymously();
  if (signIn.error) throw signIn.error;
  userId = signIn.data.user.id;
  token = signIn.data.session.access_token;
  const noConsent = await request('/v1/search?q=muesli&language=en');
  assert.equal(noConsent.status, 403, 'Authentication must not bypass wellness consent');
  report.noConsentStatus = noConsent.status;
  const consent = await client.from('profiles').upsert({
    user_id: userId, display_name: 'Synthetic nutrition deployment QA', age: 29,
    privacy_version: '2026-09-04-ai-v2', wellness_consent_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (consent.error) throw consent.error;

  for (const fixture of [
    { name: 'English feedback foods', language: 'en', protocol: 1,
      description: '100 g crunchy muesli, 15 g spicy remoulade sauce, 30 g crispy paprika potato chips, and 20 g milk chocolate with biscuit. All amounts are the actual edible weight.' },
    { name: 'German corrected families', language: 'de', protocol: 1,
      description: 'Drei getrennte Lebensmittel: 100 g Knuspermüsli, 15 g würzige Remoulade Sauce und 30 g knusprige Paprika-Kartoffelchips. Alle Mengen sind das tatsächliche essbare Gewicht.' },
    { name: 'Legacy unresolved feedback', language: 'en',
      description: '100 g crunchy muesli, 15 g spicy remoulade sauce, 30 g crispy paprika potato chips, and 20 g milk chocolate with biscuit. All amounts are the actual edible weight.' },
  ]) {
    const result = await request('/v1/describe', {
      description: fixture.description, language: fixture.language, requestId: randomUUID(),
      ...(fixture.protocol ? { ingredientCorrection: fixture.protocol } : {}),
    });
    report.cases.push({ ...fixture, ...result });
    saveReport();
    console.log(fixture.name, result.status, result.body.code ?? (result.body.correctionRequired ? 'correction draft' : 'complete'));
  }
  for (const result of report.cases.slice(0, 2)) {
    assert.equal(result.status, 200, result.name);
    for (const [code, grams] of [['C514200', 100], ['Q999000', 15], ['K280100', 30]]) {
      const item = result.body.items.find(item => item.source?.referenceId === code);
      assert.ok(item, `${result.name}: missing reviewed family ${code}`);
      const row = BLS_SEARCH_ROWS.find(row => row[0] === code);
      assert.equal(item.amountG, grams, `${result.name}: preserve explicit grams`);
      assert.equal(item.calories, Math.round(row[3] * grams / 100), `${result.name}: scale source values`);
      assert.equal(item.confidence, 'medium', `${result.name}: typical family is an estimate`);
      assert.equal(item.source.estimatedReference, true);
    }
    assert.ok(!result.body.items.some(item => ['X092510', 'S581300'].includes(item.source?.referenceId)), 'No yogurt dish for dry muesli or unverified wholemeal-bar substitution');
  }
  assert.notEqual(report.cases[1].body.correctionRequired, true, 'The three corrected families should be complete');
  const legacy = report.cases[2];
  assert.ok(legacy.status === 422 || (legacy.status === 200 && legacy.body.items?.every(item => item.source?.code !== 'unmatched')), 'Legacy responses cannot contain unresolved zero placeholders');
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  if (userId) {
    const deletion = await client.functions.invoke('delete-account', { method: 'DELETE' });
    if (deletion.error) {
      report.cleanupUserId = userId;
      report.cleanupError = deletion.error.message;
      process.exitCode = 1;
    } else {
      const remaining = await client.from('profiles').select('user_id').eq('user_id', userId);
      report.cleanup = !remaining.error && remaining.data.length === 0;
      if (!report.cleanup) process.exitCode = 1;
    }
  }
  saveReport();
  console.log(JSON.stringify({ passed: report.passed, cleanup: report.cleanup }));
}
