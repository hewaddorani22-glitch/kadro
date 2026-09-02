/**
 * Barcode lookups are the one path where a user in another country meets our
 * assumptions head on.
 *
 * The gateway preferred product_name_de unconditionally, so an English reader
 * got German names wherever Open Food Facts happened to carry one; an unnamed
 * product arrived as the German "Verpacktes Lebensmittel"; and the User-Agent
 * did not identify us, which is how Open Food Facts decides whom to throttle.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(resolve(projectRoot, relative), 'utf8');

const gateway = await read('supabase/functions/nutrition/index.ts');
const app = await read('src/services/mealAnalysis.ts');

// --- The product name must follow the reader -------------------------------
assert.ok(gateway.includes('localizedProductName'), 'the product name must be chosen per language');
assert.ok(
  !/product_name_de \|\| product\?\.product_name/.test(gateway),
  'the German product name must not win unconditionally',
);
assert.match(gateway, /product_name_en/, 'the English product name must be requested from the API');

// Read the two preference lists out of the ternary rather than slicing on
// punctuation, which caught a type annotation instead of the branch.
const lists = [...gateway.matchAll(/\[(product\?\.product_name[^\]]+)\]/g)].map((match) =>
  match[1].split(',').map((entry) => entry.trim()));
assert.equal(lists.length, 2, `expected a German and an English preference list, found ${lists.length}`);
const [germanOrder, englishOrder] = lists;
assert.equal(germanOrder[0], 'product?.product_name_de', 'German readers must get the German name first');
assert.equal(englishOrder[0], 'product?.product_name_en', 'English readers must get the English name first');
assert.ok(
  englishOrder.indexOf('product?.product_name_en') < englishOrder.indexOf('product?.product_name_de'),
  'English readers must never be handed the German name before the English one',
);
for (const order of lists) {
  assert.ok(order.includes('product?.product_name'), 'the generic name must remain as a fallback');
}

// --- No German fallback wording may ship from the gateway ------------------
assert.ok(
  !gateway.includes("'Verpacktes Lebensmittel'"),
  'the unnamed-product fallback must come from the app dictionary, not the gateway',
);
assert.ok(gateway.includes('nameMissing'), 'the gateway must flag a missing name instead of inventing one');
assert.ok(app.includes('errors.packagedFood'), 'the app must supply the fallback name');

// --- Open Food Facts asks callers to identify themselves -------------------
const agent = gateway.match(/'User-Agent': '([^']+)'/)?.[1];
assert.ok(agent, 'the barcode lookup must send a User-Agent');
assert.match(agent, /Kandro/, 'the User-Agent must name the app');
assert.match(agent, /@|https?:\/\//, 'the User-Agent must carry a contact, or Open Food Facts throttles us');

// --- The language has to reach a GET ---------------------------------------
assert.match(gateway, /searchParams\.get\('language'\)/, 'the barcode route must read the requested language');
assert.match(app, /barcode\/\$\{encodeURIComponent\(barcode\)\}\?language=/, 'the app must send its language with the barcode');

// --- A barcode the database does not know needs a way out ------------------
const contracts = await read('src/services/contracts.ts');
assert.match(contracts, /'product-not-found'/, 'an unknown product needs its own error kind');
assert.ok(
  app.includes("payload?.code === 'product_not_found'") && app.includes("'missing_nutrition'"),
  'both an unknown product and one without values must map to that kind',
);
const analyzing = await read('src/app/analyzing.tsx');
assert.ok(analyzing.includes('describeInstead'), 'the failure screen must offer to describe the product');
assert.ok(
  analyzing.includes("'/(tabs)/scan?mode=description'"),
  'that action must land on the description input, not just the scan tab',
);
const scan = await read('src/app/(tabs)/scan.tsx');
assert.ok(scan.includes('useLocalSearchParams'), 'the scan screen must honour the requested mode');
assert.match(scan, /useState\(requestedMode === 'description'\)/, 'the description sheet must already be open on arrival');
// Retrying a barcode the database has never heard of cannot help.
const actions = analyzing.slice(analyzing.indexOf("analysisError === 'product-not-found'"));
assert.ok(
  !actions.slice(0, actions.indexOf(') : (')).includes('t.analyzing.retry'),
  'an unknown product must not offer a pointless retry',
);

console.log('Validated the barcode path: localized names, no German fallback, an identifying User-Agent, and a way out of an unknown product.');
