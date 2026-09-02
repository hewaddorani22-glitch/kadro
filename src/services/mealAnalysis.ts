import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { AnalysisErrorKind, MealAnalysisInput, MealAnalysisResult } from '@/services/contracts';
import {
  functionsBaseUrl,
  getAccessToken,
  isSupabaseConfigured,
  supabaseAnonKey,
} from '@/services/supabaseClient';
import { MealItem, Nutrition } from '@/types/nutrition';
import { getDictionary, getLanguage, getLocale } from '@/i18n/active';

/**
 * Optional local override for development. When it is unset the app talks to
 * the hosted Supabase edge function, which is what production builds do: the
 * provider keys live there, never on the device.
 */
const localApiUrl = process.env.EXPO_PUBLIC_ANALYSIS_API_URL?.replace(/\/$/, '');
const MAX_IMAGE_BASE64 = 3_000_000;

/**
 * The gateway's own message is German: it is one deployed function serving
 * every language. Translate by code here so the user reads their own language
 * without a redeploy, and fall back to the server text only for a code we do
 * not know yet.
 */
/**
 * The gateway returns codes for its warnings and for an ingredient it could
 * not price, so the wording comes from the dictionary and a language fix never
 * needs a redeploy. An unknown code is dropped rather than shown raw.
 */
function localizeResult(result: MealAnalysisResult): MealAnalysisResult {
  const t = getDictionary().errors;
  const warnings: Record<string, string> = {
    unmatched_ingredient: t.warnUnmatched,
    hidden_calories: t.warnHiddenCalories,
    wide_portion: t.warnWidePortion,
  };
  const sources: Record<string, string> = { unmatched: t.sourceUnmatched };
  return {
    ...result,
    warnings: (result.warnings ?? []).map((entry) => warnings[entry] ?? entry).filter(Boolean),
    items: (result.items ?? []).map((item) => {
      const code = (item.source as { code?: string } | undefined)?.code;
      return code && sources[code]
        ? { ...item, source: { ...item.source, label: sources[code] } }
        : item;
    }),
  };
}

function gatewayMessage(code: string | undefined, fallback: string | undefined) {
  const t = getDictionary().errors;
  const byCode: Record<string, string> = {
    invalid_input: t.gatewayInvalidInput,
    invalid_barcode: t.gatewayInvalidBarcode,
    product_not_found: t.gatewayProductNotFound,
    missing_nutrition: t.gatewayMissingNutrition,
    unauthorized: t.gatewayUnauthorized,
    provider_error: t.gatewayProviderError,
    daily_limit_reached: t.gatewayDailyLimit,
    consent_required: t.gatewayConsentRequired,
    unclear_image: t.noClearMeal,
    multiple_dishes: t.gatewayMultipleDishes,
    server_not_configured: t.analysisNotConfigured,
    // Routing faults a user should never reach; the raw German would be worse.
    method_not_allowed: t.gatewayUnexpected,
    not_found: t.gatewayUnexpected,
  };
  return (code && byCode[code]) || fallback || t.analysisFailed;
}

export class MealAnalysisError extends Error {
  constructor(
    public readonly kind: AnalysisErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'MealAnalysisError';
  }
}

export type PreparedMealPhoto = MealAnalysisInput & {
  previewUri: string;
};

export function isLiveAnalysisConfigured() {
  return Boolean(localApiUrl || (isSupabaseConfigured && functionsBaseUrl));
}

/**
 * Sends one gateway request. Network failures surface as `offline` so the
 * caller can queue a photo; everything else is decided by the response body.
 */
