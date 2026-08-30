# Contributing

## Setup

```bash
npm install
npx expo start --clear
```

Use Node.js 20.19 or newer. The project is pinned to Expo SDK 54 for Expo Go compatibility.

## Branches and pull requests

1. Create a focused branch from `main`.
2. Keep product behavior and infrastructure changes separate when practical.
3. Follow the constraints in `AGENTS.md`.
4. Run `npm run verify` before opening a pull request.
5. Describe manual camera/navigation checks in the pull request.

## Commit style

Use short imperative subjects, for example:

```text
Add structured meal analysis service
Handle denied camera permission
Persist corrected meal portions
```

## Definition of done

- TypeScript passes.
- Expo Doctor passes.
- Expo web export succeeds.
- Changed flows were exercised in Expo Go when they involve native behavior.
- Mock behavior is still labeled as mock.
- Architecture and roadmap documentation reflect material changes.
