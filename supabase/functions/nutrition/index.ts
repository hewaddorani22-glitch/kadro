import { runSearchAssistance } from '../_shared/search-assistance.mjs';
import { referenceCache } from '../_shared/reference-cache.mjs';
import { isSearchQuery, compatibleSearchIdentity, SEARCH_VERSION } from '../_shared/search-policy.mjs';
import { offMassNutrition, offMassPortions } from '../_shared/off-product.mjs';
import { requestStructured, ModelError, GEMINI_MODEL, GEMINI_CONSENT_VERSION, GEMINI_RELEASE_APPROVED } from '../_shared/model-adapter.mjs';
import { applyDescriptionAmountsTolerant } from '../_shared/description-amounts.mjs';
import { withSupabase } from 'npm:@supabase/server@1.5.1';
import { canonicalFoodQuery } from '../_shared/food-query.mjs';

import {
  buildAccuracyWarnings,
  aiEstimateFacts,
  buildMealItem,
  incompleteNutritionError,
  ingredientCorrectionDraft,
  openFoodFactsNutrition,
  chooseFoodMatch,
  classifyDetection,
  normalizeSearchTerm,
  toFoodFacts,
  usdaCacheKey,
  isUsableSearchTerm,
  rankFoodMatches,
  requestedLanguage,
  safeGatewayFailureCode,
  searchTermVariants,
  usdaPortions,
  validateAnalysisInput,
} from '../_shared/nutrition.mjs';
import { translateGermanQuery } from '../_shared/german-food-terms.mjs';
import { getBlsReferenceByCode, requiresFoodIdentityCorrection, resolveBlsFacts } from '../_shared/bls-reference.mjs';
import { searchBlsCatalog } from '../_shared/bls-search.mjs';
import {
  descriptionDetectionPrompt,
  detectionSchema,
  photoDetectionPrompt,
} from '../_shared/detection.mjs';
import {
  fetchRevenueCatEntitlement,
  isAnalysisRequestId,
} from '../_shared/revenuecat.mjs';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Retry-After',
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
const nutritionRateLimitSalt = Deno.env.get('NUTRITION_RATE_LIMIT_SALT') ?? '';
const configuredDailyLimit = Number(Deno.env.get('ANALYSIS_DAILY_LIMIT') || '60');
const dailyLimit = Number.isSafeInteger(configuredDailyLimit) && configuredDailyLimit > 0
  ? configuredDailyLimit
  : 60;
const configuredGlobalDailyLimit = Number(Deno.env.get('GLOBAL_ANALYSIS_DAILY_LIMIT') || '1000');
const globalDailyLimit = Number.isSafeInteger(configuredGlobalDailyLimit) && configuredGlobalDailyLimit > 0
  ? configuredGlobalDailyLimit
  : 1000;
const configuredProDailyLimit = Number(Deno.env.get('PRO_ANALYSIS_DAILY_LIMIT') || '60');
const proDailyLimit = Number.isSafeInteger(configuredProDailyLimit) && configuredProDailyLimit > 0
  ? configuredProDailyLimit
  : 60;
const revenueCatProjectId = Deno.env.get('REVENUECAT_PROJECT_ID') ?? '';
const revenueCatEntitlementResourceId = Deno.env.get('REVENUECAT_ENTITLEMENT_RESOURCE_ID') ?? '';
const revenueCatIosAppId = Deno.env.get('REVENUECAT_APP_ID') ?? '';
const revenueCatIosProductResourceIds = (Deno.env.get('REVENUECAT_IOS_PRODUCT_RESOURCE_IDS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const revenueCatSecretApiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY') ?? '';
const ENTITLEMENT_REFRESH_COOLDOWN_SECONDS = 20;
const REQUIRED_PRIVACY_VERSION = '2026-09-04-ai-v2';
const REQUIRED_GUARDIAN_VERSION = '2026-09-04-guardian-v1';

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
  fiber?: number;
};

/**
 * Per-instance cache in front of the shared table. A warm function handling a
 * burst of scans skips the database entirely for repeat ingredients.
 */
const memoryCache = new Map<string, FoodFacts | null>();
const memoryExpiry = new Map<string, number>();
const searchCache = referenceCache();
const barcodeCache = referenceCache({max: 500, ttl: 3_600_000, negativeTtl: 60_000});
const MEMORY_CACHE_LIMIT = 500;

function rememberInMemory(term: string, facts: FoodFacts | null) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) { memoryCache.delete(oldest); memoryExpiry.delete(oldest); }
  }
  memoryCache.set(term, facts);
  memoryExpiry.set(term, Date.now() + (facts ? 86_400_000 : 60_000));
}

type Result = { status: number; body: Record<string, unknown>; headers?: Record<string, string> };
type ProviderRoute = 'usda_search' | 'usda_analysis' | 'off_search' | 'off_barcode';

type AccessDecision = {
  status?: string;
  active?: boolean;
  accessKind?: 'free' | 'pro';
  graceEligible?: boolean;
  retryAfter?: number;
  result?: Record<string, unknown>;
};

function reply(result: Result) {
  return Response.json(result.body, { status: result.status, headers: { ...corsHeaders, ...result.headers } });
}

// deno-lint-ignore no-explicit-any
async function accessRpc(admin: any, name: string, args: Record<string, unknown>): Promise<AccessDecision | null> {
  const { data, error } = await admin.rpc(name, args);
  if (error) {
    // Only fixed RPC names and PostgreSQL error codes reach logs. Messages and
    // details can contain identifiers or payload fragments and stay excluded.
    console.error('nutrition access rpc failure', name, String(error.code ?? 'unknown'));
    return null;
  }
  return !data || typeof data !== 'object' ? null : data as AccessDecision;
}

// deno-lint-ignore no-explicit-any
async function reserveAnalysis(admin: any, userId: string, requestId: string, allowStaleGrace = false) {
  return accessRpc(admin, 'reserve_analysis_access', {
    p_user_id: userId,
    p_request_id: requestId,
    p_pro_daily_limit: proDailyLimit,
    p_allow_stale_grace: allowStaleGrace,
  });
}

// deno-lint-ignore no-explicit-any
async function refundAnalysis(admin: any, userId: string, requestId: string) {
  await accessRpc(admin, 'refund_analysis_request', {
    p_user_id: userId,
    p_request_id: requestId,
  });
}

