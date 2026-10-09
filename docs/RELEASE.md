# Release notes for builds

## Sentry source maps (status 09.10.2026: upload still off)

Crash reporting is on in `preview` and `production` (`EXPO_PUBLIC_SENTRY_DSN`).
Since 09.10.2026, 10% of sessions also send performance traces
(`tracesSampleRate: 0.1` in `src/services/crashReporting.ts`). The privacy
scrubbing still applies: no user, no request bodies, no query strings, no
screenshots, no trace headers to Supabase or providers.

Stack traces stay minified until source maps are uploaded. Upload needs a
**Sentry auth token**, which must never be committed. So both build profiles
in `eas.json` keep `"SENTRY_DISABLE_AUTO_UPLOAD": "true"`. Removing that flag
without the token makes the iOS build fail at the "Upload Debug Symbols to
Sentry" step.

To enable upload (owner action, one time):

1. In Sentry (EU region, `de.sentry.io`), create an **Organization Auth Token**
   with the `project:releases` and `org:read` scopes.
2. Store it as an EAS secret for both environments, never in the repo:
   ```bash
   npx eas-cli env:create --environment production --name SENTRY_AUTH_TOKEN --value <token> --visibility secret
   npx eas-cli env:create --environment preview --name SENTRY_AUTH_TOKEN --value <token> --visibility secret
   ```
3. Give the plugin the non-secret target in `app.json` and replace the bare
   `"@sentry/react-native"` plugin entry:
   ```json
   ["@sentry/react-native", { "organization": "<org-slug>", "project": "<project-slug>", "url": "https://de.sentry.io/" }]
   ```
4. Remove `"SENTRY_DISABLE_AUTO_UPLOAD": "true"` from the `preview` and
   `production` profiles in `eas.json`.
5. Create a preview build. In Sentry, check that the release has source maps and
   that a test error shows readable file and line numbers.
