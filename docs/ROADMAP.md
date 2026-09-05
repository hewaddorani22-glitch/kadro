# Roadmap

## Build 13 analysis feedback

- [x] Reproduce bread/slice and dried-raisin false rejection. Normalize lookup-only portion wording and bridge common nuts/dried fruit/dairy/prepared ingredients to reviewed BLS source rows without inventing nutrition.
- [x] Add behavioral regressions for query wording, source/portion scaling, decimal-fat identity, wrong egg dish keys and transformed-food rejection. Generic USDA lookup no longer competes primarily against branded rows or removes preparation as a fallback.
- [ ] Repeat the owner's original raisin/nut photos on the hosted correction and complete the weighed real-photo set. Text/lookup regressions do not prove universal visual accuracy.

## Review remediation, 2026-09-05

- Fixed partial barcode labels, progress pound precision/range mismatch, offline profile edit timestamps and deferred-state unit persistence. Regression coverage is part of `npm run verify`.
- Audited live DE/EN App Store draft, added subscription/terms/privacy disclosures, and corrected the banana screenshot's 252 g calculation. No App Review submission or new binary is implied. Current release gates and evidence: `release/app-store-audit/28_REMEDIATION_METADATA_REVIEW.md`.

## Build 8 feedback, 2026-09-05

- [x] US onboarding/profile weight stepper uses 0.1 lb and no intermediate 0.1 kg rounding. Regression sweeps lb inputs and database precision; native rapid-touch/hold behavior remains a physical-device gate.

- [x] Reject incomplete scanned-meal nutrition instead of showing zero placeholders; exact BLS ingredient fallback and USDA food-identity gate prevent dried dates matching dried lotus seeds. Existing stored meals are not automatically rewritten; recognition of arbitrary photos remains a device/evaluation gate.

- [x] Exact decimal weight entry in both onboarding and profile plan editing: comma/point, explicit save/cancel, existing bounds, 0.1 kg steps and no unit-switch rounding of stored weight. Native decimal-keyboard layout remains part of the next iPhone pass.

- [x] Build 11 feedback: reproduce honeydew energy 0 against USDA Foundation 2710816; map Atwater energy fields and preserve correction precision. Hosted text regression now returns 329 kcal for an explicit 1000 g edible portion. Existing incorrectly saved meals are not silently rewritten.
- [x] Prevent retained scan navigation stacks; verify 30 cycles with the actual navigation reducer. Restrict camera to focused/foreground screen and bound iOS acquisition resolution.
- [ ] Obtain and inspect the reported iPhone crash/Jetsam log and repeat at least 15 physical photo cycles in a replacement native build. Browser/reducer tests do not certify native camera stability.

- [x] Follow-up QA: midnight refresh, privacy-safe analytics event, eligibility-gated trial copy, localized demo ingredients, consent contrast and stepper accessibility units. Full browser QA evidence is in `release/app-store-audit/22_FULL_APP_QA.md`.
- [x] Landing/app consistency: guest account, guardian requirement, photo retry retention and recipe scope clarified; waitlist network timeouts recover with localized feedback.

- [x] Build 9 billing follow-up: reproduce active Apple sandbox receipt denied by server because the v2 entitlement is unexpanded; accept allowlisted subscription product + active entitlement without requiring nested products. Regression covers real response shape and retains wrong-store/product/entitlement rejection. On-device restore confirmation remains required.

- [x] Reject empty scan confirmation/save; suppress empty confidence; use two-row ingredient controls on narrow screens; hide result recommendations below the same 150 kcal threshold as Today/Plan; remove adult caps/floors from adolescent maintenance calculation.
- [ ] Local native simulator pass blocked: only Command Line Tools installed, no discoverable Xcode or simctl. Install full Xcode and an iOS runtime before claiming a simulator pass.

- [x] Replace search slide with fade/Reduce Motion; direct detail-row gram entry preserves 110.3 g; independently assert target arithmetic for the adult profile test matrix.

