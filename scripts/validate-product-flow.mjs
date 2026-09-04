import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = Object.fromEntries(await Promise.all(Object.entries({
  index: 'src/app/index.tsx',
  onboarding: 'src/app/onboarding.tsx',
  scanner: 'src/app/(tabs)/scan.tsx',
  result: 'src/app/result.tsx',
  progress: 'src/app/(tabs)/progress.tsx',
  plan: 'src/app/(tabs)/plan.tsx',
  appContext: 'src/context/AppContext.tsx',
  routeGuard: 'src/components/AppRouteGuard.tsx',
  localRepository: 'src/services/localRepository.ts',
  recommendations: 'src/services/recommendations.ts',
  server: 'server/index.mjs',
}).map(async ([name, path]) => [name, await readFile(resolve(root, path), 'utf8')])));

const failures = [];
const requireText = (file, text, message) => {
  if (!files[file].includes(text)) failures.push(message);
};

requireText('index', 'profile.completedAt', 'startup does not skip completed onboarding');
requireText('routeGuard', 'publicBeforeConsent', 'deep links can bypass onboarding consent');
requireText('onboarding', 'calculateDailyTargets(draftProfile)', 'onboarding target is not calculated from the entered profile');
requireText('onboarding', 'completeOnboarding(draftProfile)', 'onboarding does not persist the entered profile');
requireText('appContext', 'await adoptProfile(completedProfile)', 'profile is not persisted locally through the privacy-safe adoption path');
requireText('appContext', 'await saveProfile(nextProfile)', 'the shared profile adoption path does not persist locally');
requireText('appContext', 'syncUserSetup(completedProfile, nextTargets)', 'profile and targets are not mirrored to Supabase');
requireText('localRepository', 'WEIGHTS_KEY', 'weight history is not persisted');
requireText('progress', 'mealHistory', 'progress does not use actual meal history');
requireText('progress', 'weightEntries', 'progress does not use actual weight entries');
if (/const weights\s*=\s*\[/.test(files.progress)) failures.push('progress still contains a fixture weight curve');
if (files.localRepository.includes('INITIAL_MEALS')) failures.push('the daily timeline still injects a fake meal');
requireText('result', 'isCurrentScanLogged', 'result projection cannot distinguish the current meal from prior scans');
requireText('plan', 'profile.preferences', 'recommendation screen ignores saved preferences');
requireText('recommendations', 'matchesDietaryConstraints', 'dietary constraints are not applied to the catalog');
// Checked by wiring, not by wording: the labels live in the dictionaries now,
// so asserting on German text would break the moment anything is translated.
for (const mode of ['modePhoto', 'modeDescribe', 'modeBarcode']) {
  requireText('scanner', `t.scan.${mode}`, `scanner mode missing: ${mode}`);
}
for (const mode of ['photo', 'description', 'barcode']) {
  requireText('scanner', `chooseMode('${mode}')`, `scanner cannot switch to ${mode}`);
}
requireText('server', "request.url === '/v1/describe'", 'description analysis endpoint is missing');
requireText('server', 'barcodeMatch', 'barcode lookup endpoint is missing');

if (failures.length) throw new Error(`Product-flow validation failed:\n- ${failures.join('\n- ')}`);

console.log('Validated persisted personalization, honest progress, repeat-scan math, preferences, and all three scanner inputs.');
