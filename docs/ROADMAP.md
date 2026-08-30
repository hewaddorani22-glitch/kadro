# Roadmap

## Current status: Day 1 complete

- [x] Eight-step personalized onboarding
- [x] Today dashboard with derived calories and macros
- [x] Central full-screen camera flow with permission and demo states
- [x] Staged analyzing state
- [x] Detected-food confirmation and portion correction
- [x] Result screen with estimate, confidence, ingredients, and projected balance
- [x] Home, Supermarket, and Eating Out recommendation contexts
- [x] Exactly three suggestions per context
- [x] Progress and profile screens
- [x] Transparent mock paywall
- [x] Expo Go compatibility on SDK 54
- [x] TypeScript, Expo Doctor, web export, and iOS bundle checks

## Day 2: real meal intelligence

Priority order:

1. Define typed service interfaces for image analysis, nutrition lookup, and meal storage.
2. Add image resizing/compression and a temporary-upload boundary.
3. Return structured detected foods, portions, and confidence from a multimodal model.
4. Resolve normalized nutrition through USDA FoodData Central for fresh food.
5. Add Open Food Facts as the packaged-food and barcode source.
6. Preserve the existing confirmation UI as the correction layer.
7. Save the confirmed meal and reload Today from the repository.
8. Add retry, offline, unclear-image, and multiple-dish error states.

Acceptance criteria:

- A real photo produces editable structured ingredients rather than a single calorie guess.
- Nutrition values identify their source and remain explicitly estimated.
- The original image is deleted after analysis unless the user opted in to retention.
- Corrections change totals before persistence.
- A saved meal survives an application restart.
- The current mock service remains available for deterministic previews and development.

## Day 3: real Autopilot and accounts

- Supabase Auth and profile persistence
- Postgres meal, item, target, and recommendation records
- Remaining macro calculation on persisted data
- Structured recommendation generation with exactly three results
- Preference and rejection feedback
- RevenueCat subscription and restore flow
- PostHog product events and Sentry error reporting

## Day 4: launch quality

- Thirty representative meal tests
- Poor light, blurry, partial plate, multiple dishes, and no-network cases
- Accessibility and reduced-motion review
- Subscription restore and entitlement testing
- Privacy policy, terms, deletion flow, and medical disclaimer
- App Store screenshots, landing page, and TestFlight build

## Explicitly out of scope for v0.1

Workout tracking, steps, Apple Health, social feeds, friends, challenges, water tracking, AI chat, seven-day meal planning, grocery shopping, wearables, community, restaurant databases, and large recipe catalogs.
