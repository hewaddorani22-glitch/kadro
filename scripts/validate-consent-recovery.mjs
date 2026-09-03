/**
 * The gateway is the authority on whether consent exists, and the two records
 * can legitimately diverge: deleting the account and re-enabling the cloud
 * creates a *new* anonymous user, and that user has no consent row.
 *
 * When that happens the screen said "Consent is active" while every analysis
 * was refused, and the only button was "Withdraw" — a dead end with no way
 * back. The local record has to yield to the server's verdict.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(projectRoot, relative), 'utf8');

const consent = await read('src/services/consent.ts');
const context = await read('src/context/AppContext.tsx');
const analysis = await read('src/services/mealAnalysis.ts');
const contracts = await read('src/services/contracts.ts');
const scan = await read('src/app/(tabs)/scan.tsx');

// --- Local consent is only written once the server has accepted ------------
const record = consent.slice(consent.indexOf('export async function recordWellnessConsent'), consent.indexOf('export async function forgetLocalWellnessConsent'));
const serverWrite = record.indexOf('supabase.from(\'profiles\')');
const localWrite = record.indexOf('AsyncStorage.setItem');
assert.ok(serverWrite > 0 && localWrite > serverWrite, 'consent must reach the server before it is stored locally');
assert.match(record, /if \(error\) throw error;/, 'a failed server write must not look like a granted consent');

// --- A refused analysis must clear the stale local record ------------------
assert.match(consent, /export async function forgetLocalWellnessConsent/, 'there must be a way to drop a stale local consent');
assert.match(contracts, /'consent-required'/, 'a refused consent needs its own error kind');
assert.match(analysis, /payload\?\.code === 'consent_required'/, 'the gateway code must map to that kind');
assert.match(
  context,
  /error\.kind === 'consent-required'[\s\S]{0,200}forgetLocalWellnessConsent\(\)/,
  'a consent-required response must clear the local record',
);
assert.match(
  context,
  /forgetLocalWellnessConsent\(\)[\s\S]{0,120}setWellnessConsentGranted\(false\)/,
  'clearing the record must also flip the state the route guard reads',
);

// --- Search must not present a refusal as an empty result ------------------
// "Nothing found" told the user the food does not exist when the truth was
// that we never asked.
const run = scan.slice(scan.indexOf('const runSearch'), scan.indexOf('const addSearchResult'));
// Look inside the catch itself: setSearchError(null) also appears when a new
// search starts, so its mere presence proves nothing.
const failure = run.slice(run.indexOf('.catch('));
assert.ok(failure.length > 20, 'the search must handle a failed request');
assert.match(
  failure,
  /setSearchError\((?!null)/,
  'the catch must set an error message, not just clear the results',
);
assert.match(scan, /searchError \? \(/, 'the sheet must render the error');
assert.match(scan, /!searchError && searchQuery/, 'the empty state must not show alongside an error');

console.log('Validated consent recovery: the server decides, a stale local record is dropped, and a refusal is never shown as "nothing found".');
