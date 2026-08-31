# Analytics and error reporting

Kadro measures only whether the core product loop works. `src/services/telemetry.ts` is the single analytics boundary. Without `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN`, every analytics and error call is a no-op.

## Product-event allowlist

| Event | Allowed properties |
|---|---|
| `onboarding completed` | `completion` |
| `meal scan started` | `scan_source` |
| `meal analysis completed` | `scan_source`, `confidence`, `detected_item_count`, `warning_present` |
| `meal analysis failed` | `scan_source`, `failure_reason`, `queued_for_retry` |
| `meal confirmed` | `confidence`, `correction_applied`, `included_item_count` |
| `meal saved` | `next_destination` |
| `recommendation set viewed` | `meal_context` |
| `recommendation selected` | `meal_context`, `rank` |
| `paywall viewed` | `billing_mode` |
| `subscription purchase completed` | `billing_mode`, `plan` |
| `subscription restore completed` | `billing_mode`, `active` |

Counts are coarse buckets (`1`, `2-3`, `4+`). Events must never contain photos, local file paths, meal or ingredient names, email addresses, account IDs, free text, exact calories/macros, body measurements, goals, or provider payloads.

## Privacy defaults

- EU ingestion host by default.
- Person profiles are never created and Supabase identity is never passed to PostHog.
- Device name/model/manufacturer, locale, timezone, and screen dimensions are removed before every send.
- GeoIP, lifecycle/touch/screen autocapture, feature flags, surveys, push capture, session replay, and persistent cross-restart session IDs are disabled.
- Collection is off unless `EXPO_PUBLIC_POSTHOG_ENABLED=true` or the user enables it from Profile.
- The Profile switch calls PostHog's persisted `optIn`/`optOut` controls.
- A final privacy policy and consent review are still required before external distribution.

## Error boundary

The Expo Go phase reports only React render failures and explicitly caught analysis, cloud-sync, and subscription failures. Error messages are replaced with a fixed area/operation/code tuple before sending; stack frames are kept for debugging. No console logs, network payloads, breadcrumbs, photos, or application state are attached.

The first development/TestFlight build adds `@sentry/react-native`, a public DSN, and release source maps. `SENTRY_AUTH_TOKEN` is a build secret and must never use the `EXPO_PUBLIC_` prefix or be committed.

## Live verification

The EU project was connected on 2026-08-31. A complete anonymous MVP funnel and a controlled render failure arrived in PostHog. The event inspection confirmed that person-profile processing stayed disabled, the original test error message was replaced, and the blocked automatic device, locale, timezone, and screen-dimension properties were absent.