function accessFailure(decision: AccessDecision | null): Result | null {
  if (!decision) {
    return { status: 503, body: { code: 'access_unavailable', message: 'Die Analyse ist gerade nicht erreichbar.' } };
  }
  if (decision.status === 'reserved' || decision.status === 'replay') return null;
  if (decision.status === 'subscription_required') {
    return { status: 402, body: { code: 'subscription_required', message: 'Für weitere Analysen ist Kandro Pro erforderlich.' } };
  }
  if (decision.status === 'daily_limit_reached') {
    return { status: 429, body: { code: 'daily_limit_reached', message: 'Du hast das heutige Analyselimit erreicht.' } };
  }
  if (decision.status === 'in_progress') {
    return { status: 409, body: { code: 'analysis_in_progress', message: 'Diese Analyse läuft bereits.' } };
  }
  if (decision.status === 'request_completed') {
    return { status: 409, body: { code: 'request_completed', message: 'Diese Anfrage wurde bereits abgeschlossen.' } };
  }
  if (decision.status === 'verification_required') {
    return { status: 503, body: { code: 'entitlement_verification_unavailable', message: 'Kandro Pro konnte gerade nicht geprüft werden.' } };
  }
  return { status: 400, body: { code: 'invalid_request', message: 'Ungültige Analyseanfrage.' } };
}

// Search remains free and does not consume a scan. This separate, short
// provider quota only prevents one authenticated account from exhausting the
// shared USDA/Open Food Facts capacity used by everyone else's analyses.
// deno-lint-ignore no-explicit-any
async function providerQuotaFailure(
  admin: any,
  userId: string,
  route: ProviderRoute,
  networkHash: string | null,
): Promise<Result | null> {
  // Missing trustworthy provenance or a missing server-only salt must not turn
  // the global provider circuit breaker into a two-account denial-of-service.
  if (!networkHash) {
    return {
      status: 503,
      body: { code: 'provider_error', message: 'Die Lebensmittelsuche ist gerade nicht erreichbar.' },
    };
  }
  const decision = await accessRpc(admin, 'consume_nutrition_provider_quota', {
    p_user_id: userId,
    p_route: route,
    p_network_hash: networkHash,
  });
  if (decision?.status === 'allowed') return null;
  if (decision?.status === 'rate_limited') {
    const retryAfter = Number.isSafeInteger(decision.retryAfter) && Number(decision.retryAfter) > 0
      ? Number(decision.retryAfter)
      : 60;
    return {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
      body: {
        code: 'provider_rate_limited',
        message: 'Zu viele Abfragen. Bitte warte kurz und versuche es erneut.',
      },
    };
  }
  return {
    status: 503,
    body: { code: 'provider_error', message: 'Die Lebensmittelsuche ist gerade nicht erreichbar.' },
  };
}

class ProviderQuotaError extends Error {
  constructor(readonly result: Result) {
    super(String(result.body.code ?? 'provider_rate_limited'));
    this.name = 'ProviderQuotaError';
  }
}

// Called immediately before every external USDA/OFF fetch, not once per app
// route: a single search or meal can fan out to multiple provider requests.
// deno-lint-ignore no-explicit-any
async function claimProviderRequest(admin: any, userId: string, route: ProviderRoute, networkHash: string | null) {
  const failure = await providerQuotaFailure(admin, userId, route, networkHash);
  if (failure) throw new ProviderQuotaError(failure);
}

/** The edge proxy appends the connection address; never trust the first XFF hop. */
function trustedClientIp(request: Request) {
  const dedicated = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-real-ip');
  if (dedicated?.trim()) return dedicated.trim();
  const chain = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return chain.at(-1) ?? null;
}

async function providerNetworkHash(request: Request) {
  const address = trustedClientIp(request);
  if (!address || !nutritionRateLimitSalt) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${nutritionRateLimitSalt}:nutrition-provider:${address}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// deno-lint-ignore no-explicit-any
async function claimRevenueCatRequest(admin: any, userId: string, networkHash: string | null) {
  if (!networkHash) {
    throw new ProviderQuotaError({
      status: 503,
      body: {
        code: 'entitlement_verification_unavailable',
        message: 'Kandro Pro konnte gerade nicht bestätigt werden.',
      },
    });
  }
  const decision = await accessRpc(admin, 'consume_revenuecat_provider_quota', {
    p_user_id: userId,
    p_network_hash: networkHash,
    p_request_units: 1,
  });
  if (decision?.status === 'allowed') return;
  if (decision?.status === 'rate_limited') {
    const retryAfter = Number.isSafeInteger(decision.retryAfter) && Number(decision.retryAfter) > 0
      ? Number(decision.retryAfter)
      : 60;
    throw new ProviderQuotaError({
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
      body: {
        code: 'entitlement_rate_limited',
        message: 'Kandro Pro wurde gerade sehr oft geprüft. Bitte versuche es gleich erneut.',
      },
    });
  }
  throw new ProviderQuotaError({
    status: 503,
    body: {
      code: 'entitlement_verification_unavailable',
      message: 'Kandro Pro konnte gerade nicht bestätigt werden.',
    },
  });
}

// deno-lint-ignore no-explicit-any
async function refreshRevenueCatAccess(admin: any, userId: string, networkHash: string | null) {
  // Captured before the network call. SQL rejects this result if a newer
  // webhook/REST observation was committed while the request was in flight.
  const checkedAt = new Date().toISOString();
  const entitlement = await fetchRevenueCatEntitlement({
    projectId: revenueCatProjectId,
    userId,
    entitlementResourceId: revenueCatEntitlementResourceId,
    iosAppId: revenueCatIosAppId,
    productResourceIds: revenueCatIosProductResourceIds,
    secretApiKey: revenueCatSecretApiKey,
    claimRequest: () => claimRevenueCatRequest(admin, userId, networkHash),
  });
  return accessRpc(admin, 'sync_revenuecat_entitlement', {
    p_user_id: userId,
    p_active: entitlement.active,
    p_expires_at: entitlement.expiresAt,
    p_checked_at: checkedAt,
  });
}

// deno-lint-ignore no-explicit-any
async function requestDetection(content: unknown[], candidate = false, signal?: AbortSignal) {
  return requestStructured({apiKey: aiApiKey, content, model: candidate ? GEMINI_MODEL : visionModel, provider: aiProvider, routeAuthorized: candidate && GEMINI_RELEASE_APPROVED, signal});
}

async function searchUsdaOnce(
  term: string,
  claimUsda?: () => Promise<void>,
  deadline = Date.now() + 22_000,
): Promise<{ facts: FoodFacts | null; cacheable: boolean }> {
  await claimUsda?.();
  if (Date.now() >= deadline) throw new ModelError('provider_timeout',504);
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(Math.max(1,Math.min(7000,deadline-Date.now()))),
    body: JSON.stringify({ query: term, pageSize: 25, dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'] }),
  });
  if (!response.ok) throw new ModelError(response.status===429?'provider_rate_limited':'provider_error',response.status===429?429:502,response.headers.get('retry-after'));
  const result = await response.json().catch(() => { throw new ModelError('provider_response_invalid'); });
  if (!Array.isArray(result?.foods)) throw new ModelError('provider_response_invalid');
  const match = chooseFoodMatch(result.foods.filter((food: unknown) => toFoodFacts(food)), term);
  return { facts: toFoodFacts(match.food, match), cacheable: match.cacheable };
}

/**
 * Tries the model's own term first, then a rewrite. Rejecting a bad match is
 * right, but leaving the ingredient unpriced when a good row exists under
 * USDA's own wording is not.
 */
async function searchUsda(
  term: string,
  claimUsda?: () => Promise<void>,
  deadline = Date.now() + 22_000,
): Promise<{ facts: FoodFacts | null; cacheable: boolean }> {
  const first = await searchUsdaOnce(term, claimUsda, deadline);
  if (first.facts) return first;
  for (const variant of searchTermVariants(term)) {
    const retry = await searchUsdaOnce(variant, claimUsda, deadline);
    if (retry.facts) return retry;
  }
  return first;
}

/**
 * Resolves every ingredient of one scan to nutrient facts, asking USDA only for
 * terms that are neither in this instance's memory nor in the shared table.
 */
// deno-lint-ignore no-explicit-any
async function resolveFacts(
  terms: string[],
  admin: any,
  claimUsda?: () => Promise<void>,
): Promise<Map<string, FoodFacts | null>> {
  const resolved = new Map<string, FoodFacts | null>();
  const unknown: string[] = [];

  for (const term of terms) {
    const cacheKey = usdaCacheKey(term);
    if ((memoryExpiry.get(cacheKey) ?? 0) > Date.now() && memoryCache.has(cacheKey)) resolved.set(term, memoryCache.get(cacheKey) ?? null);
    else if (!resolved.has(term)) unknown.push(term);
  }

  if (unknown.length) {
    const termsByCacheKey = new Map(unknown.map((term) => [usdaCacheKey(term), term]));
    const { data } = await admin
      .from('usda_food_cache')
      .select('search_term, fdc_id, calories, protein, carbs, fat, fiber, fetched_at')
      .in('search_term', [...termsByCacheKey.keys()]).abortSignal(AbortSignal.timeout(3000));

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
  // Sequential requests keep quota claims and provider traffic bounded even
  // when a model returns several uncached ingredients in one meal.
  const fetched: { term: string; facts: FoodFacts | null; cacheable: boolean }[] = [];
  const lookupDeadline = Date.now() + 22_000;
  for (const term of missing) {
    if (Date.now() > lookupDeadline) throw new ModelError('provider_timeout', 504);
    fetched.push({ term, ...await searchUsda(term, claimUsda, lookupDeadline) });
  }

  for (const { term, facts, cacheable } of fetched) {
    resolved.set(term, facts);
    if (cacheable) rememberInMemory(usdaCacheKey(term), facts);
  }

  const safeToCache = fetched.filter(({ cacheable, facts }) => cacheable && (!facts || facts.fiber !== undefined));
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
    ).abortSignal(AbortSignal.timeout(3000)).then(() => undefined, () => undefined);
  }

  return resolved;
}

