# Kadro

An iOS-first, production-shaped nutrition MVP built with React Native, Expo Router and TypeScript.

[![CI](https://github.com/hewaddorani22-glitch/kadro/actions/workflows/ci.yml/badge.svg)](https://github.com/hewaddorani22-glitch/kadro/actions/workflows/ci.yml)

> Die Aufstellung deines Tages.

## Included product loop

1. Six-step German onboarding with transparent wellness guardrails
2. Daily calorie and macro dashboard with no empty start state
3. Full-screen meal camera with a deterministic demo fallback
4. Real photo compression plus structured vision analysis through a local server boundary
5. One-tap `weniger / passt / mehr` portion confirmation plus optional gram-level editing
6. Animated meal result with confidence and estimated nutrition
7. Recalculated daily balance
8. Three deterministic contextual suggestions from a 90-meal German catalog
9. Progress, profile and transparent subscription paywall

The demo meal and billing remain mocked. Real scans use OpenRouter or direct OpenAI only for visible-food and portion detection, then resolve nutrition through USDA FoodData Central. The barcode adapter reads packaged-food data from Open Food Facts. Typed integration contracts keep raw provider payloads out of the UI.

When configured, Supabase provides an anonymous authenticated session, RLS-isolated profiles, daily targets, confirmed meals, ingredients, recommendation impressions, and acceptance/rejection feedback. The anonymous identity can later be linked to email or Apple without placing a login wall before the first scan. Without Supabase configuration the app remains fully local-first.

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

The Expo app never receives an OpenRouter, OpenAI or USDA secret. A small local gateway holds those keys and returns normalized Kadro domain data.

1. Copy `.env.example` to `.env`.
2. For OpenRouter, set `AI_PROVIDER=openrouter` plus `OPENROUTER_API_KEY`. Alternatively use `AI_PROVIDER=openai` plus `OPENAI_API_KEY`.
3. Add a personal `USDA_API_KEY` for more than the low `DEMO_KEY` limits.
4. Replace the sample IP in `EXPO_PUBLIC_ANALYSIS_API_URL` with the Mac Wi-Fi IP from `ipconfig getifaddr en0`. Do not use `localhost` from an iPhone.
5. Keep phone and Mac on the same network, then run the two processes in separate terminals:

```bash
npm run api
npx expo start --clear
```

Check the local gateway with `curl http://127.0.0.1:8787/health`. The right-hand Play button in the scanner always runs the deterministic demo and needs no keys.

## Enable Day 3 cloud sync

1. Create a Supabase project in an EU region and enable **Anonymous Sign-Ins** under Authentication settings.
2. Sign in with the repository's isolated CLI profile, link the project, and apply the checked-in schema. The ignored CLI home keeps Kadro credentials separate from any default Supabase CLI account:

```bash
export SUPABASE_HOME="$PWD/supabase/.cli-home"
npx supabase login --profile "$PWD/supabase/kadro.profile.yml" --name kadro
npx supabase link --profile "$PWD/supabase/kadro.profile.yml" --project-ref YOUR_PROJECT_REF
npx supabase db push --linked --profile "$PWD/supabase/kadro.profile.yml"
```

3. From the project's Connect dialog, put only these public client values in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

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

OpenRouter requests require providers that support every requested parameter, deny provider data collection, use `store: false`, and enable ZDR by default. Set `OPENROUTER_ZDR=false` only for local debugging if your selected model has no ZDR-compatible endpoint.

## Quality checks

```bash
npm run verify
```

## Working with coding agents

Start with [AGENTS.md](./AGENTS.md), then read the [architecture](./docs/ARCHITECTURE.md) and [roadmap](./docs/ROADMAP.md). These files define the current boundaries, product invariants, validation commands and next implementation slice.

Contributions should follow [CONTRIBUTING.md](./CONTRIBUTING.md). Pull requests run TypeScript, Expo Doctor and an Expo web export in CI.

## Current scope

- Expo SDK 54, compatible with the current App Store build of Expo Go
- React Native + Expo Router + TypeScript
- Kadro brand system and German product UI
- Real camera preview when permission is granted
- Local development analysis gateway; optional Supabase Auth and data sync; no hosted production analysis gateway or live billing yet
- Confirmed meal records never retain photos; only a compressed failed scan can live temporarily in the local retry queue
- Confirmed meals survive restarts in local AsyncStorage
- Failed network scans are queued locally (maximum three) until the user explicitly retries
