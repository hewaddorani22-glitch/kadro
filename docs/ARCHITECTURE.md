# Architecture

## Product loop

```text
Onboarding
   ↓
Today dashboard
   ↓
Camera / demo capture
   ↓
Analyzing state
   ↓
Detected-food confirmation
   ↓
Meal result + projected daily balance
   ↓
Three contextual next-meal suggestions
   ↓
Mock paywall / back to Today
```

The application deliberately keeps this loop narrow. New features should strengthen it before expanding into unrelated fitness functionality.

## Navigation

Expo Router uses `src/app` as the route root.

- `src/app/_layout.tsx`: root stack and application providers.
- `src/app/index.tsx`: initial redirect to onboarding.
- `src/app/onboarding.tsx`: eight-step local onboarding flow.
- `src/app/(tabs)/_layout.tsx`: Today, Plan, Scan, Progress, and Profile tabs.
- `src/app/(tabs)/scan.tsx`: camera preview and demo capture fallback.
- `src/app/analyzing.tsx`: staged mock analysis animation.
- `src/app/confirm.tsx`: ingredient inclusion and portion correction.
- `src/app/result.tsx`: meal estimate and projected remaining targets.
- `src/app/paywall.tsx`: transparent mock subscription choice.

Root stack routes sit above the tab navigator so camera analysis, confirmation, result, and paywall can focus the user on one step.

## State and calculations

`AppProvider` owns the current in-memory state:

- user targets;
- logged meals;
- detected meal items;
- temporary captured photo URI;
- derived consumed and remaining nutrition.

`mockNutrition.ts` owns fixture data and pure calculations:

- `nutritionFromItems` totals included detected items;
- `createScannedMeal` maps corrected items into a meal;
- `sumMeals` derives daily consumption;
- `getRemaining` derives the daily balance;
- `SUGGESTIONS` supplies exactly three options per context.

Screens must not maintain separate copies of these totals.

## Integration seams

The next backend implementation should introduce interfaces without changing screen props:

```ts
interface MealAnalysisService {
  analyze(photoUri: string): Promise<DetectedMeal>;
}

interface NutritionLookupService {
  resolve(items: DetectedFood[]): Promise<MealItem[]>;
}

interface MealRepository {
  save(meal: Meal): Promise<void>;
  listForDay(date: string): Promise<Meal[]>;
}

interface RecommendationService {
  getThree(input: RecommendationInput): Promise<MealSuggestion[]>;
}
```

Suggested responsibilities:

- Vision provider: food identity, portion estimate, and confidence only.
- USDA/Open Food Facts adapter: normalized calories and macros.
- Supabase repository: profiles, targets, meals, items, and recommendations.
- RevenueCat adapter: entitlement state and purchase/restore actions.

Raw provider payloads should be mapped to the domain types in `src/types/nutrition.ts` before reaching React components.

## Privacy boundary

The captured `photoUri` currently remains local and temporary. A real pipeline should:

1. compress the image locally;
2. upload only for analysis;
3. delete the remote original immediately after processing;
4. persist structured results only;
5. require an explicit opt-in before retaining meal photos.

Document retention, deletion, provider processing, and consent before enabling any production upload.
