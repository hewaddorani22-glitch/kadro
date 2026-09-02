import { BLS_MODEL_CATALOG, BLS_REFERENCE_KEYS } from './bls-reference.mjs';

export const detectionSchema = {
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
        required: [
          'name', 'searchTermEn', 'referenceKey', 'estimatedGrams',
          'estimatedGramsLow', 'estimatedGramsHigh', 'preparation',
          'hiddenCaloriesRisk', 'confidence', 'optional',
        ],
        properties: {
          name: { type: 'string' },
          searchTermEn: { type: 'string' },
          referenceKey: { type: 'string', enum: [...BLS_REFERENCE_KEYS, 'other'] },
          estimatedGrams: { type: 'integer', minimum: 5, maximum: 2000 },
          estimatedGramsLow: { type: 'integer', minimum: 5, maximum: 2000 },
          estimatedGramsHigh: { type: 'integer', minimum: 5, maximum: 2000 },
          preparation: {
            type: 'string',
            enum: ['raw', 'boiled', 'steamed', 'fried', 'grilled', 'baked', 'mixed', 'unknown'],
          },
          hiddenCaloriesRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
          confidence: { type: 'string', enum: ['high', 'medium'] },
          optional: { type: 'boolean' },
        },
      },
    },
  },
};

/**
 * `title` and `name` are shown to the user, so they follow the app's language.
 * `searchTermEn` is not display text — it is the USDA query — and stays
 * English whatever the user speaks. The BLS keys stay German because they are
 * the names of the database entries we are licensed to credit.
 */
const OUTPUT_LANGUAGES = { de: 'German', en: 'English' };

function languageRule(language) {
  const label = OUTPUT_LANGUAGES[language] ?? OUTPUT_LANGUAGES.en;
  return [
    `"title" and every item "name" are shown to the user: write them in ${label} as a natural food name, e.g. "grilled chicken breast", not as a database query.`,
    '"searchTermEn" is a USDA FoodData Central query and is always English, whatever the display language.',
    'Never put "other" or a referenceKey value into "searchTermEn": it must always name the actual food, e.g. "chicken breast grilled". "other" belongs in "referenceKey" alone.',
  ].join(' ');
}

const accuracyRules = `
Work conservatively and never output nutrition values.
- referenceKey: pick a BLS key only when the whole detected item is exactly that composed dish. In that case do not break it down further. Otherwise referenceKey=other.
- With referenceKey=other: break the meal into visible, nutritionally relevant ingredients. Use short, precise English USDA terms including the preparation, e.g. "chicken breast grilled" rather than "chicken".
- Account for breading, cheese, dressing, sauce and the frying oil likely used. Invisible oil or an unclear sauce gets hiddenCaloriesRisk=high and confidence=medium.
- estimatedGrams is the best estimate. estimatedGramsLow and estimatedGramsHigh form the smallest realistic range and must satisfy low <= best <= high.
- Use plate size, layer thickness, piece count and typical portion sizes. Do not confuse volume with weight.

Available BLS complete dishes:
${BLS_MODEL_CATALOG}`.trim();

export function photoDetectionPrompt(language = 'en') {
  return `Analyse exactly one visible meal. Detect only foods that are visible or very likely from the preparation. If the image is blurred, clarity=unclear; with several separate plates, dishCount>1. ${languageRule(language)} ${accuracyRules}`;
}

export function descriptionDetectionPrompt(description, language = 'en') {
  return `Structure exactly the meal described. Take stated gram amounts verbatim and do not invent foods that were not named. Unclear amounts or sauces get medium confidence or optional=true. ${languageRule(language)} ${accuracyRules}\n\nDescription: ${description}`;
}
