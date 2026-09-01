import { withSupabase } from 'npm:@supabase/server@1.5.1';

import {
  buildMealItem,
  chooseFood,
  classifyDetection,
  normalizeSearchTerm,
  toFoodFacts,
  validateAnalysisInput,
} from '../_shared/nutrition.mjs';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const aiProvider = (Deno.env.get('AI_PROVIDER') || (Deno.env.get('OPENROUTER_API_KEY') ? 'openrouter' : 'openai')).toLowerCase();
const isOpenRouter = aiProvider === 'openrouter';
const aiApiKey = isOpenRouter ? Deno.env.get('OPENROUTER_API_KEY') : Deno.env.get('OPENAI_API_KEY');
const aiApiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/responses' : 'https://api.openai.com/v1/responses';
const visionModel = isOpenRouter
  ? Deno.env.get('OPENROUTER_VISION_MODEL') || 'openai/gpt-4.1-mini'
  : Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o';
const openRouterZdr = Deno.env.get('OPENROUTER_ZDR') !== 'false';
const usdaApiKey = Deno.env.get('USDA_API_KEY') || 'DEMO_KEY';
const configuredDailyLimit = Number(Deno.env.get('ANALYSIS_DAILY_LIMIT') || '60');
const dailyLimit = Number.isSafeInteger(configuredDailyLimit) && configuredDailyLimit > 0
  ? configuredDailyLimit
  : 60;

/** Largest base64 payload we accept. The client sends a 1280px JPEG at q0.72. */
const MAX_IMAGE_BASE64 = 3_000_000;

/** USDA values do not change; a miss only needs re-checking now and then. */
const CACHE_TTL_HIT_DAYS = 90;
const CACHE_TTL_MISS_DAYS = 7;

type FoodFacts = {
  fdcId: string | null;
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

const detectionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'clarity', 'dishCount', 'confidence', 'items'],
  properties: {
    title: { type: 'string' },
    clarity: { type: 'string', enum: ['clear', 'unclear'] },
    dishCount: { type: 'integer', minimum: 0, maximum: 8 },
    confidence: { type: 'string', enum: ['high', 'medium'] },
    items: {
      type: 'array',
      minItems: 0,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nameDe', 'searchTermEn', 'estimatedGrams', 'confidence', 'optional'],
        properties: {
          nameDe: { type: 'string' },
          searchTermEn: { type: 'string' },
          estimatedGrams: { type: 'integer', minimum: 5, maximum: 2000 },
          confidence: { type: 'string', enum: ['high', 'medium'] },
          optional: { type: 'boolean' },
        },
      },
    },
  },
};

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
  if (!['openai', 'openrouter'].includes(aiProvider)) throw new Error('ai_provider_invalid');
  if (!aiApiKey) throw new Error('ai_key_missing');

  const response = await fetch(aiApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiApiKey}`,
      'Content-Type': 'application/json',
      ...(isOpenRouter ? { 'X-Title': 'Kandro' } : {}),
    },
    body: JSON.stringify({
      model: visionModel,
      store: false,
      max_output_tokens: 1400,
      ...(isOpenRouter ? {
        provider: {
          data_collection: 'deny',
          require_parameters: true,
          ...(openRouterZdr ? { zdr: true } : {}),
        },
      } : {}),
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

async function searchUsda(term: string): Promise<FoodFacts | null> {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: term, pageSize: 8 }),
  });
  if (!response.ok) throw new Error(`usda_${response.status}`);
  const result = await response.json();
  return toFoodFacts(chooseFood(result.foods || [], term));
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
    if (memoryCache.has(term)) resolved.set(term, memoryCache.get(term) ?? null);
    else if (!resolved.has(term)) unknown.push(term);
  }

  if (unknown.length) {
    const { data } = await admin
      .from('usda_food_cache')
      .select('search_term, fdc_id, calories, protein, carbs, fat, fiber, fetched_at')
      .in('search_term', unknown);

    for (const row of data ?? []) {
      const ageDays = (Date.now() - new Date(row.fetched_at).getTime()) / 86_400_000;
      const ttl = row.fdc_id ? CACHE_TTL_HIT_DAYS : CACHE_TTL_MISS_DAYS;
      if (ageDays > ttl) continue;
      const facts: FoodFacts | null = row.fdc_id
        ? {
          fdcId: row.fdc_id,
          calories: Number(row.calories),
          protein: Number(row.protein),
          carbs: Number(row.carbs),
          fat: Number(row.fat),
          fiber: Number(row.fiber),
        }
        : null;
      resolved.set(row.search_term, facts);
      rememberInMemory(row.search_term, facts);
    }
  }

  const missing = [...new Set(unknown.filter((term) => !resolved.has(term)))];
  const fetched = await Promise.all(missing.map(async (term) => ({ term, facts: await searchUsda(term) })));

  for (const { term, facts } of fetched) {
    resolved.set(term, facts);
    rememberInMemory(term, facts);
  }

  if (fetched.length) {
    // Writing the cache must never fail a scan the user already paid for.
    await admin.from('usda_food_cache').upsert(
      fetched.map(({ term, facts }) => ({
        search_term: term,
        fdc_id: facts?.fdcId ?? null,
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
  const terms = detection.items.map((item: any) => normalizeSearchTerm(item.searchTermEn));
  const facts = await resolveFacts(terms, admin);
  // deno-lint-ignore no-explicit-any
  const items = detection.items.map((item: any, index: number) =>
    buildMealItem(item, facts.get(normalizeSearchTerm(item.searchTermEn)) ?? null, index));
  // deno-lint-ignore no-explicit-any
  const warnings = items.some((item: any) => item.calories === 0)
    ? ['Mindestens eine Zutat konnte in USDA nicht eindeutig zugeordnet werden und muss geprüft werden.']
    : [];
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
    {
      type: 'input_text',
      text: 'Analysiere genau eine sichtbare Mahlzeit. Erkenne nur sichtbare Lebensmittel, schätze Gramm-Portionen, markiere unsichere Saucen als optional und gib deutsche Namen plus kurze englische USDA-Suchbegriffe aus. Gib keine Kalorien oder Makros aus. Bei Unschärfe clarity=unclear; bei mehreren getrennten Tellern dishCount>1.',
    },
    { type: 'input_image', image_url: `data:${input.mimeType};base64,${input.imageBase64}`, detail: 'low' },
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
    text: `Strukturiere genau die beschriebene Mahlzeit in Zutaten und realistische Gramm-Portionen. Erfinde keine nicht genannten Lebensmittel. Markiere unklare Mengen oder Saucen als optional bzw. medium confidence. Gib deutsche Namen und kurze englische USDA-Suchbegriffe aus, aber keine Kalorien oder Makros. Beschreibung: ${description}`,
  }]), admin, 'text');
}

async function lookupBarcode(barcode: string): Promise<Result> {
  if (!/^\d{7,14}$/.test(barcode)) {
    return { status: 400, body: { code: 'invalid_barcode', message: 'Ungültiger Barcode.' } };
  }
  const fields = 'code,product_name_de,product_name,nutriments';
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
    headers: { 'User-Agent': 'Kandro/1.0' },
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
  return {
    status: 200,
    body: {
      barcode,
      name: product?.product_name_de || product?.product_name || 'Verpacktes Lebensmittel',
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

  const route = routeOf(request);

  // Barcode lookups are free for us, so they stay outside the paid quota.
  if (request.method === 'GET') {
    const match = route.match(/^\/v1\/barcode\/(\d{7,14})$/);
    if (match) return reply(await lookupBarcode(match[1]));
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
