/**
 * The nutrition mapping rules live next to the edge function so the deployed
 * gateway and the local development server can never drift apart.
 * This file only re-exports them for Node consumers.
 */
export {
  buildAccuracyWarnings,
  buildMealItem,
  chooseFood,
  chooseFoodMatch,
  classifyDetection,
  mapUsdaFood,
  normalizeSearchTerm,
  nutrient,
  toFoodFacts,
  usdaCacheKey,
  USDA_MATCHER_VERSION,
  validateAnalysisInput,
} from '../supabase/functions/_shared/nutrition.mjs';

export {
  BLS_REFERENCE_KEYS,
  BLS_REFERENCE_MEALS,
  BLS_SOURCE,
  getBlsReference,
  resolveBlsFacts,
} from '../supabase/functions/_shared/bls-reference.mjs';

export {
  descriptionDetectionPrompt,
  detectionSchema,
  photoDetectionPrompt,
} from '../supabase/functions/_shared/detection.mjs';
