# Kandro

An iOS-first nutrition app built with React Native, Expo Router and TypeScript.

[![CI](https://github.com/hewaddorani22-glitch/kadro/actions/workflows/ci.yml/badge.svg)](https://github.com/hewaddorani22-glitch/kadro/actions/workflows/ci.yml)

> Die Aufstellung deines Tages.

## Included product loop

1. English-first onboarding with German localization, personalized targets and transparent wellness guardrails
2. Daily calorie and macro dashboard with an honest empty timeline before the first meal
3. Full-screen meal camera with real Describe, Barcode, and deterministic demo fallbacks
4. Real photo compression plus structured vision analysis through an authenticated server boundary
5. One-tap `weniger / passt / mehr` portion confirmation plus optional gram-level editing
6. Animated meal result with confidence and estimated nutrition
7. Recalculated daily balance
8. Three deterministic contextual suggestions from a 200-meal bilingual catalog
9. Real local weight/meal progress, profile and transparent subscription paywall

The demo meal remains available as a deterministic fallback. Real scans use GPT-4.1-mini through OpenRouter or direct OpenAI only for visible-food, preparation, hidden-calorie risk, and portion detection. Nutrition then resolves through a 64-dish German BLS 4.0 reference set, with USDA FoodData Central as the ingredient fallback. Typed meal descriptions use the same structured boundary. The barcode adapter reads packaged-food data from Open Food Facts and starts at 100 g for explicit correction. RevenueCat-backed purchase and restore actions use a non-billing preview until its public SDK keys and offering are configured. Typed integration contracts keep raw provider payloads out of the UI.

The first three complete AI analyses are free. Every estimate must be confirmed before it is saved, so the user can correct ingredients and portions. Further analyses require an active `kandro_pro` RevenueCat entitlement; search and the user's existing history remain available.

When configured, Supabase provides an anonymous authenticated session, RLS-isolated profiles, daily targets, confirmed meals, ingredients, recommendation impressions, and acceptance/rejection feedback. The profile screen can upgrade that same anonymous user ID to a verified email/password account without placing a login wall before the first scan. Without Supabase configuration the app remains fully local-first.

## Open with Expo Go

Install the current Expo Go app from the App Store, then run:

```bash
npm install
npx expo start --clear
```

Scan the QR code with the iPhone Camera app or with Expo Go on Android. Phone and computer should be on the same Wi-Fi network. If LAN discovery fails, use `npx expo start --tunnel`.

## Run locally

```bash
npm install
npm run ios
```

For the browser preview:

```bash
npm run web
```

## Enable real photo analysis

The Expo app never receives an OpenRouter, OpenAI or USDA secret. Preview and production use the deployed Supabase Edge Function `nutrition`; it verifies the user's Supabase JWT and applies a per-user daily limit before calling paid providers. The optional local gateway remains available for development.

For the hosted setup, deployment, routes, security boundary, and live-test status, see [docs/GATEWAY.md](./docs/GATEWAY.md). To use the local gateway:

1. Copy `.env.example` to `.env`.
2. For OpenRouter, set `AI_PROVIDER=openrouter` plus `OPENROUTER_API_KEY`. Alternatively use `AI_PROVIDER=openai` plus `OPENAI_API_KEY`.
3. Add a personal `USDA_API_KEY` for more than the low `DEMO_KEY` limits.
4. Replace the sample IP in `EXPO_PUBLIC_ANALYSIS_API_URL` with the Mac Wi-Fi IP from `ipconfig getifaddr en0`. Do not use `localhost` from an iPhone.
5. Keep phone and Mac on the same network, then run the two processes in separate terminals:

```bash
npm run api
npx expo start --clear
```

Check the local gateway with `curl http://127.0.0.1:8787/health`. The right-hand Play button in Photo mode always runs the deterministic demo and needs no keys. Describe and Barcode use the same local gateway URL as live photo analysis.

## Enable Day 3 cloud sync

1. Create a Supabase project in an EU region and enable **Anonymous Sign-Ins** under Authentication settings.
2. Sign in with the repository's isolated CLI profile, link the project, and apply the checked-in schema. The ignored CLI home keeps Kandro credentials separate from any default Supabase CLI account:

```bash
export SUPABASE_HOME="$PWD/supabase/.cli-home"
npx supabase login --profile "$PWD/supabase/kandro.profile.yml" --name kandro
npx supabase link --profile "$PWD/supabase/kandro.profile.yml" --project-ref YOUR_PROJECT_REF
npx supabase db push --linked --profile "$PWD/supabase/kandro.profile.yml"
```

3. From the project's Connect dialog, put only these public client values in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

4. Under **Authentication → Sign In / Providers**, keep **Anonymous Sign-Ins** and email confirmation enabled, enable **Allow manual linking**, then save. Kandro starts the upgrade with `updateUser`, verifies the email change, and only then allows a password to be set, so the existing user ID and its RLS-owned rows are retained.

The hosted default mailer sends a confirmation link. Kandro also accepts a 6- to 8-digit code when a custom SMTP provider and an email-change template containing `{{ .Token }}` are configured.

Never put a Supabase secret key or legacy `service_role` key in an `EXPO_PUBLIC_` variable. The migration revokes anonymous table access, grants only the required authenticated operations, and applies owner-only RLS to every exposed table. Meal photos are not stored in Supabase.

Local database validation requires Docker Desktop or Podman:

```bash
npm run db:start
npm run db:reset
npm run db:lint
```

For an already linked hosted project, verify migration alignment without changing the database:

```bash
npm run db:remote:list
npm run db:remote:check
```

OpenRouter requests are restricted to Microsoft Azure endpoints. Provider data collection is denied, `store: false` and ZDR are enforced in code, and fallbacks are disabled so the recipient named in the user's consent cannot change silently. OpenRouter's dedicated EU ingress requires an enterprise account, so the consent and privacy notice explicitly disclose OpenRouter's U.S. processing instead of claiming EU-only AI routing.

## Enable RevenueCat subscriptions

1. Create a RevenueCat project and an iOS app with bundle ID `com.hewaddorani.kandro`.
2. Create the entitlement `kandro_pro`.
3. Add annual and monthly subscription products to that entitlement, then add them as the standard annual and monthly packages in the current Offering.
4. Copy the public RevenueCat **Test Store** SDK key into `.env`:

```bash
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=kandro_pro
```

Expo Go then displays the RevenueCat Test Store offering and safely simulates purchase and restore without a real charge. Real Apple or Google sandbox purchases require the corresponding public platform SDK key plus a development/TestFlight build; Expo Go cannot execute native StoreKit or Play Billing transactions.

The app uses the current Supabase user ID as RevenueCat's App User ID, so an email-upgraded Kandro account keeps a stable purchase identity. Only public SDK keys belong in `EXPO_PUBLIC_` variables—never a RevenueCat secret API key.

## Enable privacy-minimal analytics

Create a PostHog project in the EU region and copy its public project token into `.env`:

```bash
EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
EXPO_PUBLIC_POSTHOG_ENABLED=true
```

Restart Expo after changing these values. Kandro sends only a typed allowlist of anonymous funnel events. Person profiles, GeoIP lookup, lifecycle autocapture, touch autocapture, feature flags, push capture, session replay, and health-value properties are disabled. Device name/model/manufacturer, locale, timezone, and screen dimensions are removed before every send. Users can opt out under **Du → Einstellungen → Anonyme Nutzungsanalyse**. No photo, email, food name, ingredient, calorie value, macro value, or Supabase user ID is sent.

Collection starts opted out even when the integration is available. The user must enable **Anonyme Nutzungsanalyse** deliberately in Profile; the choice is persisted by PostHog.

JavaScript render failures and explicitly handled integration failures use the same scrubbed PostHog boundary while the app is tested in Expo Go. The official Sentry React Native SDK contains custom native code, so full Sentry crash reporting and source-map upload are intentionally deferred to the first development/TestFlight build. See [docs/ANALYTICS.md](./docs/ANALYTICS.md).

## Quality checks

```bash
npm run verify
```

The gate includes the original deterministic 30-case Day 4 matrix plus 64 weighed German BLS 4.0 reference meals. This protects source mapping, portion scaling, cache selection and error handling, but it does not replace the pending review of at least 30 weighed real iPhone meal photos. See [docs/ACCURACY.md](./docs/ACCURACY.md).

The complete plan audit, including the external TestFlight and legal gates, lives in [docs/PLAN_34_AUDIT.md](./docs/PLAN_34_AUDIT.md).

## Prepare TestFlight

The repository is linked to the Expo EAS project `@hewad/kandro` and includes explicit preview and production profiles. Public Supabase values are configured for both environments; PostHog and RevenueCat Test Store values are configured for preview. The production analysis gateway is live, while production billing remains unset until the real App Store products exist. Apple Developer Program activation is currently pending Apple's identity approval. Store copy, screenshot storyboard, the exact native test gate, and release blockers live in [docs/APP_STORE.md](./docs/APP_STORE.md).

The in-app privacy policy, terms and public website share the same generated bilingual source. The authenticated Supabase deletion function is live and its regression test confirms account deletion, profile cascade, and refresh-token revocation. The exact App Store privacy answers and reviewer notes live in `docs/APP_PRIVACY.md` and `docs/APP_REVIEW_NOTES.md`.

## Working with coding agents

Start with [AGENTS.md](./AGENTS.md), then read the [architecture](./docs/ARCHITECTURE.md) and [roadmap](./docs/ROADMAP.md). These files define the current boundaries, product invariants, validation commands and next implementation slice.

Contributions should follow [CONTRIBUTING.md](./CONTRIBUTING.md). Pull requests run TypeScript, Expo Doctor and an Expo web export in CI.

## Current scope

- Expo SDK 54, compatible with the current App Store build of Expo Go
- React Native + Expo Router + TypeScript
- Kandro brand system and German product UI
- Real camera preview when permission is granted
- Authenticated, metered Supabase analysis gateway using GPT-4.1-mini, BLS 4.0, USDA fallback and Open Food Facts for Preview/Production plus an optional local development gateway; live billing is still pending
- Optional anonymous PostHog product analytics; native Sentry reporting begins with the development/TestFlight build
- Versioned wellness-data consent, privacy/terms drafts, and authenticated account deletion with local cleanup
- Confirmed meal records never retain photos; only a compressed failed scan can live temporarily in the local retry queue
- Confirmed meals survive restarts in local AsyncStorage
- Onboarding, consent, calculated targets, preferences, weight entries, and the three-free-analysis boundary survive restarts
- Failed network scans are queued locally (maximum three) until the user explicitly retries
