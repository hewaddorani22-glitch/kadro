import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const [sync, cloud, context, localRepository, paywall, de, en] = await Promise.all([
  read('src/services/syncRepository.ts'),
  read('src/services/cloudRepository.ts'),
  read('src/context/AppContext.tsx'),
  read('src/services/localRepository.ts'),
  read('src/app/paywall.tsx'),
  read('src/i18n/de.ts'),
  read('src/i18n/en.ts'),
]);

// Execute the same pure predicate used by cloud hydration. This catches the
// regression where any plan/search meal was treated as proof of an AI scan.
const predicate = sync.match(/export function hasAnalyzedMeal\(meals: Meal\[\]\) \{([\s\S]*?)\n\}/);
assert.ok(predicate, 'could not locate the cloud-hydration analysis predicate');
const hasAnalyzedMeal = new Function('meals', predicate[1]);
assert.equal(hasAnalyzedMeal([]), false);
assert.equal(hasAnalyzedMeal([{ origin: 'plan' }]), false, 'a plan meal must not spend an analysis');
assert.equal(hasAnalyzedMeal([{ origin: 'plan' }, { origin: 'plan' }]), false, 'search and barcode meals must stay free after hydration');
assert.equal(hasAnalyzedMeal([{ origin: 'scan' }]), true, 'a real photo/text analysis must be recognised');
assert.equal(hasAnalyzedMeal([{ origin: 'plan' }, { origin: 'scan' }]), true);

assert.match(cloud, /\.eq\('origin', 'scan'\)/,
  'the all-time cloud probe must filter for real analyzed meals');
assert.match(sync, /cloudHasAnalyzedMeal \|\| hasAnalyzedMeal\(localScans\)/,
  'hydration must not infer an analysis from an arbitrary cloud or local meal');

// The origin is assigned before persistence, so protect every no-model mode as
// well as the hydration predicate. A demo result looks like a scan in the UI,
// but it must remain free just like database search and barcode lookup.
const freeModes = context.match(/const FREE_ANALYSIS_MODES = new Set<ScanMode>\(\[([^\]]+)]\)/);
assert.ok(freeModes, 'could not locate the no-model mode allowlist');
for (const mode of ['demo', 'search', 'barcode']) {
  assert.match(freeModes[1], new RegExp(`['"]${mode}['"]`), `${mode} must never spend an AI analysis`);
}
for (const paidMode of ['live', 'queued', 'description']) {
  assert.doesNotMatch(freeModes[1], new RegExp(`['"]${paidMode}['"]`), `${paidMode} must remain an AI analysis mode`);
}
assert.match(context, /const costsAnalysis = !FREE_ANALYSIS_MODES\.has\(scanModeRef\.current\)/,
  'meal origin and allowance must be derived from the no-model mode allowlist');
assert.match(context, /origin: costsAnalysis \? 'scan' : 'plan'/,
  'only a paid AI analysis may persist with origin=scan');
const analysisStart = context.indexOf('const analyzeCurrentPhoto = useCallback');
const analysisEnd = context.indexOf('const resumeLatestAnalysis = useCallback', analysisStart);
const analysisFlow = context.slice(analysisStart, analysisEnd);
const resultReceived = analysisFlow.indexOf('const result = activeScanMode');
const countCommitted = analysisFlow.indexOf('countLifetimeScanOnce(invocationScanId)');
const resultShown = analysisFlow.indexOf("setAnalysisStatus('ready')", resultReceived);
assert.ok(
  resultReceived >= 0 && countCommitted > resultReceived && resultShown > countCommitted,
  'a successful AI result must spend the local lifetime allowance before confirmation is shown',
);
assert.match(analysisFlow, /!FREE_ANALYSIS_MODES\.has\(activeScanMode\)[\s\S]*countLifetimeScanOnce\(invocationScanId\)/,
  'demo/search/barcode results must stay free');
assert.match(analysisFlow, /inFlightAnalysisIdsRef\.current\.has\(invocationScanId\)[\s\S]*inFlightAnalysisIdsRef\.current\.add\(invocationScanId\)/,
  'a double tap must not start a second request for the same analysis id');
assert.match(analysisFlow, /const invocationGeneration = \+\+analysisGenerationRef\.current[\s\S]*const isCurrentInvocation/,
  'each asynchronous analysis needs an invocation generation');
assert.ok((analysisFlow.match(/if \(!isCurrentInvocation\(\)\)/g) ?? []).length >= 6,
  'photo preparation, success and every asynchronous failure branch must reject stale UI mutations');
assert.ok(
  analysisFlow.indexOf('countLifetimeScanOnce(invocationScanId)') < analysisFlow.indexOf('if (!isCurrentInvocation()) return;', resultReceived),
  'a stale successful provider response must still update local quota bookkeeping before its UI result is discarded',
);
assert.match(context, /const resetScan = useCallback\(\(\) => \{\s*analysisGenerationRef\.current \+= 1/,
  'leaving the analysis flow must invalidate its pending response');
const saveStart = context.indexOf('const logScannedMeal = useCallback');
const saveEnd = context.indexOf('const logPlannedMeal = useCallback', saveStart);
assert.doesNotMatch(context.slice(saveStart, saveEnd), /countLifetimeScanOnce/,
  'abandoning the confirm screen must not leave the client behind the server ledger');
assert.match(localRepository, /AsyncStorage\.setItem\(COUNTED_SCAN_IDS_KEY,[\s\S]*count: next,[\s\S]*ids: \[\.\.\.ids, scanId\]/,
  'request id and count must be persisted together before mirroring the legacy count');

assert.match(paywall, /paywall\.analysis : t\.paywall\.analyses/,
  'the paywall must describe the analysis counter as analyses');
for (const [language, dictionary] of [['German', de], ['English', en]]) {
  assert.match(dictionary, /analysis: ['"][^'"]*Analys/i, `${language} singular analysis copy is missing`);
  assert.match(dictionary, /analyses: ['"][^'"]*Analys/i, `${language} plural analysis copy is missing`);
}

console.log('Analysis allowance checks passed: only origin=scan survives hydration as a paid AI analysis.');
