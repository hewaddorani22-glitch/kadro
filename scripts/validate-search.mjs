/**
 * Food search is the cheap path: no model call, so it costs the user no free
 * meal and costs us no credit. That only holds if it stays wired that way.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(projectRoot, relative), 'utf8');

const gateway = await read('supabase/functions/nutrition/index.ts');
const service = await read('src/services/mealAnalysis.ts');
const screen = await read('src/app/(tabs)/scan.tsx');
const context = await read('src/context/AppContext.tsx');
const confirm = await read('src/app/confirm.tsx');

// --- No model call, and outside the paid quota -----------------------------
const searchFn = gateway.slice(gateway.indexOf('async function searchFoods'), gateway.indexOf('async function usdaRows'));
assert.ok(searchFn.length > 100, 'could not locate the search handler');
assert.ok(!/requestDetection|openrouter|gpt-/i.test(searchFn), 'search must not call the model');
assert.ok(!/consume_analysis_quota/.test(searchFn), 'search must not consume the analysis quota');
// The quota is charged on the POST path; search is a GET, like the barcode.
const getBlock = gateway.slice(gateway.indexOf("if (request.method === 'GET')"), gateway.indexOf("if (request.method !== 'POST')"));
assert.match(getBlock, /route === '\/v1\/search'/, 'search must be served on the free GET path');

// --- The client must not spend a free meal on it ---------------------------
const addFn = screen.slice(screen.indexOf('const addSearchResult'), screen.indexOf('const submitDescription'));
assert.ok(addFn.length > 50, 'could not locate the add-from-search handler');
assert.ok(!addFn.includes('hasScanAccess'), 'adding a searched food must not spend a free meal');
assert.ok(context.includes('applySearchResult'), 'the context must accept a resolved search result');
const applyFn = context.slice(context.indexOf('const applySearchResult'), context.indexOf('const startBarcodeScan'));
assert.ok(!/analyzeDescription|analyzePreparedPhoto|analyzeBarcode/.test(applyFn), 'a searched food is already resolved');

// --- Typing must not fire a request per keystroke --------------------------
const runFn = screen.slice(screen.indexOf('const runSearch'), screen.indexOf('const addSearchResult'));
assert.match(runFn, /setTimeout\(/, 'search must be debounced');
assert.match(runFn, /clearTimeout\(searchTimer\.current\)/, 'a pending search must be cancelled');
// A slow early response must not overwrite a later, better one.
assert.match(runFn, /latestSearch\.current !== request/, 'stale responses must be discarded');
assert.match(runFn, /term\.length < 2/, 'a one-letter query must not be sent');

// --- A searched food must never spend a free analysis ----------------------
// The server charges a successful AI result before Confirm. Search is already
// resolved data, so it must be excluded at that exact success boundary.
assert.match(context, /FREE_ANALYSIS_MODES/, 'the free inputs must be named somewhere');
const modes = context.match(/FREE_ANALYSIS_MODES = new Set<ScanMode>\(\[([^\]]*)\]\)/);
assert.ok(modes, 'could not read the free input list');
for (const mode of ['search', 'demo', 'barcode']) {
  assert.ok(modes[1].includes(`'${mode}'`), `${mode} must not spend a free meal`);
}
for (const mode of ['live', 'description']) {
  assert.ok(!modes[1].includes(`'${mode}'`), `${mode} costs an analysis and must be charged`);
}
const logging = context.slice(context.indexOf('const logScannedMeal'), context.indexOf('const logPlannedMeal'));
const analyzing = context.slice(context.indexOf('const analyzeCurrentPhoto'), context.indexOf('const resumeLatestAnalysis'));
assert.match(
  analyzing,
  /!FREE_ANALYSIS_MODES\.has\(activeScanMode\)[\s\S]*countLifetimeScanOnce\(invocationScanId\)/,
  'only a successful input that reached the model may spend an analysis',
);
assert.doesNotMatch(logging, /countLifetimeScanOnce/,
  'saving or abandoning Confirm must not change an already decided allowance');
// The allowance is also derived from how many stored meals carry origin
// 'scan', so incrementing a counter is not enough on its own.
assert.match(
  logging,
  /origin: costsAnalysis \? 'scan' : 'plan'/,
  'a searched food must not be stored as a scan, or the count re-inflates from history',
);
assert.match(context, /origin === 'scan'/, 'the scan count is derived from the stored origin');
// The database only accepts these two values.
assert.ok(!/origin: 'search'/.test(context), "the meals table constrains origin to 'scan' and 'plan'");

// --- The result must carry its source --------------------------------------
const mealFn = service.slice(service.indexOf('export function mealFromSearch'));
assert.match(mealFn, /source: result\.source/, 'a logged food must keep the reference it came from');
assert.match(mealFn, /grams \/ 100/, 'values must scale from per-100g to the chosen amount');

// --- Both languages offer it ----------------------------------------------
for (const file of ['src/i18n/de.ts', 'src/i18n/en.ts']) {
  const dictionary = await read(file);
  for (const key of ['modeSearch', 'searchTitle', 'searchEmpty', 'searchFree', 'searchAgain']) {
    assert.ok(dictionary.includes(`${key}:`), `${file} is missing ${key}`);
  }
}

// A database search has no photo to retake. Its secondary action must return
// to an already-open search sheet and say what will actually happen.
assert.match(confirm, /scanMode === 'search' \? t\.confirm\.searchAgain : t\.confirm\.retake/,
  'search confirmation must not offer to retake a photo');
const changeInput = confirm.slice(confirm.indexOf('const changeInput'), confirm.indexOf('const confirm'));
assert.match(changeInput, /scanMode === 'search'/, 'the change-input action must distinguish a search result');
assert.match(changeInput, /router\.replace\('\/\(tabs\)\/scan\?mode=search'\)/,
  'choosing another searched food must reopen the search sheet');
// German search leans on the BLS dish names, because USDA is English only.
const bls = await read('supabase/functions/_shared/bls-reference.mjs');
assert.ok(bls.includes('export function searchBlsReferences'), 'German search needs the dish references');
assert.match(searchFn, /language === 'de'/, 'the German dish names must only be offered to German readers');

console.log('Validated search: no model call, no quota, no free meal spent, debounced, stale responses discarded.');