// deno-lint-ignore no-explicit-any
async function resolveDetection(
  detection: any,
  admin: any,
  source: 'photo' | 'text' = 'photo',
  claimUsda?: () => Promise<void>,
  correctionProtocol?: unknown,
): Promise<Result> {
  const classificationError = classifyDetection(detection, source);
  if (classificationError) return classificationError;

  // deno-lint-ignore no-explicit-any
  const terms = detection.items
    .filter((item: any) => !requiresFoodIdentityCorrection(item) && !resolveBlsFacts(item))
    .map((item: any) => canonicalFoodQuery(item.searchTermEn))
    // A term that names no food would be looked up, cached, and then reused for
    // every other ingredient that produced the same placeholder.
    .filter(isUsableSearchTerm);
  const facts = await resolveFacts(terms, admin, claimUsda);
  // deno-lint-ignore no-explicit-any
  const items = detection.items.map((item: any, index: number) => {
    // The same term may have been resolved for another, non-conflicting item.
    // Never let that shared/cache result bypass this ingredient's identity gate.
    // An identity conflict must not borrow a staple's database row; the
    // model's own estimate for the named food is still a usable value.
    if (requiresFoodIdentityCorrection(item)) return buildMealItem(item, aiEstimateFacts(item), index);
    const blsFacts = resolveBlsFacts(item);
    const term = canonicalFoodQuery(item.searchTermEn);
    const usdaFacts = isUsableSearchTerm(term) ? facts.get(term) ?? null : null;
    return buildMealItem(item, blsFacts ?? usdaFacts ?? aiEstimateFacts(item), index);
  });
  const nutritionError = incompleteNutritionError(items);
  if (nutritionError) return ingredientCorrectionDraft(detection, items, correctionProtocol) ?? nutritionError;
  const warnings = buildAccuracyWarnings(detection, items);
  return { status: 200, body: { title: detection.title, confidence: detection.confidence, items, warnings } };
}

// deno-lint-ignore no-explicit-any
async function analyzePhoto(input: any, admin: any, claimUsda?: () => Promise<void>, candidate = false, signal?: AbortSignal): Promise<Result> {
  if (!validateAnalysisInput(input)) {
    return { status: 400, body: { code: 'invalid_input', message: 'Ungültiges Fotoformat.' } };
  }
  if (typeof input.imageBase64 !== 'string' || input.imageBase64.length > MAX_IMAGE_BASE64) {
    return { status: 413, body: { code: 'invalid_input', message: 'Das Foto ist zu groß.' } };
  }
  return resolveDetection(await requestDetection([
    { type: 'input_text', text: photoDetectionPrompt(requestedLanguage(input)) },
    { type: 'input_image', image_url: `data:${input.mimeType};base64,${input.imageBase64}`, detail: imageDetail },
  ], candidate, signal), admin, 'photo', claimUsda, input.ingredientCorrection);
}

// deno-lint-ignore no-explicit-any
async function analyzeDescription(input: any, admin: any, claimUsda?: () => Promise<void>, candidate = false, signal?: AbortSignal): Promise<Result> {
  const description = typeof input?.description === 'string' ? input.description.trim() : '';
  if (description.length < 3 || description.length > 500) {
    return { status: 400, body: { code: 'invalid_input', message: 'Beschreibe die Mahlzeit in 3 bis 500 Zeichen.' } };
  }
  const detection = await requestDetection([{ type: 'input_text', text: descriptionDetectionPrompt(description, requestedLanguage(input)) }], candidate, signal);
  return resolveDetection(applyDescriptionAmountsTolerant(detection, description), admin, 'text', claimUsda, input.ingredientCorrection);
}