- [x] Replace stacked search/portion modals; keep amount editor close/save reachable.
- [x] Recognized piece count, count stepper, estimated per-piece calories, and correction round-trip regression.
- [x] Light first-launch default, persisted profile appearance switch, dynamic palettes and corrected dark-mode foregrounds.
- [x] Plain pancakes before compound variants; invalidate outdated search responses immediately.
- [x] Full verify gate plus live model text test: 3 pancakes / 240 g returns 80 g per piece.
- [ ] Verify a replacement native candidate on a physical iPhone: decimal keyboard close/save, search add, real photo count correction, touch targets, appearance persistence. Build 8 itself is unchanged.
- [ ] Preserve household-unit metadata when restoring logged meal history from cloud (current active scan/search correction does retain it).

## Current status: Day 4 app work complete; native TestFlight and legal gates remain

- [x] Kandro name, mark, app icon, and exact brand tokens
- [x] German product UI
- [x] Six-step personalized onboarding with visible wellness guardrails
- [x] Persist onboarding completion, calculate real targets from the entered profile, and apply saved preferences to recommendations
- [x] Today dashboard with derived calories and macros
- [x] Central full-screen camera flow with permission and demo states
- [x] Staged analyzing state
- [x] Detected-food confirmation with one-tap meal sizing and optional gram correction
- [x] Result sequence with estimate count-up, remaining count-down, confidence, and reduced-motion support
- [x] Zuhause, Supermarkt, and Unterwegs recommendation contexts
- [x] Exactly three suggestions per context
- [x] Progress and profile screens
- [x] Replace placeholder progress metrics with saved weight entries and actual meal history
- [x] Transparent mock paywall
- [x] Expo Go compatibility on SDK 54
- [x] TypeScript, Expo Doctor, web export, and iOS bundle checks
- [x] Typed service contracts for analysis, nutrition lookup, persistence, retry, and recommendations
- [x] Real Describe and camera Barcode fallbacks plus lifetime three-free-analysis enforcement
- [x] Credentialed real-photo smoke test on an iPhone with OpenRouter and USDA

## Day 2: real meal intelligence

Priority order:

1. [x] Add image resizing/compression and a temporary-upload boundary.
2. [x] Return structured detected foods, portions, and confidence from a multimodal model.
3. [x] Resolve normalized nutrition through USDA FoodData Central for fresh food.
4. [x] Add Open Food Facts as the packaged-food and barcode source.
   - [x] Add the user-facing Expo Camera barcode mode and 100-g correction handoff.
   - [x] Add a structured meal-description fallback through the same USDA boundary.
5. [x] Preserve the existing confirmation UI as the correction layer.
6. [x] Save the confirmed meal and reload Today from the repository.
7. [x] Add a local-first retry queue plus unclear-image and multiple-dish error states.
8. [x] Seed 45 curated German/English meal-planning estimates and rank exactly three deterministically by context, remaining macros, and preferences.

The code path, mock path, gateway health endpoint, Open Food Facts lookup, catalog validator, TypeScript, Expo Doctor, exports, and one credentialed real-photo iPhone smoke test are complete.

Acceptance criteria:

