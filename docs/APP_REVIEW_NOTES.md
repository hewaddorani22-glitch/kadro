# App Review notes — Kandro 1.0

Paste the relevant section into App Store Connect after replacing the bracketed build-specific values.

## Review notes (English)

Kandro is a general wellness nutrition-planning app for adults aged 18 and over. It does not diagnose or treat a medical condition.

No login is required. On first launch, the reviewer completes onboarding and gives explicit consent before any nutrition, body, photo or text data is transferred. Consent can be withdrawn under **You → Analysis & data use**. The app then blocks all analysis and cloud processing while preserving existing data. **You → Delete account and data** permanently deletes the Supabase account and local Kandro data without contacting support.

The central Scan button offers four paths:

1. Photo: camera permission is requested only after the reviewer chooses Photo. Photograph one meal, then tap the shutter.
2. Describe: enter a meal in words.
3. Barcode: scan a packaged-food barcode.
4. Search: select a food without an AI call.

Every photo or text estimate goes to a confirmation screen before it is saved. The reviewer can change gram amounts and remove ingredients. The meal result then updates the daily targets and reveals exactly three next-meal options.

The first three AI analyses are free. Afterwards the paywall offers the live App Store monthly and annual subscriptions. Prices, period, auto-renewal, cancellation, Privacy Policy, Terms and Restore Purchases are visible before purchase. Search, previously logged meals and account deletion do not require a subscription.

Test account: none required; Kandro creates an anonymous Supabase session only after consent.

Subscription products submitted with this version:

- `[monthly product ID]`
- `[annual product ID]`
- Entitlement: `kandro_pro`

For review, use the App Store sandbox purchase sheet. If analysis is temporarily unavailable, the deterministic **Example meal** remains available, but the production endpoint is expected to be live during review.

Support: `https://getkandro.com/en/support`
Privacy: `https://getkandro.com/en/privacy`
Terms: `https://getkandro.com/en/terms`

## Final build evidence to attach internally

- Production build number and EAS build URL.
- RevenueCat Offering screenshot showing monthly and annual packages.
- Sandbox purchase and restore result on a physical iPhone.
- Video or screenshots of consent grant, consent withdrawal, and in-app account deletion.
- Live scan, description, barcode-not-found fallback, offline retry, and oversized-photo error.
- Six final App Store screenshots from the submitted binary.
- 30-meal weighed iPhone accuracy report from `npm run accuracy`.
