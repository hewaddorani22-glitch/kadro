# Agent guide

This repository contains the Kadro mobile MVP: photograph a meal, confirm the estimate, see the remaining daily nutrition budget, and get three practical next-meal suggestions. The product line is “Die Aufstellung deines Tages.”

## Start here

1. Read this file completely.
2. Read `README.md`, `docs/ARCHITECTURE.md`, and `docs/ROADMAP.md`.
3. Inspect `git status` before editing. Preserve user work and unrelated changes.
4. Run `npm install` and `npm run verify` before handing work back.

## Expo version constraint

The project intentionally uses Expo SDK 54 because it must open in the current App Store build of Expo Go. Read the exact versioned documentation at https://docs.expo.dev/versions/v54.0.0/ before changing Expo APIs or native dependencies.

Do not upgrade Expo, React, React Native, Expo Router, or other native packages independently. Use `npx expo install <package>` and finish with `npm run doctor`. A future SDK upgrade must be an explicit, isolated migration.

## Repository map

- `src/app/`: Expo Router route files only. Root stack screens live here; the five primary tabs live in `src/app/(tabs)/`.
- `src/components/`: reusable visual components. Extend these before duplicating card, button, progress, badge, or photo patterns.
- `src/components/KadroMark.tsx`: reusable vector brand mark used in the application UI.
- `src/constants/theme.ts`: the design tokens and source of truth for color, spacing, radii, and shadows.
- `src/context/AppContext.tsx`: temporary in-memory application state and derived daily nutrition values.
- `src/services/mockNutrition.ts`: the current mock service boundary. Real data sources should replace or sit behind this layer, not leak into UI components.
- `src/services/contracts.ts`: typed interfaces for analysis, nutrition lookup, persistence, retry, and recommendations.
- `src/types/nutrition.ts`: shared domain types.
- `docs/ARCHITECTURE.md`: data flow and extension seams.
- `docs/ROADMAP.md`: completed scope, next priorities, and acceptance criteria.

## Product invariants

- The core loop is `onboarding → scan → analyze → confirm → result → replan → three options`.
- The app is an adaptive decision system, not a conventional food diary or seven-day meal planner.
- Always communicate nutrition as an estimate. Preserve confidence labels and easy ingredient/portion correction.
- Never introduce guilt, punishment, medical diagnosis, treatment claims, or eating-disorder guidance.
- The user-facing UI is German. Keep internal domain identifiers stable when translating copy.
- The recommendation screen returns exactly three contextual options for Zuhause, Supermarkt, or Unterwegs.
- Meal photos are temporary by default. Do not persist or upload originals without an explicit privacy decision and deletion policy.
- Keep the central Scan action visually dominant and available from the primary navigation.
- Preserve the Kadro visual system: `#F5F3EE` canvas, white surfaces, `#14150F` ink, `#6E7066` muted text, `#E4E2D9` hairlines, `#BBDC8E` pistachio, `#3F5233` moss, 18px cards, system typography, no gradients, and no glassmorphism.
- `#EFF6E3` accent tint is reserved for recommendation surfaces. Pistachio fill may be used for the central scan action, progress, and selected controls.
- The only shadow belongs to the central Scan button.

## Engineering boundaries

- The MVP has a local analysis gateway with live OpenRouter/OpenAI and USDA adapters plus an optional Supabase Auth/data-sync layer. Billing and product analytics remain mocked or absent; do not imply those actions are live.
- Supabase access from the app uses only the publishable key and a user JWT. Never add a secret or `service_role` key to Expo code or an `EXPO_PUBLIC_` variable.
- Every table in an exposed Supabase schema must enable RLS, revoke unnecessary grants, and include owner-scoped policies before it is used by the client.
- UI components should consume typed domain data, not raw third-party API responses.
- Put external integrations behind small service interfaces. Keep USDA/Open Food Facts mapping, vision parsing, storage, and billing separate.
- Derived totals must come from meal data and daily targets. Do not hard-code remaining calories or macros in screens.
- Keep route components focused on presentation and interaction. Shared business logic belongs in context, hooks, or services.

## Validation

Run the full gate:

```bash
npm run verify
```

For camera or navigation changes, also run the app in Expo Go and manually verify:

1. Camera permission denied and granted states.
2. Demo capture through analyzing and confirmation.
3. `weniger / passt / mehr` and gram-level detail correction both update the estimate.
4. Saving the meal updates Today from 1,800 to 1,090 kcal remaining in the default fixture.
5. Choosing a recommendation opens the mock paywall.
6. The result sequence counts the meal up, the remaining day down, then reveals the recommendation; Reduce Motion skips the sequence.

## Change discipline

- Keep changes scoped and reviewable.
- Do not commit `.expo`, `dist`, screenshots, credentials, or local environment files.
- Update `docs/ARCHITECTURE.md` when data flow or ownership changes.
- Update `docs/ROADMAP.md` when a milestone is completed or reprioritized.
- In the final handoff, state what changed, what was verified, and any remaining risk or mock behavior.
