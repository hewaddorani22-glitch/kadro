# Architecture

## Product loop

```text
Onboarding
   ↓
Today dashboard
   ↓
Camera / demo capture
   ↓
Local resize/compression
   ↓
Local analysis gateway → vision detection → nutrition lookup
   ↓
Analyzing / retry state
   ↓
Detected-food confirmation
   ↓
Local save → optional Supabase sync (Auth + RLS)
   ↓
Meal result + projected daily balance
   ↓
Three contextual next-meal suggestions
   ↓
RevenueCat-backed paywall / safe preview fallback
```

The application deliberately keeps this loop narrow. New features should strengthen it before expanding into unrelated fitness functionality.

## Navigation

Expo Router uses `src/app` as the route root.

- `src/app/_layout.tsx`: root stack and application providers.
- `src/app/index.tsx`: initial redirect to onboarding.
- `src/app/onboarding.tsx`: six-step local German onboarding flow.
- `src/app/(tabs)/_layout.tsx`: Today, Plan, Scan, Progress, and Profile tabs.
- `src/app/(tabs)/scan.tsx`: camera preview and demo capture fallback.
- `src/app/analyzing.tsx`: staged mock analysis animation.
- `src/app/confirm.tsx`: ingredient inclusion, one-tap meal portion sizing, and optional gram-level correction.
- `src/app/result.tsx`: animated meal estimate, projected remaining targets, and delayed recommendation reveal.
- `src/app/paywall.tsx`: transparent annual/monthly choice backed by RevenueCat Offering prices, purchase, and user-triggered restore.
- `src/components/AccountLinkCard.tsx`: anonymous account upgrade, email verification, password setup, and existing-account recovery from Profile.

Root stack routes sit above the tab navigator so camera analysis, confirmation, result, and paywall can focus the user on one step.

## State and calculations

`AppProvider` owns active UI state, hydrates local storage first, and then optionally reconciles with Supabase:

- user targets;
- logged meals;
- detected meal items;
- temporary compressed photo URI;
- current analysis status and local retry count;
- derived consumed and remaining nutrition.
- current quick portion selection (`0.7×`, `1×`, or `1.4×`; `null` after custom gram edits).
- sync state (`local`, `syncing`, `cloud`, or `error`).

`mockNutrition.ts` owns the deterministic scan fixture and pure calculations:

- `nutritionFromItems` totals included detected items;
- `createScannedMeal` maps corrected items into a meal;
- `sumMeals` derives daily consumption;
- `getRemaining` derives the daily balance;

`recommendations.ts` scores the 200-entry German catalog by context and the user's remaining calories, protein, and fat. It sorts deterministically and returns exactly three entries; no model invents nutrition values. The catalog validator enforces balanced context coverage, known preference tags, plausible nutrition ranges, calorie-to-macro consistency, and 90 deterministic recommendation sets across 30 budget/preference scenarios.

Screens must not maintain separate copies of these totals.

## Integration seams

The typed interfaces already live in `src/services/contracts.ts` and are the boundary for the next backend implementation:

```ts
MealAnalysisService
NutritionLookupService
MealRepository
RecommendationService
```

Current responsibilities:

- `mealAnalysis.ts`: client-side compression, temporary-file cleanup, gateway calls, and typed errors.
- `server/index.mjs`: secret-bearing local gateway. OpenRouter or direct OpenAI returns food identity, portion estimate, and confidence only; USDA provides normalized calories and macros; Open Food Facts provides packaged-food barcode data. OpenRouter routing requires supported parameters, denies data collection, and defaults to ZDR.
- `localRepository.ts`: confirmed meals and a maximum-three local retry queue in AsyncStorage.
- `supabaseClient.ts`: optional public-client initialization, persisted React Native sessions, foreground token refresh, and anonymous authenticated bootstrap.
- `accountLinking.ts`: ID-preserving email upgrade with `updateUser`, email-change verification, password setup, and existing-account sign-in.
- `cloudRepository.ts`: maps Kadro domain records to RLS-protected Supabase rows and records recommendation feedback.
- `syncRepository.ts`: preserves local-first writes, uploads pending local scans during hydration, and merges cloud meals back into domain state.
- `subscription.ts` + `SubscriptionContext.tsx`: platform/Test Store key selection, Supabase-user identity, current Offering, `kadro_pro` entitlement state, purchase cancellation, and user-triggered restore. Without public SDK configuration, the paywall remains a clearly labeled non-billing preview.
- `telemetry.ts`: optional PostHog client with a typed event allowlist, anonymous-only profiles, no health-value properties, persisted opt-in/out, and scrubbed operational error capture. It is a no-op when the public project token is absent.
- `recommendations.ts`: deterministic scoring over the reviewed German MVP catalog.

Raw provider payloads should be mapped to the domain types in `src/types/nutrition.ts` before reaching React components.

## Privacy boundary

The current local development pipeline:

1. resizes to 1280 px and compresses to JPEG locally;
2. deletes the camera original after the compressed working copy exists;
3. sends the working copy only to the configured local gateway;
4. keeps at most three failed scans locally for explicit retry;
5. persists only the user-confirmed structured meal;
6. never retains photos as part of saved meal records.

The compressed preview lives only in the app cache during the active flow. A production-hosted gateway still needs a documented retention/deletion policy, provider disclosure, authentication, rate limiting, and explicit consent before launch.

Product analytics never receives photos, food or ingredient names, email addresses, Supabase user IDs, calories, macros, weights, or goals. Only the events and categorical properties documented in `docs/ANALYTICS.md` are accepted by the client. PostHog person profiles, GeoIP, automatic lifecycle/touch/screen capture, feature flags, push capture, and session replay are disabled. The user can persistently opt out from Profile.

During Expo Go testing, the root React error boundary and explicitly caught integration failures report scrubbed JavaScript errors through PostHog. Native Sentry crash reporting is reserved for the development/TestFlight build because the official React Native SDK includes native iOS and Android code that Expo Go does not bundle.

## Supabase ownership boundary

The mobile app receives only the project URL and publishable key. Supabase Auth supplies a per-user JWT, and Postgres RLS limits every row to `(select auth.uid()) = user_id`. The client never receives a secret or `service_role` key. `profiles`, `daily_targets`, `meals`, `meal_items`, `recommendations`, and `recommendation_feedback` all enable RLS and revoke access from the unauthenticated `anon` role.

Anonymous sign-in is used to avoid blocking the first scan. It is an authenticated Supabase user, not unauthenticated public database access. The Profile account card upgrades it with a verified email through `updateUser`, verifies that the returned identity still has the same user ID, and then lets the user set a password. Existing accounts can sign back in and rehydrate their RLS-owned cloud data. Clearing app data before the upgrade can still make an anonymous account inaccessible.
