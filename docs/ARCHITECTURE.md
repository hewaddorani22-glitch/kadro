# Architecture

## Appearance and amount editing (Build 8 remediation)

- Search and standalone portion dialogs use a fade, with no animation under Reduce Motion. Tapping a detail-row gram value opens grams explicitly. Entry accepts decimal comma or point; resolution and app-state corrections preserve tenths of a gram. Nutrition display remains rounded, and search keeps the original per-100g reference for subsequent edits.

- `ThemeProvider` owns a device-local light/dark preference. First launch is light regardless of the OS setting; only an explicit saved dark selection changes it. The provider updates styles in place without remounting app/account state. `useThemedStyles` resolves palette-dependent styles; pistachio uses `onAccent` text instead of the adaptive body text color.
- Photo/text detection may return a localized piece label and count. The shared nutrition mapper derives estimated grams per piece from the total weight/count. No additional model invocation is needed. Unknown counts remain grams-only. Piece edits assume equally sized pieces and remain estimates.
- The search modal embeds the amount editor, avoiding simultaneous sibling native modals. On iOS, navigation waits for search dismissal. The amount editor keeps close/save outside its scrolling body and accommodates the keyboard.
- Amount corrections retain an unrounded per-100g reference in the in-memory/local meal item to avoid cumulative rounding. Existing cloud rows still contain numeric amounts/nutrients only; household-unit metadata is not currently restored from cloud history. Scan confirmation retains it throughout the active flow.

## Product loop

