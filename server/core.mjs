/**
 * The nutrition mapping rules live next to the edge function so the deployed
 * gateway and the local development server can never drift apart.
 * This file only re-exports them for Node consumers.
 */
export {
  chooseFood,
  classifyDetection,
  mapUsdaFood,
  nutrient,
  validateAnalysisInput,
} from '../supabase/functions/_shared/nutrition.mjs';
