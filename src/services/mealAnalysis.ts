import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { AnalysisErrorKind, MealAnalysisInput, MealAnalysisResult } from '@/services/contracts';
import { MealItem, Nutrition } from '@/types/nutrition';

const apiUrl = process.env.EXPO_PUBLIC_ANALYSIS_API_URL?.replace(/\/$/, '');

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
  return Boolean(apiUrl);
}

export async function prepareMealPhoto(photoUri: string): Promise<PreparedMealPhoto> {
  const result = await manipulateAsync(
    photoUri,
    [{ resize: { width: 1280 } }],
    { base64: true, compress: 0.72, format: SaveFormat.JPEG },
  );

  if (!result.base64) {
    throw new MealAnalysisError('provider-error', 'Das Foto konnte nicht vorbereitet werden.');
  }

  return {
    imageBase64: result.base64,
    locale: 'de-DE',
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
  if (!apiUrl) {
    throw new MealAnalysisError(
      'not-configured',
      'Der Analyse-Server ist lokal noch nicht konfiguriert.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v1/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    throw new MealAnalysisError('offline', 'Keine Verbindung. Der Scan wurde lokal vorgemerkt.');
  }

  const payload = (await response.json().catch(() => null)) as (MealAnalysisResult & { code?: string; message?: string }) | null;

  if (!response.ok) {
    const kind: AnalysisErrorKind = payload?.code === 'unclear_image'
      ? 'unclear-image'
      : payload?.code === 'multiple_dishes'
        ? 'multiple-dishes'
        : 'provider-error';
    throw new MealAnalysisError(kind, payload?.message ?? 'Die Analyse konnte nicht abgeschlossen werden.');
  }

  if (!payload?.items?.length) {
    throw new MealAnalysisError('unclear-image', 'Auf dem Foto wurde keine eindeutige Mahlzeit erkannt.');
  }

  return payload;
}

async function readAnalysisResponse(response: Response): Promise<MealAnalysisResult> {
  const payload = (await response.json().catch(() => null)) as (MealAnalysisResult & { code?: string; message?: string }) | null;
  if (!response.ok) {
    const kind: AnalysisErrorKind = payload?.code === 'unclear_image'
      ? 'unclear-image'
      : payload?.code === 'multiple_dishes'
        ? 'multiple-dishes'
        : 'provider-error';
    throw new MealAnalysisError(kind, payload?.message ?? 'Die Analyse konnte nicht abgeschlossen werden.');
  }
  if (!payload?.items?.length) throw new MealAnalysisError('unclear-image', 'Es wurde keine eindeutige Mahlzeit erkannt.');
  return payload;
}

export async function analyzeDescription(description: string): Promise<MealAnalysisResult> {
  if (!apiUrl) throw new MealAnalysisError('not-configured', 'Der Analyse-Server ist lokal noch nicht konfiguriert.');
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v1/describe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description.trim(), locale: 'de-DE' }),
    });
  } catch {
    throw new MealAnalysisError('offline', 'Keine Verbindung. Bitte versuche die Beschreibung später erneut.');
  }
  return readAnalysisResponse(response);
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
  if (!apiUrl) throw new MealAnalysisError('not-configured', 'Der Analyse-Server ist lokal noch nicht konfiguriert.');
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/v1/barcode/${encodeURIComponent(barcode)}`);
  } catch {
    throw new MealAnalysisError('offline', 'Keine Verbindung. Der Barcode konnte nicht nachgeschlagen werden.');
  }
  const payload = (await response.json().catch(() => null)) as BarcodePayload | null;
  if (!response.ok || !payload) {
    throw new MealAnalysisError('provider-error', payload?.message ?? 'Das Produkt wurde nicht gefunden.');
  }
  const nutrition = payload.per100g;
  if (![nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat].some((value) => value > 0)) {
    throw new MealAnalysisError('provider-error', 'Für dieses Produkt fehlen verwertbare Nährwerte.');
  }
  return {
    title: payload.name,
    confidence: 'high',
    warnings: ['Startwert pro 100 g – passe die tatsächlich gegessene Menge im nächsten Schritt an.'],
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
