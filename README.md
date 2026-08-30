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
8. Three deterministic contextual suggestions from a 45-meal German catalog
9. Progress, profile and transparent subscription paywall

The demo meal and billing remain mocked. Real scans use OpenAI only for visible-food and portion detection, then resolve nutrition through USDA FoodData Central. The barcode adapter reads packaged-food data from Open Food Facts. Typed integration contracts keep raw provider payloads out of the UI.

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

The Expo app never receives an OpenAI or USDA secret. A small local gateway holds those keys and returns normalized Kadro domain data.

1. Copy `.env.example` to `.env`.
2. Add `OPENAI_API_KEY`; add a personal `USDA_API_KEY` for more than the low `DEMO_KEY` limits.
3. Replace the sample IP in `EXPO_PUBLIC_ANALYSIS_API_URL` with the Mac Wi-Fi IP from `ipconfig getifaddr en0`. Do not use `localhost` from an iPhone.
4. Keep phone and Mac on the same network, then run the two processes in separate terminals:

```bash
npm run api
npx expo start --clear
```

Check the local gateway with `curl http://127.0.0.1:8787/health`. The right-hand Play button in the scanner always runs the deterministic demo and needs no keys.

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
- Local development analysis gateway; no hosted production backend, auth or live billing yet
- Confirmed meal records never retain photos; only a compressed failed scan can live temporarily in the local retry queue
- Confirmed meals survive restarts in local AsyncStorage
- Failed network scans are queued locally (maximum three) until the user explicitly retries
