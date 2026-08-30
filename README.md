# Nutrition Autopilot

An iOS-first, production-shaped Day 1 MVP built with React Native, Expo Router and TypeScript.

[![CI](https://github.com/hewaddorani22-glitch/kadro/actions/workflows/ci.yml/badge.svg)](https://github.com/hewaddorani22-glitch/kadro/actions/workflows/ci.yml)

> Take a photo of your food. The app tells you what to eat next.

## Included product loop

1. Personalized onboarding
2. Daily calorie and macro dashboard
3. Full-screen meal camera with a demo fallback
4. Animated analysis state
5. Editable detected-food confirmation
6. Meal result with confidence and estimated nutrition
7. Recalculated daily balance
8. Three contextual next-meal suggestions
9. Progress, profile and transparent subscription paywall

All nutrition, analysis and billing data is mocked behind a small service/context layer. Real APIs can replace those boundaries without rebuilding the screens.

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
- Real camera preview when permission is granted
- No backend, AI analysis, auth or live billing yet
- Meal photos are not persisted by the prototype

The next implementation slice is the Day 2 scanner pipeline: temporary upload, vision detection, nutrition database lookup, correction persistence and saved meals.
