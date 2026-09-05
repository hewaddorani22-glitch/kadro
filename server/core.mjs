/**
 * The nutrition mapping rules live next to the edge function so the deployed
 * gateway and the local development server can never drift apart.
 * This file only re-exports them for Node consumers.
 */
export {
  buildAccuracyWarnings,
  buildMealItem,
  incompleteNutritionError,
  chooseFood,
  chooseFoodMatch,
  isUsableSearchTerm,
  classifyDetection,
  mapUsdaFood,
  normalizeSearchTerm,
  nutrient,
  rankFoodMatches,
  requestedLanguage,
  safeGatewayFailureCode,
  searchTermVariants,
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
  getBlsReferenceByCode,
  resolveBlsFacts,
  searchBlsReferences,
} from '../supabase/functions/_shared/bls-reference.mjs';

export { searchBlsCatalog } from '../supabase/functions/_shared/bls-search.mjs';

export {
  descriptionDetectionPrompt,
  detectionSchema,
  photoDetectionPrompt,
} from '../supabase/functions/_shared/detection.mjs';
