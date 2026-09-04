import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const [consent, context, routes, subscription, reminders, gateway, analysis, analyzing, onboarding, guardianService, guardianFunction, config, de, en, legalDe, legalEn, guardianPageDe, guardianPageEn, guardianScript, profileScreen, personalization, appJsonRaw, ageMigration] = await Promise.all([
  read('src/services/consent.ts'), read('src/context/AppContext.tsx'), read('src/components/AppRouteGuard.tsx'),
  read('src/context/SubscriptionContext.tsx'), read('src/components/ReminderScheduler.tsx'),
  read('supabase/functions/nutrition/index.ts'), read('src/services/mealAnalysis.ts'), read('src/app/analyzing.tsx'),
  read('src/app/onboarding.tsx'), read('src/services/guardianConsent.ts'), read('supabase/functions/guardian-consent/index.ts'), read('supabase/config.toml'),
  read('src/i18n/de.ts'), read('src/i18n/en.ts'), read('src/i18n/legal.de.ts'), read('src/i18n/legal.en.ts'),
  read('site/guardian-consent/index.html'), read('site/en/guardian-consent/index.html'), read('site/guardian-consent.js'),
  read('src/app/(tabs)/profile.tsx'), read('src/services/personalization.ts'), read('app.json'),
  read('supabase/migrations/20260904120000_allow_teen_profiles_with_guardian_consent.sql'),
]);

const appJson = JSON.parse(appJsonRaw);
const version = consent.match(/PRIVACY_VERSION = '([^']+)'/)?.[1];
assert.ok(version, 'the app must expose a versioned privacy consent');
assert.ok(gateway.includes(`REQUIRED_PRIVACY_VERSION = '${version}'`), 'app and gateway consent versions must match');
assert.match(gateway, /select\('age,privacy_version,wellness_consent_at,guardian_consent_at,guardian_consent_version'\)/, 'the gateway must verify consent and guardian approval server-side');
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
assert.match(onboarding, /min=\{14\}/, 'onboarding must allow the promised minimum age of 14');
assert.match(ageMigration, /between 14 and 100/, 'database age policy must match 14+ onboarding');
assert.match(ageMigration, /age >= 16[\s\S]*guardian_consent_at is not null[\s\S]*guardian_consent_version/, 'under-16 consent must depend on server-recorded guardian approval');
assert.match(ageMigration, /alter table public\.guardian_consent_requests enable row level security/, 'guardian requests need RLS');
assert.match(ageMigration, /revoke all on table public\.guardian_consent_requests from anon, authenticated/, 'guardian emails must be unreachable to clients');
assert.ok(!/create policy .*guardian_consent_requests/i.test(ageMigration), 'guardian requests must not have a client policy');
assert.match(ageMigration, /protect_guardian_consent_fields/, 'guardian approval fields must be server managed');
assert.match(config, /\[functions\.guardian-consent\]\s*\nverify_jwt = false/, 'the emailed confirmation link must be publicly reachable');
assert.match(guardianFunction, /async function currentUser/, 'request and status paths must still validate the app user JWT');
assert.match(guardianFunction, /crypto\.subtle\.digest\('SHA-256'/, 'raw confirmation tokens must not be stored');
assert.match(guardianFunction, /guardian_email: null/, 'the guardian email must be cleared after delivery');
assert.match(guardianFunction, /TOKEN_HOURS = 48/, 'guardian links need a bounded lifetime');
assert.match(guardianService, /ensureSupabaseUser/, 'guardian requests must belong to an authenticated anonymous user');
assert.match(guardianScript, /guardianConfirmed: true/, 'the public page must send an explicit guardian affirmation');
assert.match(guardianScript, /if \(!checkbox\.checked\)/, 'opening the email link alone must not count as guardian consent');
for (const [language, page] of [['de', guardianPageDe], ['en', guardianPageEn]]) {
  assert.match(page, /type="checkbox" required/, `${language} guardian page needs an affirmative checkbox`);
  assert.match(page, /14[^<]*15|14- oder 15|14 or 15/, `${language} guardian page must identify the protected ages`);
}
assert.match(gateway, /REQUIRED_GUARDIAN_VERSION/, 'the paid gateway must enforce guardian approval server-side');
assert.match(gateway, /select\('age,privacy_version,wellness_consent_at,guardian_consent_at,guardian_consent_version'\)/, 'the gateway must read the complete age-consent boundary');
for (const [language, legal] of [['de', legalDe], ['en', legalEn]]) {
  for (const phrase of ['14', '15', '16', 'Resend']) {
    assert.ok(legal.includes(phrase), `${language} legal copy must disclose the teen/guardian flow and mail processor`);
  }
}
assert.match(context, /completedProfile\.age < 18[\s\S]*setAnalyticsCollectionEnabled\(false\)/, 'saving a minor profile must remove an earlier analytics opt-in');
assert.match(profileScreen, /disabled=\{isMinor \|\| !isTelemetryConfigured\}/, 'minors must not be able to enable optional analytics');
assert.match(personalization, /const offset = teen \? 0 :/, 'teen goals must never turn into an adult calorie deficit or surplus');

const cameraPlugin = appJson.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-camera');
assert.equal(cameraPlugin?.[1]?.microphonePermission, false, 'a still-photo app must not request microphone access');
assert.equal(cameraPlugin?.[1]?.recordAudioAndroid, false, 'Android audio permission must stay disabled');
assert.ok(appJson.expo.locales?.en && appJson.expo.locales?.de, 'permission copy must be localized in English and German');
assert.equal(appJson.expo.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsArbitraryLoads, false, 'iOS must reject arbitrary unencrypted network loads');

console.log('Validated explicit AI consent, withdrawal, 14+ guardian enforcement and minimal native permissions.');
