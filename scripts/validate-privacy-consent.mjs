import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [consent, context, routes, subscription, reminders, gateway, analysis, analyzing, de, en, appJsonRaw, ageMigration] = await Promise.all([
  read('src/services/consent.ts'), read('src/context/AppContext.tsx'), read('src/components/AppRouteGuard.tsx'),
  read('src/context/SubscriptionContext.tsx'), read('src/components/ReminderScheduler.tsx'),
  read('supabase/functions/nutrition/index.ts'), read('src/services/mealAnalysis.ts'), read('src/app/analyzing.tsx'),
  read('src/i18n/de.ts'), read('src/i18n/en.ts'), read('app.json'),
  read('supabase/migrations/20260902170000_restrict_profiles_to_adults.sql'),
]);

const appJson = JSON.parse(appJsonRaw);
const version = consent.match(/PRIVACY_VERSION = '([^']+)'/)?.[1];
assert.ok(version, 'the app must expose a versioned privacy consent');
assert.ok(gateway.includes(`REQUIRED_PRIVACY_VERSION = '${version}'`), 'app and gateway consent versions must match');
assert.match(gateway, /select\('privacy_version, wellness_consent_at'\)/, 'the gateway must verify consent server-side');
assert.match(gateway, /code: 'consent_required'/, 'the gateway needs a stable consent error code');
assert.match(context, /if \(!wellnessConsentGranted\)/, 'cloud hydration must stop without consent');
assert.match(subscription, /!wellnessConsentGranted/, 'RevenueCat must not initialize before consent');
assert.match(reminders, /!wellnessConsentGranted/, 'reminders must not initialize before consent');
assert.match(context, /withdrawStoredWellnessConsent/, 'the app must expose withdrawal');
assert.match(context, /clearAnalysisQueue\(\)/, 'withdrawal must discard pending photos');
assert.ok(routes.includes("'data-consent'"), 'privacy controls must stay reachable before consent');

for (const [language, dictionary] of [['de', de], ['en', en]]) {
  for (const recipient of ['OpenRouter', 'Microsoft Azure', 'OpenAI', 'GPT-4.1 mini']) {
    assert.ok(dictionary.includes(recipient), `${language} explicit consent must name ${recipient}`);
  }
  assert.match(dictionary, /Zero Data Retention/, `${language} must disclose the configured retention protection`);
}
assert.ok(gateway.includes('https://openrouter.ai/api/v1/responses'), 'the configured OpenRouter endpoint must stay explicit');
assert.ok(!gateway.includes('https://api.openai.com'), 'the hosted gateway must not expose an undisclosed direct-provider route');
assert.ok(!gateway.includes("Deno.env.get('AI_PROVIDER')"), 'the production AI recipient must not be switchable by configuration');
assert.ok(gateway.includes("only: ['azure']"), 'the disclosed Azure processor must be pinned');
assert.ok(gateway.includes('allow_fallbacks: false'), 'provider fallback would invalidate the named-recipient disclosure');
assert.ok(gateway.includes('zdr: true'), 'Zero Data Retention must be enforced in code');
assert.ok(!gateway.includes("Deno.env.get('OPENROUTER_ZDR')"), 'ZDR must not be disableable by production configuration');

assert.match(analysis, /MAX_IMAGE_BASE64/, 'the client must enforce the gateway image ceiling');
assert.match(analysis, /'invalid-input'/, 'oversized photos need a non-retry error');
assert.ok(!analyzing.includes('const destination = needsReview'), 'every estimate must pass through confirmation');
assert.ok(analyzing.includes("router.replace('/confirm')"), 'analysis must always lead to confirmation');
assert.match(ageMigration, /between 18 and 100/, 'database age policy must match 18+ onboarding');

const cameraPlugin = appJson.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-camera');
assert.equal(cameraPlugin?.[1]?.microphonePermission, false, 'a still-photo app must not request microphone access');
assert.equal(cameraPlugin?.[1]?.recordAudioAndroid, false, 'Android audio permission must stay disabled');
assert.ok(appJson.expo.locales?.en && appJson.expo.locales?.de, 'permission copy must be localized in English and German');
assert.equal(appJson.expo.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsArbitraryLoads, false, 'iOS must reject arbitrary unencrypted network loads');

console.log('Validated explicit AI consent, withdrawal, server enforcement, adult-only policy and minimal native permissions.');
