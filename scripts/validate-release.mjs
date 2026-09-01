/**
 * Release gate. Run before building anything that leaves this machine.
 *
 * `npm run verify` proves the code is sound. This proves the *build* is
 * shippable: the things App Review rejects for are configuration and copy, not
 * TypeScript. Each check below corresponds to something that would either get
 * the app rejected or ship wrong information to a user.
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(projectRoot, relative), 'utf8');

const [appJsonRaw, privacy, terms, sources, paywall, legalConstants] = await Promise.all([
  read('app.json'),
  read('src/app/privacy.tsx'),
  read('src/app/terms.tsx'),
  read('src/app/sources.tsx'),
  read('src/app/paywall.tsx'),
  read('src/constants/legal.ts'),
]);
const appJson = JSON.parse(appJsonRaw);

const blockers = [];
const warnings = [];

// --- Provider identity -----------------------------------------------------
// GDPR Art. 13 requires naming the controller; App Review reads these screens
// and rejects apps whose own legal text says they are unfinished.
const requiredEnv = {
  EXPO_PUBLIC_LEGAL_PROVIDER_NAME: 'the responsible provider shown in the privacy notice',
  EXPO_PUBLIC_LEGAL_CONTACT_EMAIL: 'the contact address for privacy requests and support',
  EXPO_PUBLIC_LEGAL_PRIVACY_URL: 'the public privacy policy URL App Store Connect requires',
  EXPO_PUBLIC_LEGAL_SUPPORT_URL: 'the public support URL App Store Connect requires',
};
for (const [name, why] of Object.entries(requiredEnv)) {
  if (!process.env[name]?.trim()) blockers.push(`${name} is empty — ${why}`);
}
for (const [name, value] of Object.entries(process.env)) {
  if (name.endsWith('_URL') && name.startsWith('EXPO_PUBLIC_LEGAL_') && value?.trim() && !/^https:\/\//.test(value.trim())) {
    blockers.push(`${name} must be an https URL`);
  }
}

// --- Copy that must not ship ----------------------------------------------
// Text telling a reviewer the app is a draft is an instant completeness fail.
const draftWords = /MVP|Entwurf|Platzhalter|noch nicht fertig|vor der externen|TODO|FIXME/i;
for (const [label, contents] of [['privacy', privacy], ['terms', terms], ['sources', sources], ['legal constants', legalConstants]]) {
  const offending = contents
    .split('\n')
    .filter((line) => draftWords.test(line) && !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'));
  if (offending.length) {
    blockers.push(`${label} still contains draft wording: ${offending[0].trim().slice(0, 90)}`);
  }
}

// --- Subscription disclosure (App Review 3.1.2) ----------------------------
for (const required of ['Verlängert sich automatisch', 'Apple-ID', 'Wiederherstellen']) {
  if (!paywall.includes(required)) {
    blockers.push(`the paywall must state "${required}" before the purchase`);
  }
}

// --- iOS configuration ------------------------------------------------------
const ios = appJson.expo?.ios ?? {};
const plist = ios.infoPlist ?? {};
if (plist.ITSAppUsesNonExemptEncryption !== false) {
  blockers.push('ios.infoPlist.ITSAppUsesNonExemptEncryption must be set, or every submission asks the export question by hand');
}
if (!plist.NSCameraUsageDescription) blockers.push('NSCameraUsageDescription is missing');
if (/demo|test|beispiel/i.test(plist.NSCameraUsageDescription ?? '')) {
  blockers.push('NSCameraUsageDescription calls the app a demo — App Review reads this string');
}
if (!ios.bundleIdentifier?.includes('kandro')) warnings.push('bundle identifier does not mention kandro');

// --- Analysis gateway -------------------------------------------------------
// A release build that keeps the local override points at the developer's LAN
// and fails for every real user.
if (process.env.EXPO_PUBLIC_ANALYSIS_API_URL?.trim()) {
  warnings.push('EXPO_PUBLIC_ANALYSIS_API_URL is set — fine locally, but it MUST be empty in the EAS preview and production environments');
}
for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) {
  if (!process.env[name]?.trim()) blockers.push(`${name} is empty — without it the hosted analysis cannot be reached`);
}
if (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim().startsWith('sb_secret')) {
  blockers.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key — only the publishable key may reach a device');
}

// --- Subscriptions ----------------------------------------------------------
if (!process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()) {
  warnings.push('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is empty — required for a real App Store build, not for Expo Go');
}

if (warnings.length) {
  console.warn(`Release warnings:\n- ${warnings.join('\n- ')}\n`);
}
if (blockers.length) {
  throw new Error(`Not ready to ship:\n- ${blockers.join('\n- ')}`);
}

console.log('Release checks passed: provider identity, legal copy, subscription disclosure, iOS config and gateway wiring.');
