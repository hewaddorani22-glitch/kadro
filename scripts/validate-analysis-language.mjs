/**
 * The analysis gateway is one deployed function serving every language, so the
 * language has to travel with the request. It used to demand `nameDe` and a
 * German prompt, which meant an English user typing "chicken and rice" got
 * German ingredient names back on the result screen.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(projectRoot, relative), 'utf8');

const {
  detectionSchema,
  photoDetectionPrompt,
  descriptionDetectionPrompt,
} = await import(new URL('../supabase/functions/_shared/detection.mjs', import.meta.url));
const { requestedLanguage, classifyDetection } = await import(new URL('../supabase/functions/_shared/nutrition.mjs', import.meta.url));
const uncertainTextMeal = { clarity: 'unclear', dishCount: 2, items: [{ name: 'Gulasch' }, { name: 'Apfelsoße' }] };
assert.equal(classifyDetection(uncertainTextMeal, 'text'), null, 'identifiable text must not fail photo-only clarity/plate gates');
assert.equal(classifyDetection(uncertainTextMeal, 'photo').status, 422, 'unclear photos still need correction');
assert.equal(classifyDetection({ ...uncertainTextMeal, items: [] }, 'text').status, 422, 'no invented nutrition for unidentifiable text');
for (const page of ['src/app/analyzing.tsx', 'src/app/confirm.tsx']) {
  assert.match(await read(page), /description=\{scanMode === 'description' \? descriptionInput/, 'the original input must remain visible');
}
assert.match(await read('src/app/analyzing.tsx'), /errDescriptionTitle/);

// --- The prompt must name the output language ------------------------------
const prompts = {
  de: photoDetectionPrompt('de'),
  en: photoDetectionPrompt('en'),
};
assert.match(prompts.de, /in German/, 'the German prompt must ask for German names');
assert.match(prompts.en, /in English/, 'the English prompt must ask for English names');
assert.notEqual(prompts.de, prompts.en, 'both languages produced the same prompt');
assert.equal(photoDetectionPrompt(), prompts.en, 'the default prompt language must be English');

// The USDA lookup is not display text and breaks if it gets localised.
for (const [language, prompt] of Object.entries(prompts)) {
  assert.match(prompt, /"searchTermEn" is a USDA .* query and is always English/, `${language}: the USDA term must stay English`);
  // The model once put the referenceKey sentinel here and every ingredient of
  // the plate was priced from one cached row.
  assert.match(prompt, /Never put "other" or a referenceKey value into "searchTermEn"/, `${language}: the prompt must forbid a placeholder search term`);
}

const described = descriptionDetectionPrompt('200 g chicken breast', 'en');
assert.ok(described.includes('200 g chicken breast'), 'the description must reach the model');
assert.match(described, /in English/, 'the description prompt must carry the language too');

// --- The schema must no longer be German-only ------------------------------
const itemSchema = detectionSchema.properties.items.items;
assert.ok(itemSchema.required.includes('name'), 'items must return a language-neutral name');
assert.ok(!JSON.stringify(detectionSchema).includes('nameDe'), 'nameDe must be gone from the schema');

// --- An unknown or absent language must not fail the request ---------------
assert.equal(requestedLanguage({ language: 'de' }), 'de');
assert.equal(requestedLanguage({ language: 'en' }), 'en');
assert.equal(requestedLanguage({}), 'en', 'an older build sends nothing and must still work');
assert.equal(requestedLanguage({ language: 'klingon' }), 'en', 'an unknown language must fall back, not throw');
assert.equal(requestedLanguage(null), 'en');

// --- Both call sites must actually pass it through -------------------------
for (const file of ['supabase/functions/nutrition/index.ts', 'server/index.mjs']) {
  const source = await read(file);
  assert.match(source, /photoDetectionPrompt\((?!\))/, `${file}: the photo prompt must receive a language`);
  assert.match(source, /descriptionDetectionPrompt\(description,/, `${file}: the description prompt must receive a language`);
  assert.ok(source.includes('requestedLanguage'), `${file}: must read the requested language`);
}

// --- The app must send it ---------------------------------------------------
const mealAnalysis = await read('src/services/mealAnalysis.ts');
// Photo and typed description are separate requests; both have to carry it.
const sends = mealAnalysis.match(/language: getLanguage\(\)/g) ?? [];
assert.equal(sends.length, 2, `both the photo and the description request must send the language, found ${sends.length}`);
assert.ok(!mealAnalysis.includes("locale: 'de-DE'"), 'the app must not hardcode a German locale any more');
// The gateway ships one German message per code; the app translates by code.
// Derive the list from the gateway rather than restating it here, so a new
// code cannot be added server-side without a translation on the client.
assert.ok(mealAnalysis.includes('function gatewayMessage'), 'gateway errors must be translated by code');
const gatewaySources = [
  await read('supabase/functions/nutrition/index.ts'),
  await read('supabase/functions/_shared/nutrition.mjs'),
].join('\n');
const emitted = new Set([...gatewaySources.matchAll(/code: '([a-z_]+)'/g)].map((match) => match[1]));
assert.ok(emitted.size >= 10, `expected the gateway to emit many codes, found ${emitted.size}`);
const mapped = new Set([...mealAnalysis.matchAll(/^\s{4}([a-z_]+):/gm)].map((match) => match[1]));
// 'unmatched' is a source marker on an item, translated separately.
const unmapped = [...emitted].filter((code) => code !== 'unmatched' && !mapped.has(code));
assert.deepEqual(unmapped, [], `gateway codes with no translation in the app: ${unmapped.join(', ')}`);

// Warning codes travel the same way.
const warningCodes = [...gatewaySources.matchAll(/warnings\.push\('([a-z_]+)'\)/g)].map((match) => match[1]);
assert.ok(warningCodes.length >= 3, 'the gateway must return warning codes, not sentences');
for (const code of warningCodes) {
  assert.ok(mealAnalysis.includes(`${code}:`), `no translation mapped for warning code ${code}`);
}

// An ingredient with no reference must not be counted into the day.
const shared = await read('supabase/functions/_shared/nutrition.mjs');
const unmatchedBranch = shared.slice(shared.indexOf('export function buildMealItem'), shared.indexOf('const factor ='));
assert.match(unmatchedBranch, /included: false/, 'an unpriced ingredient must not count towards the day');
assert.ok(!/label: 'USDA/.test(shared), 'the gateway must not ship a German source label');

// --- A placeholder search term must never price a food ---------------------
const { isUsableSearchTerm } = await import(new URL('../supabase/functions/_shared/nutrition.mjs', import.meta.url));
for (const bad of ['other', 'unknown', '', '  ', 'n/a', 'food', 'x', 'bls_haehnchen_reis']) {
  assert.equal(isUsableSearchTerm(bad), false, `"${bad}" must not be used as a USDA search term`);
}
for (const good of ['chicken breast grilled', 'white rice', 'broccoli cooked']) {
  assert.equal(isUsableSearchTerm(good), true, `"${good}" is a real search term and must be allowed`);
}
for (const file of ['supabase/functions/nutrition/index.ts', 'server/index.mjs']) {
  assert.ok((await read(file)).includes('isUsableSearchTerm'), `${file}: must reject placeholder search terms`);
}

console.log('Validated the analysis language contract: prompts, schema, both gateways, the app request and the error mapping.');
