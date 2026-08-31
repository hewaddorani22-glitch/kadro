# Roadmap

## Current status: Day 2 complete; Day 3 cloud foundation live on Supabase

- [x] Kadro name, mark, app icon, and exact brand tokens
- [x] German product UI
- [x] Six-step personalized onboarding with visible wellness guardrails
- [x] Today dashboard with derived calories and macros
- [x] Central full-screen camera flow with permission and demo states
- [x] Staged analyzing state
- [x] Detected-food confirmation with one-tap meal sizing and optional gram correction
- [x] Result sequence with estimate count-up, remaining count-down, confidence, and reduced-motion support
- [x] Zuhause, Supermarkt, and Unterwegs recommendation contexts
- [x] Exactly three suggestions per context
- [x] Progress and profile screens
- [x] Transparent mock paywall
- [x] Expo Go compatibility on SDK 54
- [x] TypeScript, Expo Doctor, web export, and iOS bundle checks
- [x] Typed service contracts for analysis, nutrition lookup, persistence, retry, and recommendations
- [x] Credentialed real-photo smoke test on an iPhone with OpenRouter and USDA

## Day 2: real meal intelligence

Priority order:

1. [x] Add image resizing/compression and a temporary-upload boundary.
2. [x] Return structured detected foods, portions, and confidence from a multimodal model.
3. [x] Resolve normalized nutrition through USDA FoodData Central for fresh food.
4. [x] Add Open Food Facts as the packaged-food and barcode source.
5. [x] Preserve the existing confirmation UI as the correction layer.
6. [x] Save the confirmed meal and reload Today from the repository.
7. [x] Add a local-first retry queue plus unclear-image and multiple-dish error states.
8. [x] Seed 45 reviewed German meal estimates and rank exactly three deterministically by context, remaining macros, and preferences.

The code path, mock path, gateway health endpoint, Open Food Facts lookup, catalog validator, TypeScript, Expo Doctor, exports, and one credentialed real-photo iPhone smoke test are complete.

Acceptance criteria:

- A real photo produces editable structured ingredients rather than a single calorie guess.
- Nutrition values identify their source and remain explicitly estimated.
- The original image is deleted after analysis unless the user opted in to retention.
- Corrections change totals before persistence.
- A saved meal survives an application restart.
- The current mock service remains available for deterministic previews and development.
- Recommendation nutrition comes from the verified catalog, never from generated prose.

## Day 3: real Autopilot and accounts

- [x] Optional Supabase client with persisted React Native session and anonymous authenticated bootstrap
- [x] Postgres profile, target, meal, item, recommendation, and feedback migration
- [x] RLS, least-privilege grants, constraints, and user/date indexes on every exposed table
- [x] Local-first confirmed-meal persistence with background cloud synchronization
- [x] Remaining macro calculation from cloud-hydrated targets and meals
- [x] Exactly three deterministic catalog recommendations from the persisted daily state
- [x] Structured recommendation impressions plus acceptance/rejection feedback adapter
- [x] Create the dedicated Kadro Supabase project, enable anonymous auth, apply the migration, and run live RLS tests
- [x] Link an authorized Supabase CLI profile and reconcile the dashboard-applied migration with CLI migration history
- [x] Run the cloud-hydration smoke test in Expo Go and verify the persisted anonymous session after an app restart
- [ ] Add permanent account linking with email or Apple before public launch
- [x] Expand the verified German catalog from 45 to 200 meals after live schema and ranking validation
- [ ] RevenueCat subscription and restore flow
- [ ] PostHog product events and Sentry error reporting

## Day 4: launch quality

- Thirty representative meal tests
- Poor light, blurry, partial plate, multiple dishes, and no-network cases
- Accessibility and reduced-motion review
- Subscription restore and entitlement testing
- Privacy policy, terms, deletion flow, and medical disclaimer
- App Store screenshots, landing page, and TestFlight build

## Explicitly out of scope for v0.1

Workout tracking, steps, Apple Health, social feeds, friends, challenges, water tracking, AI chat, seven-day meal planning, grocery shopping, wearables, community, restaurant databases, and large recipe catalogs.
