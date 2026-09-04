import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['eas-cli', 'env:list', 'production', '--format', 'long'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  shell: false,
});
if (result.status !== 0) throw new Error(result.stderr.trim() || 'Could not read the EAS production environment.');

const variables = new Map();
for (const block of result.stdout.split(/\n[^\n]*———[^\n]*\n/g)) {
  const name = block.match(/^Name\s+(.+)$/m)?.[1]?.trim();
  const value = block.match(/^Value\s+(.*)$/m)?.[1]?.trim();
  if (name) variables.set(name, value ?? '');
}

const required = [
  'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
  'EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID',
  'EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN',
  'EXPO_PUBLIC_POSTHOG_HOST',
  'EXPO_PUBLIC_POSTHOG_ENABLED',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];
for (const name of required) assert.ok(variables.get(name), `${name} is missing in the EAS production environment`);

assert.match(variables.get('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY'), /^appl_/);
assert.equal(variables.get('EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID'), 'kandro_pro');
assert.match(variables.get('EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN'), /^phc_/);
assert.equal(variables.get('EXPO_PUBLIC_POSTHOG_HOST'), 'https://eu.i.posthog.com');
assert.equal(variables.get('EXPO_PUBLIC_POSTHOG_ENABLED'), 'true');
assert.match(variables.get('EXPO_PUBLIC_SUPABASE_URL'), /^https:\/\/.+\.supabase\.co$/);
assert.match(variables.get('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), /^sb_publishable_/);
assert.ok(!variables.get('EXPO_PUBLIC_ANALYSIS_API_URL'), 'production must use the hosted gateway, not a laptop URL');

console.log('EAS production is wired to RevenueCat, EU PostHog and the hosted Supabase gateway.');