```text
Versioned explicit AI/wellness consent
   ↳ age 14–15: emailed guardian confirmation first
   ↓
Onboarding
   ↓
Today dashboard
   ↓
Camera / description / barcode / demo capture
   ↓
Local resize/compression
   ↓
Authenticated hosted gateway → GPT-4.1-mini detection → BLS/USDA nutrition lookup
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
- `src/app/index.tsx`: initial redirect to consent, onboarding or the completed app.
- `src/app/data-consent.tsx`: named AI-recipient disclosure, explicit grant and future withdrawal.
- `src/app/onboarding.tsx`: localized personalization flow with metric, US and UK units.
- `src/app/(tabs)/_layout.tsx`: Today, Plan, Scan, Progress, and Profile tabs.
- `src/app/(tabs)/scan.tsx`: photo-first camera plus real description, barcode, search and demo fallbacks; AI analyses after the first three are gated by RevenueCat.
- `src/app/analyzing.tsx`: staged analysis plus deterministic consent, input, offline and provider errors; every success goes to confirmation.
- `src/app/confirm.tsx`: ingredient inclusion, one-tap meal portion sizing, and optional gram-level correction.
- `src/app/result.tsx`: animated meal estimate, projected remaining targets, automatic idempotent meal save, and delayed recommendation reveal.
- `src/app/paywall.tsx`: transparent annual/monthly choice backed by RevenueCat Offering prices, purchase, and user-triggered restore.
- `src/app/privacy.tsx` and `src/app/terms.tsx`: in-app bilingual legal copy generated identically on the public website.
- `src/app/account-deletion.tsx`: explicit irreversible deletion confirmation and subscription-separation warning.
- `src/app/(tabs)/progress.tsx`: real locally persisted weight history and meal-derived progress instead of fixture achievements.
- `src/components/AccountLinkCard.tsx`: anonymous account upgrade, email verification, password setup, and existing-account recovery from Profile.
- `src/components/AppRouteGuard.tsx`: keeps processing routes behind current consent while leaving consent, legal copy and deletion reachable.

Root stack routes sit above the tab navigator so camera analysis, confirmation, result, and paywall can focus the user on one step.

## State and calculations

Empty scan confirmations are blocked both in the screen and the app-state save handler. Adolescent targets round the adolescent maintenance estimate directly, without adult calorie caps/floors. The Result recommendation card observes the same below-150-kcal completion threshold as Today and Plan.

`AppProvider` owns active UI state, hydrates local storage first, and then optionally reconciles with Supabase:

- saved user profile, onboarding completion, targets, and dietary preferences;
- logged meals;
- 90-day meal history and local weight entries;
- detected meal items;
- temporary compressed photo URI;
- current analysis status and local retry count;
- derived consumed and remaining nutrition.
- current quick portion selection (`0.7×`, `1×`, or `1.4×`; `null` after custom gram edits).
- sync state (`local`, `syncing`, `cloud`, or `error`);
- lifetime free-scan usage derived from local or cloud meal existence.

`mockNutrition.ts` owns the deterministic scan fixture and pure calculations:

- `nutritionFromItems` totals included detected items;
- `createScannedMeal` maps corrected items into a meal;
- `sumMeals` derives daily consumption;
- `getRemaining` derives the daily balance;

`recommendations.ts` scores the paired 200-entry German/English catalogs by context, remaining calories/protein/fat, and saved preferences. Vegetarian, pork-free, and lactose-free choices are hard constraints; high-protein and quick choices affect ranking. It sorts deterministically and returns exactly three entries. The values are explicitly labeled Kandro planning references, not sourced measurements. The catalog validator enforces balanced context coverage, known tags, plausible nutrition ranges, calorie-to-macro consistency, translation parity, and 90 deterministic recommendation sets across 30 budget/preference scenarios.

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

- `mealAnalysis.ts`: client-side compression, temporary-file cleanup, photo/description/barcode gateway calls, mapping, and typed errors.
- `supabase/functions/nutrition/index.ts`: deployed authenticated and metered production gateway. It verifies the user JWT in the handler, applies the private daily counter, rejects oversized images, and keeps provider errors off the device. Its free search route reads a compact bilingual 7,140-row BLS 4.0 snapshot locally before any external provider call, so common foods are fast and their visible names follow the app language.
- `server/index.mjs`: optional secret-bearing local development gateway. GPT-4.1-mini through OpenRouter or direct OpenAI returns food identity, preparation, portion range, hidden-calorie risk, and confidence from a photo or description only. BLS 4.0 supplies deterministic values for 64 reviewed plate-level matches and a bilingual 7,140-entry search catalogue; USDA is the automatic ingredient fallback; Open Food Facts provides packaged-food barcode data. Both gateways share detection, BLS and USDA logic under `supabase/functions/_shared`. OpenRouter routing requires supported parameters, denies data collection, and defaults to ZDR.
- `localRepository.ts`: profile/onboarding, weight entries, confirmed meals, lifetime scan history, and a maximum-three local retry queue in AsyncStorage.
- `supabaseClient.ts`: optional public-client initialization, persisted React Native sessions, foreground token refresh, and anonymous authenticated bootstrap.
- `accountLinking.ts`: ID-preserving email upgrade with `updateUser`, email-change verification, password setup, and existing-account sign-in.
- `consent.ts`: versioned local wellness-data consent mirrored to the user's RLS-protected profile.
- `accountDeletion.ts`: authenticated Edge Function invocation, local cleanup, analytics reset/opt-out, and deliberate cloud-disable state after deletion.
- `cloudRepository.ts`: maps the actual profile/targets and meal domain records to RLS-protected Supabase rows, checks cloud scan history for the free boundary, and records recommendation feedback.
- `syncRepository.ts`: preserves local-first writes, uploads pending local scans during hydration, and merges cloud meals back into domain state.
- `subscription.ts` + `SubscriptionContext.tsx`: platform/Test Store key selection, Supabase-user identity, current Offering, `kandro_pro` entitlement state, purchase cancellation, and user-triggered restore. Without public SDK configuration, the paywall remains a clearly labeled non-billing preview.
- Server entitlement confirmation uses RevenueCat's authenticated v2 subscription response: `gives_access`, Apple store/environment, exact server-owned iOS product resource allowlist and active entitlement resource ID. Nested entitlement `products` is optional in the real API, not a prerequisite for access; when present it is checked for contradictory app/product metadata. Both the refresh route and webhook use this shared parser. No client flag grants Pro.
- `telemetry.ts`: optional PostHog client with a typed event allowlist, anonymous-only profiles, no health-value properties, persisted opt-in/out, and scrubbed operational error capture. It is a no-op when the public project token is absent.
- `recommendations.ts`: deterministic scoring over the bilingual Kandro planning catalog with explicit typical-value provenance.

Raw provider payloads should be mapped to the domain types in `src/types/nutrition.ts` before reaching React components.

## Privacy boundary

The current analysis pipeline:

1. resizes to 1600 px and compresses to JPEG locally;
2. deletes the camera original after the compressed working copy exists;
3. sends the working copy to the authenticated Supabase gateway, or to the explicit local development override;
4. keeps at most three failed scans locally for explicit retry;
5. persists only the user-confirmed structured meal;
6. never retains photos as part of saved meal records.

Age is part of the processing boundary, not display copy. Profiles below 14 are rejected in the UI and database. Ages 14–15 can only set the current wellness consent after `guardian-consent` has recorded the current guardian notice version; those server-owned columns cannot be written by an authenticated client. The nutrition gateway checks age, guardian approval and the current privacy version before any barcode, search, text or photo request. Ages 14–17 use the adolescent EER maintenance path with no goal offset, and PostHog opt-in is disabled for them.

The compressed preview lives only in the app cache during the active flow. The production gateway is authenticated and metered, sends the image directly to the configured model provider with storage disabled, and does not persist it in Supabase. Final legal/provider disclosure and retention review remain launch gates.

Product analytics never receives photos, food or ingredient names, email addresses, Supabase user IDs, calories, macros, weights, or goals. Only the events and categorical properties documented in `docs/ANALYTICS.md` are accepted by the client. PostHog person profiles, GeoIP, automatic lifecycle/touch/screen capture, feature flags, push capture, and session replay are disabled; device name/model/manufacturer, locale, timezone, and screen dimensions are stripped before send. The user can persistently opt out from Profile.

During Expo Go testing, the root React error boundary and explicitly caught integration failures report scrubbed JavaScript errors through PostHog. Native Sentry crash reporting is reserved for the development/TestFlight build because the official React Native SDK includes native iOS and Android code that Expo Go does not bundle.

The `delete-account` Edge Function requires a valid user JWT, deletes that exact Auth user with server-only admin privileges, and relies on foreign-key cascades for owned rows. After a successful response, the app clears local meals, queued scans, consent, and telemetry state and does not silently create a replacement anonymous account. The live deletion regression verifies the profile cascade and that the deleted refresh token cannot mint another session.

## Supabase ownership boundary

The mobile app receives only the project URL and publishable key. Supabase Auth supplies a per-user JWT, and Postgres RLS limits product rows to `(select auth.uid()) = user_id`. The client never receives a provider secret or `service_role` key. `profiles`, `daily_targets`, `meals`, `meal_items`, `recommendations`, `recommendation_feedback`, and `analysis_usage` all enable RLS and revoke access from the unauthenticated `anon` role. The quota table additionally has no client policies or table grants.

Anonymous sign-in is used to avoid blocking the first scan. It is an authenticated Supabase user, not unauthenticated public database access. The Profile account card upgrades it with a verified email through `updateUser`, verifies that the returned identity still has the same user ID, and then lets the user set a password. Existing accounts can sign back in and rehydrate their RLS-owned cloud data. Clearing app data before the upgrade can still make an anonymous account inaccessible.