/**
 * Free-text food search. No model call, so it costs nothing and stays outside
 * the paid quota — which is the point: logging a banana should not spend one
 * of three free analyses, and should not take five seconds.
 *
 * The complete bilingual BLS 4.0 snapshot answers common searches locally.
 * That is faster than a provider round trip and keeps the visible name in the
 * reader's language. USDA and Open Food Facts remain fallbacks for products
 * the reference catalogue does not contain.
 */
async function searchFoods(
  query: string,
  language: string,
  claimProvider?: (route: ProviderRoute) => Promise<void>,
  catalogueOnly = false,
): Promise<Result> {
  const term = normalizeSearchTerm(query);
  if (!isSearchQuery(term)) {
    return { status: 400, body: { code: 'invalid_input', message: 'Query too short.' } };
  }

  const results: unknown[] = [];
  const issues: {code: string; retryAfter?: string}[] = [];
  const noteFailure = (error: unknown) => {
    if (error instanceof ProviderQuotaError) issues.push({code: String(error.result.body.code), retryAfter: error.result.headers?.['Retry-After']});
    else if (error instanceof ModelError) issues.push({code: error.code, retryAfter: error.retryAfter});
    else issues.push({code: error instanceof Error && /timeout|abort/i.test(error.name) ? 'provider_timeout' : 'provider_error'});
  };
  const finish = (): Result => {
    if (!results.length && issues.length) return {status: issues[0].code === 'provider_rate_limited' ? 429 : 503, body:{code:issues[0].code}, headers:issues[0].retryAfter ? {'Retry-After':issues[0].retryAfter} : undefined};
    return {status:200,body:{query:term,results:results.slice(0,60),searchStatus:issues.length?'partial':catalogueOnly?'catalogue':'complete',issues}};
  };
  const seen = new Set<string>();
  const add = (entry: unknown, referenceId: string) => {
    const row=entry as {name?: unknown};
    if(typeof row?.name!=='string'||!row.name.trim()||row.name.length>160)return;
    if (seen.has(referenceId)) return;
    seen.add(referenceId);
    results.push(entry);
  };

  const catalogue = searchBlsCatalog(term, language, 60);
  // A hit that merely starts with the same letters is not an answer: "pho"
  // prefix-matches the phosphate in a curing salt, and returning that used to
  // end the search before Open Food Facts was ever asked.
  const catalogueAnswered = catalogue.some((food) => food.strong);

  // When nothing in the catalogue really answered, its rows are kept aside and
  // appended after the network results rather than sitting on top of them:
  // seeing a curing salt above the actual pho is worse than not seeing it.
  const weakRows: { entry: unknown; id: string }[] = [];
  const keep = (entry: unknown, referenceId: string) => {
    if (catalogueAnswered) add(entry, referenceId);
    else weakRows.push({ entry, id: referenceId });
  };
  const appendWeak = () => {
    for (const row of weakRows) add(row.entry, row.id);
  };

  for (const food of catalogue) {
    const meal = getBlsReferenceByCode(food.code);
    keep({
      id: meal ? `bls-${meal.key}` : `bls-${food.code}`,
      name: language === 'de' ? (meal?.nameDe ?? food.nameDe) : (meal?.nameEn ?? food.nameEn),
      per100g: meal?.per100g ?? food.per100g,
      defaultGrams: meal?.defaultGrams ?? 100,
      portions: meal ? [{ label: language === 'de' ? '1 Portion' : '1 portion', grams: meal.defaultGrams }] : [],
      source: { provider: 'bls', referenceId: food.code, label: `BLS 4.0 ${food.code}` },
    }, food.code);
    if (results.length + weakRows.length >= 60) break;
  }

  // Everyday foods finish here: no network, no quota and no English USDA
  // wording leaking into a German result list. Only a real match may end the
  // search, though — a weak one keeps the catalogue entry and asks the network
  // as well, so the letters that happen to match cannot hide three million
  // products behind them.
  if (catalogueOnly || (results.length && catalogueAnswered)) {
    appendWeak(); return finish();
  }

  // A German query that is absent from the 7,140 bilingual references is most
  // likely a brand. Open Food Facts has language-specific product fields;
  // USDA does not, so sending its raw English descriptions here would recreate
  // the localization bug this catalogue is meant to remove.
  if (language === 'de') {
    try {
      for (const product of await searchOpenFoodFacts(
        term,
        language,
        claimProvider ? () => claimProvider('off_search') : undefined,
      )) {
        // deno-lint-ignore no-explicit-any
        add(product, `off-${String((product as any)?.source?.referenceId ?? '')}`);
      }
    } catch (error) {
      noteFailure(error);
    }
    appendWeak();
    return finish();
  }

  let foods: unknown[] = [];
  try {
    foods = await searchUsdaFoods(term, claimProvider ? () => claimProvider('usda_search') : undefined);
  } catch (error) {
    noteFailure(error);
    foods = [];
  }

  for (const food of foods) {
    // deno-lint-ignore no-explicit-any
    const entry = food as any;
    const facts = toFoodFacts(entry, { confidence: 'medium' });
    if (!facts || !Number.isSafeInteger(entry.fdcId) || entry.fdcId < 1 || !compatibleSearchIdentity(term, entry.description)) continue;
    add({
      id: `usda-${entry.fdcId}`,
      name: String(entry.description ?? '').trim(),
      per100g: {
        calories: Number(facts.calories),
        protein: Number(facts.protein),
        carbs: Number(facts.carbs),
        fat: Number(facts.fat),
        ...(facts.fiber !== undefined ? {fiber: Number(facts.fiber)} : {}),
      },
      defaultGrams: 100,
      portions: usdaPortions(entry),
      source: { provider: 'usda', referenceId: String(entry.fdcId), label: `USDA FDC ${entry.fdcId}` },
    }, `usda-${entry.fdcId}`);
  }

  // Open Food Facts covers what a reference database never will: regional
  // products, store brands, and dishes like Labskaus that exist as a packaged
  // product long before they exist as a USDA entry. It is indexed in German
  // too, so it also answers the queries the translation above misses.
  if (results.length < 12) {
    try {
      for (const product of await searchOpenFoodFacts(
        term,
        language,
        claimProvider ? () => claimProvider('off_search') : undefined,
      )) {
        // deno-lint-ignore no-explicit-any
        add(product, `off-${String((product as any)?.source?.referenceId ?? '')}`);
      }
    } catch (error) {
      noteFailure(error);
    }
  }

  appendWeak();
  return finish();
}

/**
 * Full-text product search.
 *
 * The classic /cgi/search.pl endpoint answers anonymous callers with a 503 and
 * a sign-in page; the Search-a-licious service does not, and it takes a
 * fields list so the response stays small.
 */
