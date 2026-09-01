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
          'nameDe', 'searchTermEn', 'referenceKey', 'estimatedGrams',
          'estimatedGramsLow', 'estimatedGramsHigh', 'preparation',
          'hiddenCaloriesRisk', 'confidence', 'optional',
        ],
        properties: {
          nameDe: { type: 'string' },
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

const accuracyRules = `
Arbeite konservativ und gib niemals Nährwerte aus.
- referenceKey: Wähle einen BLS-Schlüssel nur, wenn das komplette erkannte Item genau diesem zusammengesetzten Gericht entspricht. Dann zerlege es nicht zusätzlich. Sonst referenceKey=other.
- Bei referenceKey=other: Zerlege die Mahlzeit in sichtbare, ernährungsrelevante Zutaten. Suche dafür kurze präzise englische USDA-Begriffe inklusive Zubereitung, z. B. "chicken breast grilled" statt "chicken".
- Berücksichtige Panade, Käse, Dressing, Sauce und wahrscheinlich verwendetes Bratöl. Unsichtbares Öl oder unklare Sauce erhält hiddenCaloriesRisk=high und confidence=medium.
- estimatedGrams ist die beste Schätzung. estimatedGramsLow und estimatedGramsHigh bilden den kleinsten realistischen Bereich und müssen low <= best <= high erfüllen.
- Nutze Tellergröße, Schichtdicke, Stückzahl und typische Portionsgrößen. Verwechsle Volumen nicht mit Gewicht.

Verfügbare BLS-Komplettgerichte:
${BLS_MODEL_CATALOG}`.trim();

export function photoDetectionPrompt() {
  return `Analysiere genau eine sichtbare Mahlzeit. Erkenne nur Lebensmittel, die sichtbar oder durch die Zubereitung sehr wahrscheinlich sind. Bei Unschärfe clarity=unclear; bei mehreren getrennten Tellern dishCount>1. ${accuracyRules}`;
}

export function descriptionDetectionPrompt(description) {
  return `Strukturiere genau die beschriebene Mahlzeit. Übernimm genannte Grammzahlen exakt und erfinde keine nicht genannten Lebensmittel. Unklare Mengen oder Saucen erhalten medium confidence bzw. optional=true. ${accuracyRules}\n\nBeschreibung: ${description}`;
}
