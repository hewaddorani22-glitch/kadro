import { isSearchQuery } from '../supabase/functions/_shared/search-policy.mjs';
import { offMassNutrition, offMassPortions } from '../supabase/functions/_shared/off-product.mjs';
import { requestStructured, ModelError } from '../supabase/functions/_shared/model-adapter.mjs';
import { applyDescriptionAmountsTolerant } from '../supabase/functions/_shared/description-amounts.mjs';
import 'dotenv/config';
import { createServer } from 'node:http';

import {
  buildAccuracyWarnings,
  buildMealItem,
  canonicalFoodQuery,
  incompleteNutritionError,
  ingredientCorrectionDraft,
  openFoodFactsNutrition,
  chooseFoodMatch,
  classifyDetection,
  descriptionDetectionPrompt,
  detectionSchema,
  normalizeSearchTerm,
  photoDetectionPrompt,
  isUsableSearchTerm,
  requestedLanguage,
  safeGatewayFailureCode,
  getBlsReferenceByCode,
  searchBlsCatalog,
  searchTermVariants,
  resolveBlsFacts,
  requiresFoodIdentityCorrection,
  toFoodFacts,
  usdaCacheKey,
  validateAnalysisInput,
} from './core.mjs';

const port = Number(process.env.PORT || 8787);
const aiProvider = (process.env.AI_PROVIDER || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai')).toLowerCase();
const isOpenRouter = aiProvider === 'openrouter';
const aiApiKey = isOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
const aiApiUrl = isOpenRouter ? 'https://openrouter.ai/api/v1/responses' : 'https://api.openai.com/v1/responses';
const visionModel = isOpenRouter
  ? process.env.OPENROUTER_VISION_MODEL || 'openai/gpt-4.1-mini'
  : process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
const configuredImageDetail = (process.env.VISION_IMAGE_DETAIL || 'high').toLowerCase();
const imageDetail = ['low', 'high', 'auto'].includes(configuredImageDetail) ? configuredImageDetail : 'high';
const usdaApiKey = process.env.USDA_API_KEY || 'DEMO_KEY';

function json(response, status, body) {
  response.writeHead(status, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8_000_000) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function requestDetection(content) {
  return requestStructured({apiKey: aiApiKey, content, model: visionModel, provider: aiProvider});
}



async function detectFoods({ imageBase64, mimeType, language }) {
  return requestDetection([
    { type: 'input_text', text: photoDetectionPrompt(language) },
    { type: 'input_image', image_url: `data:${mimeType};base64,${imageBase64}`, detail: imageDetail },
  ]);
}

async function detectDescription(description, language) {
  return requestDetection([{
    type: 'input_text',
    text: descriptionDetectionPrompt(description, language),
  }]);
}

// The hosted gateway caches USDA lookups in a shared table. Development has no
// such table, so it keeps the same behaviour in memory for the process
// lifetime — enough to stop a debugging session burning the hourly USDA quota.
const usdaCache = new Map();

async function searchUsdaOnce(query) {
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, pageSize: 25, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] }),
  });
  if (!response.ok) throw new Error(`usda_${response.status}`);
  const result = await response.json();
  const match = chooseFoodMatch((result.foods || []).filter(food => toFoodFacts(food)), query);
  return { facts: toFoodFacts(match.food, match), cacheable: match.cacheable };
}

async function resolveUsdaItem(item, index) {
  const term = canonicalFoodQuery(item.searchTermEn);
  // Same guard as the hosted gateway: a placeholder term must not price food.
  if (!isUsableSearchTerm(term)) return buildMealItem(item, null, index);
  const cacheKey = usdaCacheKey(term);
  let facts = usdaCache.get(cacheKey);
  if (!usdaCache.has(cacheKey)) {
    // Same two-step lookup as the hosted gateway, so development and
    // production cannot disagree about what USDA knows.
    let attempt = await searchUsdaOnce(term);
    for (const variant of searchTermVariants(term)) {
      if (attempt.facts) break;
      attempt = await searchUsdaOnce(variant);
    }
    facts = attempt.facts;
    if (attempt.cacheable || !facts) usdaCache.set(cacheKey, facts);
  }
  return buildMealItem(item, facts ?? null, index);
}

async function resolveItem(item, index) {
  if (requiresFoodIdentityCorrection(item)) return buildMealItem(item, null, index);
  const blsFacts = resolveBlsFacts(item);
  return blsFacts ? buildMealItem(item, blsFacts, index) : resolveUsdaItem(item, index);
}

async function analyzeMeal(input) {
  if (!validateAnalysisInput(input)) {
    return { status: 400, body: { code: 'invalid_input', message: 'Ungültiges Fotoformat.' } };
  }

  const detection = await detectFoods({ ...input, language: requestedLanguage(input) });
  return resolveDetection(detection, 'photo', input.ingredientCorrection);
}

async function resolveDetection(detection, source = 'photo', correctionProtocol) {
  const classificationError = classifyDetection(detection, source);
  if (classificationError) return classificationError;

  const items = await Promise.all(detection.items.map(resolveItem));
  const nutritionError = incompleteNutritionError(items);
  if (nutritionError) return ingredientCorrectionDraft(detection, items, correctionProtocol) ?? nutritionError;
  const warnings = buildAccuracyWarnings(detection, items);
  return { status: 200, body: { title: detection.title, confidence: detection.confidence, items, warnings } };
}

