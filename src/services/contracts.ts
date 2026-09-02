import { DailyTargets, Meal, MealContext, MealItem, MealSuggestion, Nutrition } from '@/types/nutrition';

export type MealAnalysisInput = {
  imageBase64: string;
  mimeType: 'image/jpeg';
  /** Language the detected title and ingredient names come back in. */
  language: 'de' | 'en';
  locale: string;
};

export type MealAnalysisResult = {
  title: string;
  confidence: 'high' | 'medium';
  items: MealItem[];
  warnings: string[];
};

export type AnalysisErrorKind = 'not-configured' | 'consent-required' | 'invalid-input' | 'offline' | 'unclear-image' | 'multiple-dishes' | 'product-not-found' | 'provider-error';

export type PendingAnalysis = MealAnalysisInput & {
  id: string;
  createdAt: string;
};

export interface MealAnalysisService {
  analyze(input: MealAnalysisInput): Promise<MealAnalysisResult>;
}

export interface NutritionLookupService {
  resolve(items: MealItem[]): Promise<MealItem[]>;
}

export interface MealRepository {
  list(date: string): Promise<Meal[]>;
  save(meal: Meal): Promise<void>;
  queueForRetry(analysis: PendingAnalysis): Promise<void>;
}

export type RecommendationInput = {
  context: MealContext;
  remaining: Nutrition;
  targets: DailyTargets;
  preferences: string[];
};

export interface RecommendationService {
  recommend(input: RecommendationInput): Promise<MealSuggestion[]>;
}