async function gatewayFetch(path: string, init?: { method: 'POST'; body: unknown }): Promise<Response> {
  if (localApiUrl) {
    try {
      return await fetch(`${localApiUrl}${path}`, init ? {
        method: init.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(init.body),
      } : undefined);
    } catch {
      throw new MealAnalysisError('offline', getDictionary().errors.noConnection);
    }
  }

  if (!functionsBaseUrl || !supabaseAnonKey) {
    throw new MealAnalysisError('not-configured', getDictionary().errors.analysisNotConfigured);
  }

  const accessToken = await getAccessToken().catch(() => null);
  if (!accessToken) {
    throw new MealAnalysisError('offline', getDictionary().errors.sessionUnavailable);
  }

  try {
    return await fetch(`${functionsBaseUrl}/nutrition${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
        ...(init ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    throw new MealAnalysisError('offline', getDictionary().errors.noConnection);
  }
}

export async function prepareMealPhoto(photoUri: string): Promise<PreparedMealPhoto> {
  const passes = [
    { width: 1600, compress: 0.82 },
    { width: 1280, compress: 0.68 },
    { width: 1024, compress: 0.55 },
  ];
  let result = await manipulateAsync(photoUri, [{ resize: { width: passes[0].width } }], {
    base64: true,
    compress: passes[0].compress,
    format: SaveFormat.JPEG,
  });

  for (const pass of passes.slice(1)) {
    if (result.base64 && result.base64.length <= MAX_IMAGE_BASE64) break;
    const oversizedUri = result.uri;
    result = await manipulateAsync(photoUri, [{ resize: { width: pass.width } }], {
      base64: true,
      compress: pass.compress,
      format: SaveFormat.JPEG,
    });
    deleteTemporaryPhoto(oversizedUri);
  }

  if (!result.base64) {
    throw new MealAnalysisError('provider-error', getDictionary().errors.photoNotPrepared);
  }
  if (result.base64.length > MAX_IMAGE_BASE64) {
    deleteTemporaryPhoto(result.uri);
    throw new MealAnalysisError('invalid-input', getDictionary().errors.gatewayPhotoTooLarge);
  }

  return {
    imageBase64: result.base64,
    // The gateway writes the dish title and the ingredient names in this
    // language; the USDA search term stays English either way.
    language: getLanguage(),
    locale: getLocale(),
    mimeType: 'image/jpeg',
    previewUri: result.uri,
  };
}

export function deleteTemporaryPhoto(uri: string | null | undefined) {
  if (!uri?.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Camera cache cleanup is best effort and must not break the correction flow.
  }
}

export async function analyzePreparedPhoto(input: MealAnalysisInput): Promise<MealAnalysisResult> {
  return readAnalysisResponse(await gatewayFetch('/v1/analyze', { method: 'POST', body: input }));
}

async function readAnalysisResponse(response: Response): Promise<MealAnalysisResult> {
  const payload = (await response.json().catch(() => null)) as (MealAnalysisResult & { code?: string; message?: string }) | null;
  if (!response.ok) {
    const kind: AnalysisErrorKind = payload?.code === 'unclear_image'
      ? 'unclear-image'
      : payload?.code === 'multiple_dishes'
        ? 'multiple-dishes'
        : payload?.code === 'server_not_configured'
          ? 'not-configured'
          : payload?.code === 'consent_required'
            ? 'consent-required'
            : payload?.code === 'invalid_input'
              ? 'invalid-input'
          : 'provider-error';
    throw new MealAnalysisError(kind, gatewayMessage(payload?.code, payload?.message));
  }
  if (!payload?.items?.length) throw new MealAnalysisError('unclear-image', getDictionary().errors.noClearMeal);
  return localizeResult(payload);
}

export async function analyzeDescription(description: string): Promise<MealAnalysisResult> {
  return readAnalysisResponse(await gatewayFetch('/v1/describe', {
    method: 'POST',
    body: { description: description.trim(), language: getLanguage(), locale: getLocale() },
  }));
}

type BarcodePayload = {
  barcode: string;
  name: string;
  /** The record carried no usable name; the wording comes from the dictionary. */
  nameMissing?: boolean;
  per100g: Nutrition;
  source: MealItem['source'];
  code?: string;
  message?: string;
};

export async function analyzeBarcode(barcode: string): Promise<MealAnalysisResult> {
  const response = await gatewayFetch(`/v1/barcode/${encodeURIComponent(barcode)}?language=${getLanguage()}`);
  const payload = (await response.json().catch(() => null)) as BarcodePayload | null;
  if (!response.ok || !payload) {
    // A barcode the database does not know will not start knowing it on a
    // retry, so this needs its own kind and its own way out.
    const kind: AnalysisErrorKind = payload?.code === 'product_not_found' || payload?.code === 'missing_nutrition'
      ? 'product-not-found'
      : 'provider-error';
    throw new MealAnalysisError(kind, gatewayMessage(payload?.code, payload?.message));
  }
  // Whether values exist is decided by the gateway, which sees the raw record.
  // Checking for a positive number here rejected every genuinely zero-calorie
  // product: diet drinks, sparkling water, sugar-free gum.
  const nutrition = payload.per100g;
  // An unnamed product used to arrive as the German "Verpacktes Lebensmittel"
  // from the gateway, regardless of who was reading it.
  const name = payload.nameMissing || !payload.name
    ? getDictionary().errors.packagedFood
    : payload.name;
  return {
    title: name,
    confidence: 'high',
    warnings: [getDictionary().errors.portionStartValue],
    items: [{
      id: `barcode-${payload.barcode}`,
      name,
      amountG: 100,
      baseAmountG: 100,
      portionFactor: 1,
      confidence: 'high',
      included: true,
      source: payload.source,
      ...nutrition,
    }],
  };
}

export type FoodSearchResult = {
  id: string;
  name: string;
  per100g: Nutrition;
  defaultGrams: number;
  source: MealItem['source'];
};

/**
 * Free-text food search.
 *
 * No model call and no quota: logging a banana should not spend one of three
 * free analyses, and should not take five seconds. That is also why this is
 * the cheapest path for us — every search is a lookup the AI never has to do.
 */
export async function searchFoods(query: string): Promise<FoodSearchResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const response = await gatewayFetch(
    `/v1/search?q=${encodeURIComponent(term)}&language=${getLanguage()}`,
  );
  const payload = (await response.json().catch(() => null)) as
    { results?: FoodSearchResult[]; code?: string; message?: string } | null;
  if (!response.ok) {
    throw new MealAnalysisError('provider-error', gatewayMessage(payload?.code, payload?.message));
  }
  return payload?.results ?? [];
}

/**
 * Turns a chosen search result into a meal the rest of the app already knows
 * how to handle — same shape as a scanned one, so the timeline, the cloud sync
 * and the ingredient list need no special case.
 */
export function mealFromSearch(result: FoodSearchResult, grams: number): MealAnalysisResult {
  const factor = grams / 100;
  const scale = (value: number) => Math.round(value * factor);
  return {
    title: result.name,
    confidence: 'high',
    warnings: [],
    items: [{
      id: `search-${result.id}`,
      name: result.name,
      amountG: grams,
      baseAmountG: grams,
      portionFactor: 1,
      calories: scale(result.per100g.calories),
      protein: scale(result.per100g.protein),
      carbs: scale(result.per100g.carbs),
      fat: scale(result.per100g.fat),
      fiber: scale(result.per100g.fiber ?? 0),
      confidence: 'high',
      included: true,
      source: result.source,
    }],
  };
}
