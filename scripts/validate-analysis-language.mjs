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
const { requestedLanguage } = await import(new URL('../supabase/functions/_shared/nutrition.mjs', import.meta.url));

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
  assert.match(prompt, /"searchTermEn" in English/, `${language}: the USDA term must stay English`);
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
assert.ok(mealAnalysis.includes('function gatewayMessage'), 'gateway errors must be translated by code');
for (const code of ['invalid_input', 'product_not_found', 'missing_nutrition', 'daily_limit_reached']) {
  assert.ok(mealAnalysis.includes(`${code}:`), `no translation mapped for gateway code ${code}`);
}

console.log('Validated the analysis language contract: prompts, schema, both gateways, the app request and the error mapping.');
