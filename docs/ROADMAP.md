# Roadmap

## Current status: Day 2 implementation complete; credentialed device validation pending

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

The code path, mock path, gateway health endpoint, Open Food Facts lookup, catalog validator, TypeScript, Expo Doctor, and exports are automated or locally testable without credentials. One real-photo smoke test on an iPhone remains required after `OPENAI_API_KEY` and the Mac LAN URL are configured.

Acceptance criteria:

- A real photo produces editable structured ingredients rather than a single calorie guess.
- Nutrition values identify their source and remain explicitly estimated.
- The original image is deleted after analysis unless the user opted in to retention.
- Corrections change totals before persistence.
- A saved meal survives an application restart.
- The current mock service remains available for deterministic previews and development.
- Recommendation nutrition comes from the verified catalog, never from generated prose.

## Day 3: real Autopilot and accounts

- Supabase Auth and profile persistence
- Postgres meal, item, target, and recommendation records
- Remaining macro calculation on persisted data
- Structured recommendation generation with exactly three results
- Expand the verified German catalog toward 200 meals after schema and ranking validation
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
