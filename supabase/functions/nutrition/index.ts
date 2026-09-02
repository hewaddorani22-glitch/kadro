import { withSupabase } from 'npm:@supabase/server@1.5.1';

import {
  buildAccuracyWarnings,
  buildMealItem,
  chooseFoodMatch,
  classifyDetection,
  normalizeSearchTerm,
  toFoodFacts,
  usdaCacheKey,
  isUsableSearchTerm,
  rankFoodMatches,
  requestedLanguage,
  searchTermVariants,
  validateAnalysisInput,
} from '../_shared/nutrition.mjs';
import { resolveBlsFacts, searchBlsReferences } from '../_shared/bls-reference.mjs';
import {
  descriptionDetectionPrompt,
  detectionSchema,
  photoDetectionPrompt,
} from '../_shared/detection.mjs';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

// Production has one disclosed AI path. Keeping a second provider selectable
// by secret would let configuration drift invalidate the user's consent.
const aiProvider = 'openrouter';
const aiApiKey = Deno.env.get('OPENROUTER_API_KEY');
const aiApiUrl = 'https://openrouter.ai/api/v1/responses';
const visionModel = Deno.env.get('OPENROUTER_VISION_MODEL') || 'openai/gpt-4.1-mini';
const configuredImageDetail = (Deno.env.get('VISION_IMAGE_DETAIL') || 'high').toLowerCase();
const imageDetail = ['low', 'high', 'auto'].includes(configuredImageDetail) ? configuredImageDetail : 'high';
const usdaApiKey = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY';
const configuredDailyLimit = Number(Deno.env.get('ANALYSIS_DAILY_LIMIT') || '60');
const dailyLimit = Number.isSafeInteger(configuredDailyLimit) && configuredDailyLimit > 0
  ? configuredDailyLimit
  : 60;
const REQUIRED_PRIVACY_VERSION = '2026-09-02-ai-v1';

/** Largest base64 payload we accept. The client sends a 1600px JPEG at q0.82. */
const MAX_IMAGE_BASE64 = 3_000_000;

/** USDA values do not change; a miss only needs re-checking now and then. */
const CACHE_TTL_HIT_DAYS = 90;
const CACHE_TTL_MISS_DAYS = 7;

type FoodFacts = {
  provider: 'usda';
  referenceId: string;
  label: string;
  matchConfidence: 'high' | 'medium';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

/**
 * Per-instance cache in front of the shared table. A warm function handling a
 * burst of scans skips the database entirely for repeat ingredients.
 */
const memoryCache = new Map<string, FoodFacts | null>();
const MEMORY_CACHE_LIMIT = 500;

function rememberInMemory(term: string, facts: FoodFacts | null) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(term, facts);
}

type Result = { status: number; body: Record<string, unknown> };

function reply(result: Result) {
  return Response.json(result.body, { status: result.status, headers: corsHeaders });
}

