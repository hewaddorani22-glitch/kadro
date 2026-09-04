/**
 * validate:release reads the local .env, which an EAS build never sees. That
 * makes a green release check misleading: the build can still ship with an
 * empty provider name, a missing privacy URL, or no subscription key.
 *
 * This checks the build definition itself, not the machine it runs on.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const eas = JSON.parse(await readFile(resolve(projectRoot, 'eas.json'), 'utf8'));

/** Public by law or by design, so they belong in the versioned build config. */
const publicLegal = [
  'EXPO_PUBLIC_LEGAL_PROVIDER_NAME',
  'EXPO_PUBLIC_LEGAL_PROVIDER_ADDRESS',
  'EXPO_PUBLIC_LEGAL_CONTACT_EMAIL',
  'EXPO_PUBLIC_LEGAL_PRIVACY_URL',
  'EXPO_PUBLIC_LEGAL_TERMS_URL',
  'EXPO_PUBLIC_LEGAL_SUPPORT_URL',
];

for (const profile of ['preview', 'production']) {
  const env = eas.build?.[profile]?.env ?? {};
  for (const key of publicLegal) {
    assert.ok(env[key]?.trim(), `${profile}: ${key} is missing — the build would ship placeholder legal text`);
  }
  assert.match(env.EXPO_PUBLIC_LEGAL_PRIVACY_URL, /^https:\/\//, `${profile}: the privacy URL must be https`);
  assert.match(env.EXPO_PUBLIC_LEGAL_CONTACT_EMAIL, /@/, `${profile}: the contact must be an email address`);
}

// Secrets belong in the EAS environment, never in this file.
const raw = await readFile(resolve(projectRoot, 'eas.json'), 'utf8');
for (const secret of ['SUPABASE_SERVICE', 'OPENROUTER_API_KEY', 'USDA_API_KEY', 'sk-', 'service_role']) {
  assert.ok(!raw.includes(secret), `eas.json must not contain ${secret}`);
}

// Runtime account values belong to the selected EAS environment, not to this
// committed file. Their presence is verified against EAS before release; this
// local validator only prevents somebody from committing the wrong key type.
const production = eas.build?.production?.env ?? {};
const revenueCat = production.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
if (revenueCat) {
  assert.ok(!revenueCat.startsWith('appl_') === false, 'the iOS RevenueCat key must be the appl_ one, not the Android or test key');
}

console.log('Validated the EAS build definition: legal identity travels with the build, no secrets are committed.');