- A real photo produces editable structured ingredients rather than a single calorie guess.
- Nutrition values identify their source and remain explicitly estimated.
- The original image is deleted after local compression; confirmed meals never retain a photo.
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
- [x] Sync the actual onboarding profile, target, and preferences instead of display-only defaults
- [x] Exactly three deterministic catalog recommendations from the persisted daily state
- [x] Structured recommendation impressions plus acceptance/rejection feedback adapter
- [x] Create the dedicated Kandro Supabase project, enable anonymous auth, apply the migration, and run live RLS tests
- [x] Link an authorized Supabase CLI profile and reconcile the dashboard-applied migration with CLI migration history
- [x] Deploy the authenticated Supabase `nutrition` gateway with server-only provider secrets, a private per-user daily quota, and live barcode/text/photo security smoke tests
- [x] Run the cloud-hydration smoke test in Expo Go and verify the persisted anonymous session after an app restart
- [x] Add permanent account linking with verified email and password recovery; Apple remains optional after MVP validation
- [x] Expand the validated bilingual catalog from 45 to 200 meals after live schema and ranking validation
- [x] Add the complete 7,140-entry bilingual BLS 4.0 food search snapshot with localized German/English names and representative everyday ranking for German, US, UK, Turkish, and Asian foods
- [ ] RevenueCat subscription and restore flow
  - [x] Expo Go-safe Test Store adapter, Supabase identity, live Offering prices, entitlement check, purchase, cancellation, and restore UI
  - [x] Create RevenueCat project, `kandro_pro` entitlement, current annual/monthly Offering, and run a Test Store purchase/restore smoke test
  - [ ] Configure App Store Connect products and run a native StoreKit sandbox purchase in a development/TestFlight build
- [ ] PostHog product events and Sentry error reporting
  - [x] Add an Expo Go-compatible PostHog adapter with typed event allowlist, anonymous-only profiles, GeoIP/session replay/autocapture disabled, persisted opt-out, and scrubbed JavaScript error reporting
  - [x] Create the EU PostHog project, enable local collection, and run a live funnel/error smoke test
  - [ ] Add the native Sentry SDK, DSN, release source maps, and a live crash test in the first development/TestFlight build

## Day 4: launch quality

- [x] Deterministic 30-case regression matrix: 25 representative German meals plus poor light, blur, partial plate, multiple dishes, and unknown-food handling
- [x] Add 64 weighed German BLS 4.0 reference meals, exact source attribution, GPT-4.1-mini structured matching, portion ranges, and ambiguity-safe USDA caching
- [ ] Review at least 30 real iPhone meal photos against confirmed foods and portions before external beta distribution
- [x] Local-first no-network queue and explicit retry/unclear/multiple-dish states
- [x] Portion selector and gram correction browser smoke test
- [x] Semantic accessibility pass, meaningful labels/states, and Reduce Motion handling for navigation and analysis/result sequences
- [ ] Native VoiceOver, Dynamic Type, contrast, camera-permission, and offline retry pass on a physical iPhone
- [x] RevenueCat Test Store purchase, entitlement, and restore smoke test
- [ ] App Store Connect products plus native StoreKit sandbox purchase/restore in the TestFlight build
- [x] Versioned explicit AI/wellness consent, in-app withdrawal, server enforcement, bilingual privacy/terms, non-medical guardrails, and live Supabase account-deletion test
- [x] 14+ access with server-enforced guardian email confirmation for ages 14–15, adolescent growth-aware energy balance for 14–17, and analytics disabled for minors
- [x] Add legal controller/contact details, public support/privacy URLs, provider/transfer disclosure and ZDR configuration
- [x] Responsive Kandro landing page with private deployment plus privacy and terms routes
- [x] Publish the landing page and generated bilingual legal pages at getkandro.com
- [x] EAS production/preview configuration and App Store metadata/screenshot handoff
- [x] Create and link the Expo EAS project `@hewad/kandro`, and configure public preview environment values
- [x] Configure public Supabase values for production and keep the local analysis override absent from Preview and Production
- [ ] Wait for Apple's identity approval of the paid Developer Program enrollment, then build and submit TestFlight; capture final native screenshots from that build
- [ ] Re-check the current transitive Expo/Metro npm advisories during an isolated SDK upgrade; do not force-upgrade this Expo Go branch to SDK 57

The full core-plus-33-section audit is maintained in `docs/PLAN_34_AUDIT.md`. The source plan contains no fifth build day.

## Explicitly out of scope for v0.1

Workout tracking, steps, Apple Health, social feeds, friends, challenges, water tracking, AI chat, seven-day meal planning, grocery shopping, wearables, community, restaurant databases, and large recipe catalogs.