// deno-lint-ignore no-explicit-any
function extractResponseText(response: any): string {
  if (typeof response.output_text === 'string') return response.output_text;
  for (const output of response.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  throw new Error('missing_structured_output');
}

// deno-lint-ignore no-explicit-any
async function requestDetection(content: unknown[]): Promise<any> {
  if (!aiApiKey) throw new Error('ai_key_missing');

  const response = await fetch(aiApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiApiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Kandro',
    },
    body: JSON.stringify({
      model: visionModel,
      store: false,
      max_output_tokens: 2000,
      provider: {
        data_collection: 'deny',
        only: ['azure'],
        allow_fallbacks: false,
        zdr: true,
      },
      input: [{ role: 'user', content }],
      text: {
        format: { type: 'json_schema', name: 'kandro_meal_detection', strict: true, schema: detectionSchema },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${aiProvider}_${response.status}:${detail.slice(0, 300)}`);
  }
  return JSON.parse(extractResponseText(await response.json()));
}

async function searchUsdaOnce(term: string): Promise<{ facts: FoodFacts | null; cacheable: boolean }> {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: term, pageSize: 15 }),
  });
  if (!response.ok) throw new Error(`usda_${response.status}`);
  const result = await response.json();
  const match = chooseFoodMatch(result.foods || [], term);
  return { facts: toFoodFacts(match.food, match), cacheable: match.cacheable };
}

/**
 * Tries the model's own term first, then a rewrite. Rejecting a bad match is
 * right, but leaving the ingredient unpriced when a good row exists under
 * USDA's own wording is not.
 */
async function searchUsda(term: string): Promise<{ facts: FoodFacts | null; cacheable: boolean }> {
  const first = await searchUsdaOnce(term);
  if (first.facts) return first;
  for (const variant of searchTermVariants(term)) {
    const retry = await searchUsdaOnce(variant);
    if (retry.facts) return retry;
  }
  return first;
}

/**
 * Resolves every ingredient of one scan to nutrient facts, asking USDA only for
 * terms that are neither in this instance's memory nor in the shared table.
 */
// deno-lint-ignore no-explicit-any
async function resolveFacts(terms: string[], admin: any): Promise<Map<string, FoodFacts | null>> {
  const resolved = new Map<string, FoodFacts | null>();
  const unknown: string[] = [];

  for (const term of terms) {
    const cacheKey = usdaCacheKey(term);
    if (memoryCache.has(cacheKey)) resolved.set(term, memoryCache.get(cacheKey) ?? null);
    else if (!resolved.has(term)) unknown.push(term);
  }

  if (unknown.length) {
    const termsByCacheKey = new Map(unknown.map((term) => [usdaCacheKey(term), term]));
    const { data } = await admin
      .from('usda_food_cache')
      .select('search_term, fdc_id, calories, protein, carbs, fat, fiber, fetched_at')
      .in('search_term', [...termsByCacheKey.keys()]);

    for (const row of data ?? []) {
      const ageDays = (Date.now() - new Date(row.fetched_at).getTime()) / 86_400_000;
      const ttl = row.fdc_id ? CACHE_TTL_HIT_DAYS : CACHE_TTL_MISS_DAYS;
      if (ageDays > ttl) continue;
      const term = termsByCacheKey.get(row.search_term);
      if (!term) continue;
      const facts: FoodFacts | null = row.fdc_id
        ? {
          provider: 'usda',
          referenceId: row.fdc_id,
          label: `USDA FDC ${row.fdc_id}`,
          matchConfidence: 'high',
          calories: Number(row.calories),
          protein: Number(row.protein),
          carbs: Number(row.carbs),
          fat: Number(row.fat),
          fiber: Number(row.fiber),
        }
        : null;
      resolved.set(term, facts);
      rememberInMemory(row.search_term, facts);
    }
  }

  const missing = [...new Set(unknown.filter((term) => !resolved.has(term)))];
  const fetched = await Promise.all(missing.map(async (term) => ({ term, ...await searchUsda(term) })));

  for (const { term, facts, cacheable } of fetched) {
    resolved.set(term, facts);
    if (cacheable) rememberInMemory(usdaCacheKey(term), facts);
  }

  const safeToCache = fetched.filter(({ cacheable }) => cacheable);
  if (safeToCache.length) {
    // Writing the cache must never fail a scan the user already paid for.
    await admin.from('usda_food_cache').upsert(
      safeToCache.map(({ term, facts }) => ({
        search_term: usdaCacheKey(term),
        fdc_id: facts?.referenceId ?? null,
        calories: facts?.calories ?? 0,
        protein: facts?.protein ?? 0,
        carbs: facts?.carbs ?? 0,
        fat: facts?.fat ?? 0,
        fiber: facts?.fiber ?? 0,
        fetched_at: new Date().toISOString(),
      })),
      { onConflict: 'search_term' },
    ).then(() => undefined, () => undefined);
  }

  return resolved;
}

// deno-lint-ignore no-explicit-any
async function resolveDetection(detection: any, admin: any, source: 'photo' | 'text' = 'photo'): Promise<Result> {
  const classificationError = classifyDetection(detection, source);
  if (classificationError) return classificationError;

  // deno-lint-ignore no-explicit-any
  const terms = detection.items
    .filter((item: any) => !resolveBlsFacts(item))
    .map((item: any) => normalizeSearchTerm(item.searchTermEn))
    // A term that names no food would be looked up, cached, and then reused for
    // every other ingredient that produced the same placeholder.
    .filter(isUsableSearchTerm);
  const facts = await resolveFacts(terms, admin);
  // deno-lint-ignore no-explicit-any
  const items = detection.items.map((item: any, index: number) => {
    const blsFacts = resolveBlsFacts(item);
    const term = normalizeSearchTerm(item.searchTermEn);
    const usdaFacts = isUsableSearchTerm(term) ? facts.get(term) ?? null : null;
    return buildMealItem(item, blsFacts ?? usdaFacts, index);
  });
  const warnings = buildAccuracyWarnings(detection, items);
  return { status: 200, body: { title: detection.title, confidence: detection.confidence, items, warnings } };
}

// deno-lint-ignore no-explicit-any
async function analyzePhoto(input: any, admin: any): Promise<Result> {
  if (!validateAnalysisInput(input)) {
    return { status: 400, body: { code: 'invalid_input', message: 'Ungültiges Fotoformat.' } };
  }
  if (typeof input.imageBase64 !== 'string' || input.imageBase64.length > MAX_IMAGE_BASE64) {
    return { status: 413, body: { code: 'invalid_input', message: 'Das Foto ist zu groß.' } };
  }
  return resolveDetection(await requestDetection([
    { type: 'input_text', text: photoDetectionPrompt(requestedLanguage(input)) },
    { type: 'input_image', image_url: `data:${input.mimeType};base64,${input.imageBase64}`, detail: imageDetail },
  ]), admin);
}

// deno-lint-ignore no-explicit-any
async function analyzeDescription(input: any, admin: any): Promise<Result> {
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (description.length < 3 || description.length > 500) {
    return { status: 400, body: { code: 'invalid_input', message: 'Beschreibe die Mahlzeit in 3 bis 500 Zeichen.' } };
  }
  return resolveDetection(await requestDetection([{
    type: 'input_text',
    text: descriptionDetectionPrompt(description, requestedLanguage(input)),
  }]), admin, 'text');
}

/**
 * Free-text food search. No model call, so it costs nothing and stays outside
 * the paid quota — which is the point: logging a banana should not spend one
 * of three free analyses, and should not take five seconds.
 *
 * Two sources. The German dish references come first because their values are
 * vetted rather than matched; USDA supplies everything else, in English.
 */
async function searchFoods(query: string, language: string): Promise<Result> {
  const term = normalizeSearchTerm(query);
  if (!isUsableSearchTerm(term)) {
    return { status: 400, body: { code: 'invalid_input', message: 'Query too short.' } };
  }

  const results: unknown[] = [];

  // Only German readers are offered the German dish names, because that is the
  // only language those entries exist in.
  if (language === 'de') {
    for (const meal of searchBlsReferences(term, 4)) {
      results.push({
        id: `bls-${meal.key}`,
        name: meal.nameDe,
        per100g: meal.per100g,
        defaultGrams: meal.defaultGrams,
        source: { provider: 'bls', referenceId: meal.code, label: `BLS 4.0 ${meal.code}` },
      });
    }
  }

  let foods: unknown[] = [];
  try {
    foods = await searchUsdaFoods(term);
  } catch {
    // A USDA outage must not empty a list that already has German dishes in it.
    if (!results.length) {
      return { status: 503, body: { code: 'provider_error', message: 'Search is unavailable.' } };
    }
  }

  for (const food of foods) {
    // deno-lint-ignore no-explicit-any
    const entry = food as any;
    const facts = toFoodFacts(entry, { confidence: 'medium' });
    if (!facts) continue;
    results.push({
      id: `usda-${entry.fdcId}`,
      name: String(entry.description ?? '').trim(),
      per100g: {
        calories: Math.round(Number(facts.calories) || 0),
        protein: Math.round(Number(facts.protein) || 0),
        carbs: Math.round(Number(facts.carbs) || 0),
        fat: Math.round(Number(facts.fat) || 0),
        fiber: Math.round(Number(facts.fiber) || 0),
      },
      defaultGrams: 100,
      source: { provider: 'usda', referenceId: String(entry.fdcId), label: `USDA FDC ${entry.fdcId}` },
    });
  }

  return { status: 200, body: { query: term, results: results.slice(0, 15) } };
}

async function usdaRows(query: string): Promise<unknown[]> {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, pageSize: 25 }),
  });
  if (!response.ok) throw new Error(`usda_${response.status}`);
  const result = await response.json();
  return result.foods || [];
}

/**
 * Raw USDA rows for the search list.
 *
 * A bare food word needs a second probe: USDA's own relevance for "rice"
 * returns crackers, cakes and paper, and plain cooked rice is not in the first
 * twenty-five results at all. Asking again for "rice cooked" finds it. The
 * merged rows are then ranked against what the user actually typed.
 */
async function searchUsdaFoods(term: string): Promise<unknown[]> {
  const probes = [term, ...searchTermVariants(term)];
  const hasPreparation = /\b(?:raw|cooked|boiled|grilled|fried|baked|roasted|steamed)\b/.test(term);
  if (!hasPreparation) probes.push(`${term} cooked`);

  const rows: unknown[] = [];
  const seen = new Set<string>();
  for (const probe of probes) {
    for (const row of await usdaRows(probe)) {
      // deno-lint-ignore no-explicit-any
      const id = String((row as any)?.fdcId ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
    // Two probes are enough; each one is a round trip the user is waiting on.
    if (probes.indexOf(probe) >= 1) break;
  }
  return rankFoodMatches(rows, term, 12);
}

/** Picks the product name in the reader's language, falling back sensibly. */
// deno-lint-ignore no-explicit-any
function localizedProductName(product: any, language: string): string {
  const ordered = language === 'de'
    ? [product?.product_name_de, product?.product_name, product?.product_name_en]
    : [product?.product_name_en, product?.product_name, product?.product_name_de];
  return ordered.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) ?? '';
}

async function lookupBarcode(barcode: string, language: string): Promise<Result> {
  if (!/^\d{7,14}$/.test(barcode)) {
    return { status: 400, body: { code: 'invalid_barcode', message: 'Ungültiger Barcode.' } };
  }
  const fields = 'code,product_name_de,product_name_en,product_name,nutriments';
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
    // Open Food Facts asks callers to identify themselves and throttles the
    // ones that do not. A generic agent is how you get rate limited at scale.
    headers: { 'User-Agent': 'Kandro/1.0 (https://getkandro.com; hewaddorani22@gmail.com)' },
  });
  if (!response.ok) {
    return {
      status: response.status === 404 ? 404 : 502,
      body: { code: 'product_not_found', message: 'Produkt nicht gefunden.' },
    };
  }
  const result = await response.json();
  const product = result.product;
  const values = product?.nutriments || {};
  // A zero-calorie product is not a product without data. Diet drinks,
  // sparkling water and sugar-free gum are among the most scanned items, and
  // rejecting them as "missing nutrition" was simply wrong. Presence of the
  // key decides, not its value.
  const NUTRIMENT_KEYS = ['energy-kcal_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g'];
  const hasNutrition = NUTRIMENT_KEYS.some((key) => {
    const value = values[key];
    return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));
  });
  if (!hasNutrition) {
    return {
      status: 422,
      body: {
        code: 'missing_nutrition',
        message: 'Für dieses Produkt sind keine Nährwerte hinterlegt. Beschreibe die Mahlzeit kurz, dann rechnen wir sie aus.',
      },
    };
  }
  return {
    status: 200,
    body: {
      barcode,
      // The product name follows the reader, not the database's field order.
      // Preferring product_name_de unconditionally showed German names to
      // English users whenever Open Food Facts happened to carry one.
      name: localizedProductName(product, language),
      // Empty rather than a sentence: the app fills in the fallback wording
      // from its own dictionary, so it is never German for an English reader.
      nameMissing: !localizedProductName(product, language),
      per100g: {
        calories: Math.round(Number(values['energy-kcal_100g'] || 0)),
        protein: Math.round(Number(values.proteins_100g || 0)),
        carbs: Math.round(Number(values.carbohydrates_100g || 0)),
        fat: Math.round(Number(values.fat_100g || 0)),
        fiber: Math.round(Number(values.fiber_100g || 0)),
      },
      source: { provider: 'open-food-facts', referenceId: barcode, label: `Open Food Facts ${barcode}` },
    },
  };
}

/** Strips the /functions/v1/nutrition prefix so routes read the same as locally. */
function routeOf(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/functions\/v1/, '');
  return path.replace(/^\/nutrition/, '').replace(/\/+$/, '') || '/';
}

const handler = withSupabase({ auth: 'user' }, async (request: Request, context) => {
  const { data, error: userError } = await context.supabase.auth.getUser();
  if (userError || !data.user) {
    return Response.json({ code: 'unauthorized', message: 'Bitte öffne Kandro erneut.' }, { status: 401, headers: corsHeaders });
  }

  // Navigation is not a security boundary: check the current, versioned
  // consent before any request can reach AI or a nutrition provider.
  const { data: consent, error: consentError } = await context.supabase
    .from('profiles')
    .select('privacy_version, wellness_consent_at')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (consentError) {
    return reply({ status: 503, body: { code: 'provider_error', message: 'Die Einwilligung konnte nicht geprüft werden.' } });
  }
  if (consent?.privacy_version !== REQUIRED_PRIVACY_VERSION || !consent.wellness_consent_at) {
    return reply({ status: 403, body: { code: 'consent_required', message: 'Bitte bestätige zuerst die aktuelle Datenschutzeinwilligung.' } });
  }

  const route = routeOf(request);

  // Barcode lookups are free for us, so they stay outside the paid quota.
  if (request.method === 'GET') {
    const match = route.match(/^\/v1\/barcode\/(\d{7,14})$/);
    // A GET carries no body, so the language rides along in the query string.
    if (match) {
      const requested = new URL(request.url).searchParams.get('language');
      return reply(await lookupBarcode(match[1], requestedLanguage({ language: requested })));
    }
    if (route === '/v1/search') {
      const params = new URL(request.url).searchParams;
      return reply(await searchFoods(params.get('q') ?? '', requestedLanguage({ language: params.get('language') })));
    }
    return reply({ status: 404, body: { code: 'not_found', message: 'Route nicht gefunden.' } });
  }

  if (request.method !== 'POST') {
    return reply({ status: 405, body: { code: 'method_not_allowed', message: 'Methode nicht erlaubt.' } });
  }
  if (route !== '/v1/analyze' && route !== '/v1/describe') {
    return reply({ status: 404, body: { code: 'not_found', message: 'Route nicht gefunden.' } });
  }

  const payload = await request.json().catch(() => null);
  if (route === '/v1/analyze') {
    if (!validateAnalysisInput(payload)) {
      return reply({ status: 400, body: { code: 'invalid_input', message: 'Ungültiges Fotoformat.' } });
    }
    if (typeof payload.imageBase64 !== 'string' || payload.imageBase64.length > MAX_IMAGE_BASE64) {
      return reply({ status: 413, body: { code: 'invalid_input', message: 'Das Foto ist zu groß.' } });
    }
  } else {
    const description = typeof payload?.description === 'string' ? payload.description.trim() : '';
    if (description.length < 3 || description.length > 500) {
      return reply({ status: 400, body: { code: 'invalid_input', message: 'Beschreibe die Mahlzeit in 3 bis 500 Zeichen.' } });
    }
  }

  const { data: used, error: quotaError } = await context.supabase.rpc('consume_analysis_quota');
  if (quotaError) {
    return reply({ status: 503, body: { code: 'provider_error', message: 'Die Analyse ist gerade nicht erreichbar.' } });
  }
  if (typeof used === 'number' && used > dailyLimit) {
    return reply({
      status: 429,
      body: { code: 'daily_limit_reached', message: 'Du hast heute sehr viele Mahlzeiten erfasst. Morgen geht es normal weiter.' },
    });
  }

  const result = route === '/v1/analyze'
    ? await analyzePhoto(payload, context.supabaseAdmin)
    : await analyzeDescription(payload, context.supabaseAdmin);
  return reply(result);
});

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return handler(request).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const setupError = message === 'ai_key_missing' || message === 'ai_provider_invalid';
      // Never echo the provider's raw error back to the device.
      console.error('nutrition gateway failure', message.slice(0, 300));
      return reply({
        status: setupError ? 503 : 502,
        body: {
          code: setupError ? 'server_not_configured' : 'provider_error',
          message: setupError
            ? 'Die Analyse ist noch nicht vollständig eingerichtet.'
            : 'Ein externer Analysedienst ist gerade nicht erreichbar.',
        },
      });
    });
  },
};
