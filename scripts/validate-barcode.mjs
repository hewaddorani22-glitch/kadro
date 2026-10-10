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

// The explicit localized field wins. The generic field is only trusted when
// Open Food Facts says it is already in the requested language; otherwise the
// last fallback may cross languages but never outrank the requested field.
assert.match(gateway, /language === 'de' \? product\?\.product_name_de : product\?\.product_name_en/,
  'the requested localized product name must be checked first');
assert.match(gateway, /catalogueLanguage === language/,
  'a generic product name must be checked against its catalogue language');
assert.match(gateway, /language === 'de'\s*\n\s*\? \[product\?\.product_name_en\]\s*\n\s*: \[product\?\.product_name_de\]/,
  'a foreign localized name may only be the final fallback');

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
  app.includes("product_not_found:'product-not-found'") && app.includes("missing_nutrition:'product-not-found'"),
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

// A barcode camera has to remain usable in a dim kitchen and on products that
// the camera cannot settle on. The second path is also an accessibility and
// device-compatibility fallback, not merely decoration.
assert.match(scan, /enableTorch=\{\(mode === 'barcode' \|\| mode === 'photo'\) && torchOn\}/, 'barcode and photo modes need a real torch control');
assert.match(scan, /barcodeTypes: \[[^\]]*'itf14'[^\]]*'code128'/, 'the scanner must cover common numeric retail formats');
assert.ok(scan.includes('barcodeManualTitle') && scan.includes('submitBarcodeEntry'), 'a barcode must be enterable by hand');
assert.match(scan, /\^\\d\{7,14\}\$/, 'manual barcode input must reject incomplete codes');
// Retrying a barcode the database has never heard of cannot help.
const actions = analyzing.slice(analyzing.indexOf("analysisError === 'product-not-found'"));
assert.ok(
  !actions.slice(0, actions.indexOf(') : (')).includes('t.analyzing.retry'),
  'an unknown product must not offer a pointless retry',
);

// --- Coverage: fallbacks, German fields and a shared cache ------------------
const { offBarcodeCandidates, offBrand, offPackageGrams, OFF_PRODUCT_FIELDS } = await import('../supabase/functions/_shared/off-product.mjs');
// A UPC-A code is stored by Open Food Facts as EAN-13 with a leading zero, and vice versa.
assert.deepEqual(offBarcodeCandidates('012345678905'), ['012345678905', '0012345678905']);
assert.deepEqual(offBarcodeCandidates('0012345678905'), ['0012345678905', '012345678905']);
assert.deepEqual(offBarcodeCandidates('40084107'), ['40084107']);
assert.deepEqual(offBarcodeCandidates('12'), []);
assert.equal(offBrand({ brands: 'Ehrmann, Almighurt' }), 'Ehrmann');
assert.equal(offBrand({ brands: ['REWE Bio'] }), 'REWE Bio');
assert.equal(offPackageGrams({ product_quantity: 250, product_quantity_unit: 'g' }), 250);
assert.equal(offPackageGrams({ product_quantity: 500, product_quantity_unit: 'ml' }), null, 'a volume is never a weight');
for (const field of ['product_name_de', 'generic_name_de', 'brands', 'nutriments', 'serving_quantity', 'product_quantity']) {
  assert.ok(OFF_PRODUCT_FIELDS.split(',').includes(field), `Open Food Facts must be asked for ${field}`);
}
const lookup = gateway.slice(gateway.indexOf('async function fetchOffProduct'), gateway.indexOf('/** An Open Food Facts serving size'));
assert.match(lookup, /for \(const version of \['v2', 'v0'\]\)/, 'the v2 product API must fall back to v0 when it fails');
assert.match(lookup, /world\.openfoodfacts\.org\/api\/\$\{version\}\/product\/\$\{code\}\.json/);
assert.match(lookup, /if \(response\.status === 429\)/, 'a rate limit is respected, not retried against v0');
assert.match(lookup, /for \(const code of offBarcodeCandidates\(barcode\)\)/, 'UPC/EAN spellings must be tried');
assert.match(gateway, /const OFF_CACHE_HIT_DAYS = 30;\nconst OFF_CACHE_MISS_DAYS = 3;/, 'found products are cached 30 days, unknown barcodes 3');
assert.match(lookup, /from\('off_product_cache'\)[\s\S]*ageDays > \(product \? OFF_CACHE_HIT_DAYS : OFF_CACHE_MISS_DAYS\)/);
assert.match(lookup, /await writeOffCache\(admin, barcode, null\);\s*return \{ status: 404/, 'an unknown barcode is remembered as such');
assert.match(lookup, /language === 'de' && typeof product\?\.generic_name_de === 'string'/, 'German readers get the German generic name when no product name exists');
// "Produkt nicht gefunden" → photograph the nutrition label.
assert.match(analyzing, /analysisError === 'product-not-found' && scanMode === 'barcode'[\s\S]*t\.analyzing\.labelScanInstead/);
assert.match(app, /const own = await findCustomFoodByBarcode\(barcode\);/, 'an own product linked to the barcode answers first');
for (const file of ['src/i18n/de.ts', 'src/i18n/en.ts']) assert.match(await read(file), /labelScanInstead: '/);

console.log('Validated the barcode path: localized names, no German fallback, an identifying User-Agent, v2→v0 and UPC/EAN fallbacks, a 30/3-day shared cache, own products first, and the label scan as the way out of an unknown product.');
