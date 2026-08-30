import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { AnalysisErrorKind, MealAnalysisInput, MealAnalysisResult } from '@/services/contracts';

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

