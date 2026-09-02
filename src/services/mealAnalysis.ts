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

/**
 * The gateway's own message is German: it is one deployed function serving
 * every language. Translate by code here so the user reads their own language
 * without a redeploy, and fall back to the server text only for a code we do
 * not know yet.
 */
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
    unclear_image: t.noClearMeal,
    server_not_configured: t.analysisNotConfigured,
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
  const result = await manipulateAsync(
    photoUri,
    [{ resize: { width: 1600 } }],
    { base64: true, compress: 0.82, format: SaveFormat.JPEG },
  );

  if (!result.base64) {
    throw new MealAnalysisError('provider-error', getDictionary().errors.photoNotPrepared);
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
          : 'provider-error';
    throw new MealAnalysisError(kind, gatewayMessage(payload?.code, payload?.message));
  }
  if (!payload?.items?.length) throw new MealAnalysisError('unclear-image', getDictionary().errors.noClearMeal);
  return payload;
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
  per100g: Nutrition;
  source: MealItem['source'];
  code?: string;
  message?: string;
};

export async function analyzeBarcode(barcode: string): Promise<MealAnalysisResult> {
  const response = await gatewayFetch(`/v1/barcode/${encodeURIComponent(barcode)}`);
  const payload = (await response.json().catch(() => null)) as BarcodePayload | null;
  if (!response.ok || !payload) {
    throw new MealAnalysisError('provider-error', gatewayMessage(payload?.code, payload?.message));
  }
  // Whether values exist is decided by the gateway, which sees the raw record.
  // Checking for a positive number here rejected every genuinely zero-calorie
  // product: diet drinks, sparkling water, sugar-free gum.
  const nutrition = payload.per100g;
  return {
    title: payload.name,
    confidence: 'high',
    warnings: [getDictionary().errors.portionStartValue],
    items: [{
      id: `barcode-${payload.barcode}`,
      name: payload.name,
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