async function searchOpenFoodFacts(
  term: string,
  language: string,
  claimOff?: () => Promise<void>,
): Promise<unknown[]> {
  const fields = 'code,lang,lc,product_name,product_name_de,product_name_en,brands,nutriments,serving_quantity,serving_size,serving_quantity_unit,nutrition_data_per,quantity,product_quantity_unit';
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(term)}&page_size=10&fields=${fields}`;
  await claimOff?.();
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Kandro/1.0 (https://getkandro.com; hewaddorani22@gmail.com)' },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new ModelError(response.status === 429 ? 'provider_rate_limited' : 'provider_error', response.status === 429 ? 429 : 502, response.headers.get('retry-after'));
  const payload = await response.json().catch(() => { throw new ModelError('provider_response_invalid'); });
  if (!Array.isArray(payload?.hits)) throw new ModelError('provider_response_invalid');
  const hits = payload.hits;

  const out: unknown[] = [];
  for (const hit of hits) {
    // deno-lint-ignore no-explicit-any
    const product = hit as any;
    const values = product?.nutriments || {};
    // Search and barcode use one completeness/precision boundary. Unknown
    // protein, carbs or fat must never look like a measured zero.
    const per100g = offMassNutrition(product);
    if (!per100g) continue;
    // Preserve an identifiable original product name when a translation is absent.
    const name = localizedProductName(product, language);
    if (!name || name.length > 130 || !/^\d{7,14}$/.test(String(product.code)) || !compatibleSearchIdentity(term,name)) continue;
    const brand = Array.isArray(product.brands) ? product.brands[0] : product.brands;
    const serving = Number(product.serving_quantity);
    out.push({
      id: `off-${product.code}`,
      name: brand && !name.toLowerCase().includes(String(brand).toLowerCase()) ? `${name} (${brand})` : name,
      per100g,
      defaultGrams: 100,
      portions: offMassPortions(product),
      source: { provider: 'open-food-facts', referenceId: String(product.code), label: `Open Food Facts ${product.code}` },
    });
    if (out.length >= 5) break;
  }
  return out;
}

async function usdaRows(query: string, claimUsda?: () => Promise<void>): Promise<unknown[]> {
  await claimUsda?.();
  const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaApiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(7000),
    body: JSON.stringify({ query, pageSize: 25 }),
  });
  if (!response.ok) throw new ModelError(response.status===429?'provider_rate_limited':'provider_error',response.status===429?429:502,response.headers.get('retry-after'));
  const result = await response.json().catch(() => { throw new ModelError('provider_response_invalid'); });
  if (!Array.isArray(result?.foods)) throw new ModelError('provider_response_invalid');
  return result.foods;
}

/**
 * Raw USDA rows for the search list.
 *
 * A bare food word needs a second probe: USDA's own relevance for "rice"
 * returns crackers, cakes and paper, and plain cooked rice is not in the first
 * twenty-five results at all. Asking again for "rice cooked" finds it. The
 * merged rows are then ranked against what the user actually typed.
 */
async function searchUsdaFoods(term: string, claimUsda?: () => Promise<void>): Promise<unknown[]> {
  // A German word reaches an English database as nothing at all: "banane"
  // returned an empty list and a hint telling the user to translate it
  // themselves. Everything below this line works in English, ranking
  // included: scoring "Bananas, raw" against "banane" compares two languages
  // and lands on whatever USDA happened to return first.
  const english = translateGermanQuery(term) ?? term;
  const probes = [english, ...searchTermVariants(english)];
  const hasPreparation = /\b(?:raw|cooked|boiled|grilled|fried|baked|roasted|steamed)\b/.test(english);
  if (!hasPreparation) probes.push(`${english} cooked`);

  const rows: unknown[] = [];
  const seen = new Set<string>();
  for (const probe of probes) {
    for (const row of await usdaRows(probe, claimUsda)) {
      // deno-lint-ignore no-explicit-any
      const id = String((row as any)?.fdcId ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
    // Two probes are enough; each one is a round trip the user is waiting on.
    if (probes.indexOf(probe) >= 1) break;
  }
  return rankFoodMatches(rows, english, 12);
}

/** Picks the product name in the reader's language, falling back sensibly. */
// deno-lint-ignore no-explicit-any
function localizedProductName(product: any, language: string, strict = false): string {
  const explicit = language === 'de' ? product?.product_name_de : product?.product_name_en;
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();

  const catalogueLanguage = String(product?.lang ?? product?.lc ?? '').trim().toLowerCase().split(/[-_]/)[0];
  const generic = typeof product?.product_name === 'string' ? product.product_name.trim() : '';
  if (generic && (!strict || catalogueLanguage === language)) return generic;
  if (strict) return '';

  const ordered = language === 'de'
    ? [product?.product_name_en]
    : [product?.product_name_de];
  return ordered.map((value) => (typeof value === 'string' ? value.trim() : '')).find(Boolean) ?? '';
}

async function lookupBarcode(barcode: string, language: string, claimOff?: () => Promise<void>): Promise<Result> {
  if (!/^\d{7,14}$/.test(barcode)) {
    return { status: 400, body: { code: 'invalid_barcode', message: 'Ungültiger Barcode.' } };
  }
  const fields = 'code,product_name_de,product_name_en,product_name,nutriments,serving_size,serving_quantity,serving_quantity_unit,nutrition_data_per,quantity,product_quantity_unit';
  await claimOff?.();
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, {
    // Open Food Facts asks callers to identify themselves and throttles the
    // ones that do not. A generic agent is how you get rate limited at scale.
    headers: { 'User-Agent': 'Kandro/1.0 (https://getkandro.com; hewaddorani22@gmail.com)' },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    return {
      status: response.status === 404 ? 404 : response.status === 429 ? 429 : 502,
      body: { code: response.status === 404 ? 'product_not_found' : response.status === 429 ? 'provider_rate_limited' : 'provider_error' },
      headers: response.headers.get('retry-after') ? {'Retry-After': response.headers.get('retry-after')!} : undefined,
    };
  }
  const result = await response.json().catch(() => { throw new ModelError('provider_response_invalid'); });
  if (result?.status === 0) return {status:404,body:{code:'product_not_found'}};
  if (!result?.product || typeof result.product !== 'object') throw new ModelError('provider_response_invalid');
  const product = result.product;
  const values = product?.nutriments || {};
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
      // The product name follows the reader, not the database's field order.
      // Preferring product_name_de unconditionally showed German names to
      // English users whenever Open Food Facts happened to carry one.
      name: localizedProductName(product, language),
      // Empty rather than a sentence: the app fills in the fallback wording
      // from its own dictionary, so it is never German for an English reader.
      nameMissing: !localizedProductName(product, language),
      per100g,
      // The pack's own serving, so "2 servings" is a tap rather than a
      // multiplication the user does in their head.
      portions: servingPortion(product),
      source: { provider: 'open-food-facts', referenceId: barcode, label: `Open Food Facts ${barcode}` },
    },
  };
}

/** An Open Food Facts serving size, when it is a weight anyone would trust. */
// deno-lint-ignore no-explicit-any
function servingPortion(product: any): { label: string; grams: number }[] {
  return offMassPortions(product);
}

/** Strips the /functions/v1/nutrition prefix so routes read the same as locally. */
function routeOf(request: Request) {
  const path = new URL(request.url).pathname.replace(/^\/functions\/v1/, '');
  return path.replace(/^\/nutrition/, '').replace(/\/+$/, '') || '/';
}

async function captureFingerprint(value: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
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
    .select('age,privacy_version,wellness_consent_at,guardian_consent_at,guardian_consent_version')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (consentError) {
    return reply({ status: 503, body: { code: 'provider_error', message: 'Die Einwilligung konnte nicht geprüft werden.' } });
  }
  const age = Number(consent?.age);
  const guardianApproved = age >= 16 || (
    age >= 14
    && consent?.guardian_consent_at
    && consent.guardian_consent_version === REQUIRED_GUARDIAN_VERSION
  );
  if (
    !Number.isInteger(age)
    || age < 14
    || !guardianApproved
    || consent?.privacy_version !== REQUIRED_PRIVACY_VERSION
    || !consent.wellness_consent_at
  ) {
    return reply({ status: 403, body: { code: 'consent_required', message: 'Bitte bestätige zuerst die aktuelle Datenschutzeinwilligung.' } });
  }

  const route = routeOf(request);
  const networkHash = await providerNetworkHash(request);
  if (request.method === 'GET' && route === '/v1/capture-capabilities') return reply({status:200,body:{gemini:GEMINI_RELEASE_APPROVED,searchAssistance:GEMINI_RELEASE_APPROVED,consentVersion:GEMINI_CONSENT_VERSION}});
  // Cohort state comes only from protected server records. Build/capability
  // headers are deliberately irrelevant to identity or free access.
  const resolveAppAccess = async () => {
    const { data: access, error } = await context.supabaseAdmin.rpc('resolve_paywall_access_v1', { p_user_id: data.user.id });
    if (error || !access || typeof access.hard !== 'boolean') throw new ModelError('access_unavailable', 503);
    return access;
  };
  if (request.method === 'POST' && route === '/v1/access/enroll') {
    const input = await request.json().catch(() => null);
    if (!input || Object.keys(input).some(key => !['firstUse','ageConfirmed','trialEligible','product','sevenDays'].includes(key))) return reply({status:400,body:{code:'invalid_input'}});
    const {data:access,error} = await context.supabaseAdmin.rpc('enroll_paywall_access_v1', {
      p_user_id:data.user.id,p_first_use:input.firstUse===true,p_age_confirmed:input.ageConfirmed===true,
      p_trial_eligible:input.trialEligible===true,p_product:typeof input.product==='string'?input.product.slice(0,160):null,p_seven_days:input.sevenDays===true,
    });
    if(error) throw new ModelError('access_unavailable',503);
    return reply({status:200,body:access});
  }
  if (request.method === 'GET' && route === '/v1/access') return reply({status:200,body:await resolveAppAccess()});
  if (!['/v1/entitlement/refresh','/v1/ai-consent'].includes(route)) {
    const {data:priorUse,error:priorUseError} = await context.supabaseAdmin.rpc('record_paywall_prior_use_v1',{p_user_id:data.user.id});
    if(priorUseError || !priorUse || typeof priorUse.hard !== 'boolean') throw new ModelError('access_unavailable',503);
    let access = priorUse;
    // Own saved data remains correctable. This scope authorizes reference
    // lookup only, never analysis or creation of a new meal.
    const correctionId = new URL(request.url).searchParams.get('correctionMealId');
    let correction = false;
    if (request.method==='GET' && correctionId && correctionId.length<=240 && (route==='/v1/search'||route.startsWith('/v1/barcode/'))) {
      const {data:meal,error} = await context.supabase.from('meals').select('id').eq('user_id',data.user.id).eq('id',correctionId).maybeSingle();
      correction = !error && !!meal;
    }
    if(access.hard && access.access==='unknown' && !correction) {
      try { await refreshRevenueCatAccess(context.supabaseAdmin,data.user.id,networkHash); access=await resolveAppAccess(); }
      catch { /* Only the server's existing bounded grace can permit access. */ }
    }
    if(access.hard && access.access!=='active' && !correction) {
      return reply({status:access.access==='inactive'?402:503,body:{code:access.access==='inactive'?'paywall_access_required':'entitlement_verification_unavailable'}});
    }
  }
  // Additive consent: the old privacy version and all old-client routes remain.
  if (request.method === 'POST' && route === '/v1/ai-consent') {
    const input = await request.json().catch(()=>null);
    if (!GEMINI_RELEASE_APPROVED || input?.version !== GEMINI_CONSENT_VERSION) throw new ModelError('ai_route_not_approved',503);
    const scope=input?.scope??'search';
    if(!['search','analysis'].includes(scope)) return reply({status:400,body:{code:'invalid_input'}});
    const {error} = input.accepted === true
      ? await context.supabaseAdmin.from('capture_ai_consents').upsert({user_id:data.user.id,version:GEMINI_CONSENT_VERSION,scopes:[scope],accepted_at:new Date().toISOString()})
      : await context.supabaseAdmin.from('capture_ai_consents').delete().eq('user_id',data.user.id);
    if(error) throw new ModelError('access_unavailable',503);
    return reply({status:200,body:{accepted:input.accepted===true}});
  }
  const candidateConsent = async (scope = 'search') => {
    if (!GEMINI_RELEASE_APPROVED) return false;
    const {data:grant,error} = await context.supabase.from('capture_ai_consents').select('version,scopes,accepted_at').eq('user_id',data.user.id).maybeSingle();
    return !error && grant?.version === GEMINI_CONSENT_VERSION && Boolean(grant.accepted_at) && Array.isArray(grant.scopes) && grant.scopes.includes(scope);
  };
  if (request.method === 'POST' && route === '/v1/search-assist') {
    if (!GEMINI_RELEASE_APPROVED) throw new ModelError('ai_route_not_approved',503);
    if (!await candidateConsent()) return reply({status:403,body:{code:'consent_required'}});
    const input = await request.json().catch(()=>null);
    if (!isAnalysisRequestId(input?.requestId) || !isSearchQuery(input?.query) || input.query.length>120 || !networkHash) return reply({status:400,body:{code:'invalid_input'}});
    const language = requestedLanguage(input);
    const operationArgs={p_user_id:data.user.id,p_request_id:input.requestId,p_kind:'search',p_fingerprint:await captureFingerprint([input.query.trim().toLowerCase(),language,GEMINI_CONSENT_VERSION]),p_network_hash:networkHash};
    const previous=await accessRpc(context.supabaseAdmin,'lookup_capture_operation',operationArgs);
    if(previous?.status==='replay' && previous.result) {
      const receipt=previous.result as unknown as Result;
      return reply(receipt.status===200?receipt:{status:409,body:{code:'request_completed'}});
    }
    if(previous?.status!=='missing') return reply({status:409,body:{code:'request_completed'}});
    // Re-evaluate with actual database results, never trust a client claim that
    // the providers succeeded or that arbitrary candidate IDs are real.
    const base = await searchFoods(input.query,language,(providerRoute)=>claimProviderRequest(context.supabaseAdmin,data.user.id,providerRoute,networkHash));
    if (base.status!==200 || base.body.searchStatus==='partial') return reply(base);
    if ((base.body.results as unknown[]).length) return reply({status:200,body:{results:base.body.results,confirmationRequired:false}});
    const decision = await accessRpc(context.supabaseAdmin,'reserve_capture_operation',operationArgs);
    if (decision?.status==='replay' && decision.result) return reply(decision.result as unknown as Result);
    if (decision?.status!=='claimed') return reply({status:decision?.status==='rate_limited'?429:409,body:{code:decision?.status==='rate_limited'?'provider_rate_limited':'request_completed'}});
    let result: Result;
    try {
      result={status:200,body:await runSearchAssistance({query:input.query,language,candidates:[],apiKey:aiApiKey,routeAuthorized:true,signal:request.signal,
        lookup:(variant: string)=>searchFoods(variant,language,(providerRoute)=>claimProviderRequest(context.supabaseAdmin,data.user.id,providerRoute,networkHash))})};
    } catch(error) { result={status:error instanceof ModelError?error.status:502,body:{code:error instanceof ModelError?error.code:'provider_error'}}; }
    const finished = await accessRpc(context.supabaseAdmin,'finish_capture_operation',{p_user_id:data.user.id,p_request_id:input.requestId,p_result:result});
    if(finished?.status!=='completed') return reply({status:503,body:{code:'access_unavailable'}});
    return reply(result);
  }


  // Barcode and search stay outside the paid quota, but not outside the
  // provider-abuse boundary: Open Food Facts publishes strict read limits.
  if (request.method === 'GET') {
    const match = route.match(/^\/v1\/barcode\/(\d{7,14})$/);
    // A GET carries no body, so the language rides along in the query string.
    if (match) {
      const requested = new URL(request.url).searchParams.get('language');
      try {
        return reply(await barcodeCache.get(JSON.stringify([SEARCH_VERSION, match[1], requested]), () => lookupBarcode(
          match[1],
          requestedLanguage({ language: requested }),
          () => claimProviderRequest(context.supabaseAdmin, data.user.id, 'off_barcode', networkHash),
        ), (result: Result) => [200,404].includes(result.status), (result: Result) => result.status === 404));
      } catch (error) {
        if (error instanceof ProviderQuotaError) return reply(error.result);
        throw error;
      }
    }
    if (route === '/v1/search') {
      const params = new URL(request.url).searchParams;
      try {
        return reply(await searchCache.get(await captureFingerprint([SEARCH_VERSION, data.user.id, params.get('q'), params.get('language'), params.get('scope')]), () => searchFoods(
          params.get('q') ?? '',
          requestedLanguage({ language: params.get('language') }),
          (providerRoute) => claimProviderRequest(
            context.supabaseAdmin,
            data.user.id,
            providerRoute,
            networkHash,
          ),
          params.get('scope') === 'catalogue',
        ), (result: Result) => result.status === 200 && result.body.searchStatus !== 'partial', (result: Result) => (result.body.results as unknown[]).length === 0));
      } catch (error) {
        if (error instanceof ProviderQuotaError) return reply(error.result);
        throw error;
      }
    }
    return reply({ status: 404, body: { code: 'not_found', message: 'Route nicht gefunden.' } });
  }

  if (request.method !== 'POST') {
    return reply({ status: 405, body: { code: 'method_not_allowed', message: 'Methode nicht erlaubt.' } });
  }
  if (route === '/v1/entitlement/refresh') {
    try {
      const claim = await accessRpc(context.supabaseAdmin, 'claim_revenuecat_refresh', {
        p_user_id: data.user.id,
        p_cooldown_seconds: ENTITLEMENT_REFRESH_COOLDOWN_SECONDS,
      });
      if (claim?.status === 'rate_limited') {
        // Another refresh started inside the short lease. Its cached value may
        // predate a just-finished purchase or refund, so never present that
        // value as a completed authoritative check. The client performs a
        // bounded retry after the lease.
        return reply({
          status: 503,
          body: {
            code: 'entitlement_verification_unavailable',
            message: 'Kandro Pro wird gerade bestätigt.',
          },
        });
      }
      if (claim?.status !== 'claimed') throw new Error('entitlement_refresh_invalid');
      const synced = await refreshRevenueCatAccess(context.supabaseAdmin, data.user.id, networkHash);
      if (!['synced', 'stale'].includes(synced?.status ?? '') || typeof synced?.active !== 'boolean') {
        throw new Error('entitlement_refresh_invalid');
      }
      return reply({ status: 200, body: { active: synced.active } });
    } catch (error) {
      if (error instanceof ProviderQuotaError) return reply(error.result);
      return reply({
        status: 503,
        body: {
          code: 'entitlement_verification_unavailable',
          message: 'Kandro Pro konnte gerade nicht bestätigt werden.',
        },
      });
    }
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

  const candidate = payload?.analysisProvider === GEMINI_MODEL;
  if (candidate && !GEMINI_RELEASE_APPROVED) throw new ModelError('ai_route_not_approved',503);
  if (candidate && !await candidateConsent('analysis')) return reply({status:403,body:{code:'consent_required'}});

  const requestId = typeof payload?.requestId === 'string' ? payload.requestId : '';
  if (!isAnalysisRequestId(requestId)) {
    return reply({ status: 400, body: { code: 'invalid_request', message: 'Ungültige Analyseanfrage.' } });
  }
  if (!networkHash) {
    return reply({
      status: 503,
      body: { code: 'provider_error', message: 'Die Analyse ist gerade nicht erreichbar.' },
    });
  }

  const captureArgs={p_user_id:data.user.id,p_request_id:requestId,p_kind:'analysis',p_fingerprint:await captureFingerprint([route,payload.description??payload.imageBase64,requestedLanguage(payload),candidate]),p_network_hash:networkHash};
  if (payload.captureProtocol === 2) {
    const previous=await accessRpc(context.supabaseAdmin,'lookup_capture_operation',captureArgs);
    if(previous?.status==='replay' && previous.result) {
      const receipt=previous.result as unknown as Result;
      return reply(receipt.status===200?receipt:{status:409,body:{code:'request_completed'}});
    }
    if(previous?.status!=='missing') return reply({status:409,body:{code:'request_completed'}});
  }
  let access = await reserveAnalysis(context.supabaseAdmin, data.user.id, requestId);
  if (access?.status === 'verification_required') {
    try {
      const synced = await refreshRevenueCatAccess(context.supabaseAdmin, data.user.id, networkHash);
      if (!['synced', 'stale'].includes(synced?.status ?? '')) {
        return reply({ status: 503, body: { code: 'entitlement_verification_unavailable', message: 'Kandro Pro konnte gerade nicht geprüft werden.' } });
      }
      access = await reserveAnalysis(context.supabaseAdmin, data.user.id, requestId);
    } catch {
      // Never grant an unknown/non-paying account during an outage. Only a
      // customer last confirmed active within the documented 6-hour grace can
      // continue, and SQL enforces that timestamp rather than trusting this flag.
      access = access.graceEligible
        ? await reserveAnalysis(context.supabaseAdmin, data.user.id, requestId, true)
        : access;
    }
  }
  if (access?.status === 'replay' && access.result) {
    return reply({ status: 200, body: access.result });
  }
  const denied = accessFailure(access);
  if (denied) return reply(denied);

  const { data: used, error: quotaError } = await context.supabase.rpc('consume_analysis_quota');
  if (quotaError || !Number.isSafeInteger(used) || used < 1) {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    return reply({ status: 503, body: { code: 'provider_error', message: 'Die Analyse ist gerade nicht erreichbar.' } });
  }
  if (used > dailyLimit) {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    return reply({
      status: 429,
      body: { code: 'daily_limit_reached', message: 'Du hast heute sehr viele Mahlzeiten erfasst. Morgen geht es normal weiter.' },
    });
  }

  // Reserve the first USDA unit before paying for model inference. Cached/BLS
  // meals may not use it, but an exhausted nutrition budget can never consume
  // the non-refundable global AI-day breaker or become a paid model call.
  try {
    await claimProviderRequest(context.supabaseAdmin, data.user.id, 'usda_analysis', networkHash);
  } catch (error) {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    if (error instanceof ProviderQuotaError) return reply(error.result);
    throw error;
  }
  let prepaidUsdaUnit = true;

  const globalQuota = await accessRpc(context.supabaseAdmin, 'consume_global_analysis_quota', {
    p_daily_limit: globalDailyLimit,
  });
  if (globalQuota?.status !== 'allowed') {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    return reply({
      status: 503,
      body: { code: 'provider_error', message: 'Die Analyse ist gerade ausgelastet. Bitte versuche es später erneut.' },
    });
  }

  const claimAnalysisUsda = async () => {
    if (prepaidUsdaUnit) {
      prepaidUsdaUnit = false;
      return;
    }
    await claimProviderRequest(context.supabaseAdmin, data.user.id, 'usda_analysis', networkHash);
  };

  if (payload.captureProtocol === 2) {
    const decision = await accessRpc(context.supabaseAdmin,'reserve_capture_operation',captureArgs);
    if(decision?.status !== 'claimed') {
      await refundAnalysis(context.supabaseAdmin,data.user.id,requestId);
      if(decision?.status==='replay' && decision.result) return reply(decision.result as unknown as Result);
      return reply({status:409,body:{code:'request_completed'}});
    }
  }
  const rememberCapture = async (result: Result) => {
    if(payload.captureProtocol !== 2) return true;
    return (await accessRpc(context.supabaseAdmin,'finish_capture_operation',{p_user_id:data.user.id,p_request_id:requestId,p_result:result}))?.status === 'completed';
  };

  const started = await accessRpc(context.supabaseAdmin, 'mark_analysis_request_started', {
    p_user_id: data.user.id,
    p_request_id: requestId,
  });
  if (started?.status !== 'started') {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    return reply({ status: 503, body: { code: 'access_unavailable', message: 'Die Analyse ist gerade nicht erreichbar.' } });
  }

  let result: Result;
  try {
    result = route === '/v1/analyze'
      ? await analyzePhoto(payload, context.supabaseAdmin, claimAnalysisUsda, candidate, request.signal)
      : await analyzeDescription(payload, context.supabaseAdmin, claimAnalysisUsda, candidate, request.signal);
  } catch (error) {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    if(error instanceof Error && ['mass_required','amount_ambiguous','amount_out_of_range'].includes(error.message)) error=new ModelError(error.message,422);
    if(error instanceof Error && /^(AbortError|TimeoutError)$/.test(error.name)) error=new ModelError('provider_timeout',504);
    const failed: Result = error instanceof ProviderQuotaError ? error.result : {status:error instanceof ModelError?error.status:502,body:{code:error instanceof ModelError?error.code:'provider_error'},headers:error instanceof ModelError && error.retryAfter?{'Retry-After':String(error.retryAfter)}:undefined};
    await rememberCapture(failed);
    return reply(failed);
  }
  if (!await rememberCapture(result)) return reply({status:503,body:{code:'access_unavailable'}});
  // A failed lookup still refunds the user's allowance. The new app can repair
  // its draft for free; provider rate limits still account for the real calls.
  if (result.status !== 200 || result.body.correctionRequired === true) {
    await refundAnalysis(context.supabaseAdmin, data.user.id, requestId);
    return reply(result);
  }

  const completed = await accessRpc(context.supabaseAdmin, 'complete_analysis_request', {
    p_user_id: data.user.id,
    p_request_id: requestId,
    p_result: result.body,
  });
  if (completed?.status !== 'completed') {
    // Do not refund a provider success: a transient commit failure must not
    // create an unlimited cost loop. The stale reservation expires after 15m.
    return reply({ status: 503, body: { code: 'access_unavailable', message: 'Die Analyse konnte nicht gespeichert werden.' } });
  }
  return reply(result);
});

export default {
  fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    return handler(request).catch((error: unknown) => {
      if (error instanceof Error && ['mass_required','amount_ambiguous','amount_out_of_range'].includes(error.message)) return reply({status:422,body:{code:error.message}});
      if (error instanceof ModelError) return reply({status:error.status,body:{code:error.code},headers:error.retryAfter ? {'Retry-After':String(error.retryAfter)} : undefined});
      const safeCode = safeGatewayFailureCode(error);
      const setupError = safeCode === 'ai_key_missing' || safeCode === 'ai_provider_invalid';
      // Logs receive only a fixed code. Provider bodies, prompts and model output
      // are never attached to exceptions and can therefore not enter Supabase logs.
      console.error('nutrition gateway failure', safeCode);
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