async function analyzeDescription(input) {
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (description.length < 3 || description.length > 500) {
    return { status: 400, body: { code: 'invalid_input', message: 'Beschreibe die Mahlzeit in 3 bis 500 Zeichen.' } };
  }
  return resolveDetection(applyDescriptionAmountsTolerant(await detectDescription(description, requestedLanguage(input)), description), 'text', input.ingredientCorrection);
}

function searchFoods(query, language) {
  const term = normalizeSearchTerm(query);
  if (!isSearchQuery(term)) {
    return { status: 400, body: { code: 'invalid_input', message: 'Query too short.' } };
  }

  const results = [];
  const seen = new Set();
  for (const food of searchBlsCatalog(term, language, 60)) {
    const meal = getBlsReferenceByCode(food.code);
    if (seen.has(food.code)) continue;
    seen.add(food.code);
    results.push({
      id: meal ? `bls-${meal.key}` : `bls-${food.code}`,
      name: language === 'de' ? (meal?.nameDe ?? food.nameDe) : (meal?.nameEn ?? food.nameEn),
      per100g: meal?.per100g ?? food.per100g,
      defaultGrams: meal?.defaultGrams ?? 100,
      portions: meal ? [{ label: language === 'de' ? '1 Portion' : '1 portion', grams: meal.defaultGrams }] : [],
      source: { provider: 'bls', referenceId: food.code, label: `BLS 4.0 ${food.code}` },
    });
    if (results.length >= 60) break;
  }
  return { status: 200, body: { query: term, results: results.slice(0, 60) } };
}

function localizedProductName(product, language) {
  const ordered = language === 'de'
    ? [product?.product_name_de, product?.product_name, product?.product_name_en]
    : [product?.product_name_en, product?.product_name, product?.product_name_de];
  return ordered.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) ?? '';
}

async function lookupBarcode(barcode, language) {
  if (!/^\d{7,14}$/.test(barcode)) return { status: 400, body: { code: 'invalid_barcode', message: 'Ungültiger Barcode.' } };
  const fields = 'code,product_name_de,product_name_en,product_name,nutriments,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,quantity,product_quantity_unit';
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
    headers: { 'User-Agent': 'Kandro/1.0 (https://getkandro.com)' },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return { status: response.status === 404 ? 404 : response.status === 429 ? 429 : 502, body: { code: response.status === 404 ? 'product_not_found' : response.status === 429 ? 'provider_rate_limited' : 'provider_error' } };
  const result = await response.json();
  if (result?.status === 0) return {status:404,body:{code:'product_not_found'}};
  if (!result?.product || typeof result.product !== 'object') throw new ModelError('provider_response_invalid');
  const product = result.product;
  const values = product?.nutriments || {};
  const name = localizedProductName(product, language);
  const servingGrams = Math.round(Number(product?.serving_quantity));
  const per100g = offMassNutrition(product);
  if (!per100g) {
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
      name,
      nameMissing: !name,
      per100g,
      portions: offMassPortions(product),
      source: { provider: 'open-food-facts', referenceId: barcode, label: `Open Food Facts ${barcode}` },
    },
  };
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method === 'GET' && request.url === '/health') {
    return json(response, 200, {
      ok: true,
      aiProvider,
      model: visionModel,
      aiConfigured: Boolean(aiApiKey),
      privacyMode: isOpenRouter ? 'zdr' : 'provider-default',
      usdaMode: process.env.USDA_API_KEY ? 'personal-key' : 'demo-key',
    });
  }

  try {
    const requestUrl = new URL(request.url || '/', 'http://localhost');
    if (request.method === 'POST' && request.url === '/v1/analyze') {
      const result = await analyzeMeal(await readBody(request));
      return json(response, result.status, result.body);
    }
    if (request.method === 'POST' && request.url === '/v1/describe') {
      const result = await analyzeDescription(await readBody(request));
      return json(response, result.status, result.body);
    }
    if (request.method === 'GET' && requestUrl.pathname === '/v1/search') {
      const result = searchFoods(requestUrl.searchParams.get('q') ?? '', requestedLanguage({ language: requestUrl.searchParams.get('language') }));
      return json(response, result.status, result.body);
    }
    const barcodeMatch = request.method === 'GET' && requestUrl.pathname.match(/^\/v1\/barcode\/(\d{7,14})$/);
    if (barcodeMatch) {
      const result = await lookupBarcode(barcodeMatch[1], requestedLanguage({ language: requestUrl.searchParams.get('language') }));
      return json(response, result.status, result.body);
    }
    return json(response, 404, { code: 'not_found', message: 'Route nicht gefunden.' });
  } catch (error) {
    if (error instanceof Error && ['mass_required','amount_ambiguous','amount_out_of_range'].includes(error.message)) return json(response,422,{code:error.message});
    if (error instanceof ModelError) { if (error.retryAfter) response.setHeader('Retry-After',String(error.retryAfter)); return json(response,error.status,{code:error.code}); }
    const safeCode = safeGatewayFailureCode(error);
    const setupError = safeCode === 'ai_key_missing' || safeCode === 'ai_provider_invalid';
    return json(response, setupError ? 503 : 502, {
      code: setupError ? 'server_not_configured' : 'provider_error',
      message: setupError ? 'Der gewählte KI-Provider ist nicht vollständig konfiguriert.' : 'Ein externer Analysedienst ist gerade nicht erreichbar.',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Kandro analysis gateway listening on http://0.0.0.0:${port}`);
});
