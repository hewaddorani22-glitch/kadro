# Final release-environment and dependency recheck

Checked on 4 September 2026 after the local security remediation.

## EAS production configuration

- Command: `npm run validate:eas:remote`
- Exit: 0
- Result: the remote EAS production environment exposes the configured public RevenueCat iOS SDK key, EU PostHog configuration and hosted Supabase URL/key expected by the build validator.
- Secret values were not printed or copied into this evidence.

## Local production validator

- Command: `npm run validate:release:production`
- Exit: 1
- Sole reported blocker: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` is empty in the local shell environment.
- Interpretation: expected local-vs-remote difference, not a waiver. The fresh EAS archive must still be inspected to prove the remote value reached the binary and is not a Test Store key.

## npm advisory snapshot

- Command: `npm audit --json`
- Exit: 1 (npm's expected non-zero advisory result)
- All dependencies: 27 findings: 18 moderate, 9 high, 0 critical.
- Production dependency graph (`--omit=dev`): 26 findings: 17 moderate, 9 high, 0 critical.
- Reported chains are predominantly Expo CLI/Metro/config/navigation build/runtime infrastructure; npm proposes an Expo 57 major upgrade for the umbrella fixes.
- No unreviewed forced or major upgrade was applied inside a release audit. Expo Doctor remains 18/18, but these advisories remain a documented dependency risk and require a separately tested SDK upgrade cycle.

This file records counts and release impact only; the machine-readable baseline remains `02_npm_audit.json` and must be refreshed after any dependency upgrade.
