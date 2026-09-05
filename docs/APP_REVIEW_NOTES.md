# App Review notes — Kandro 1.0

Paste the relevant section into App Store Connect after replacing the bracketed build-specific values.

## Review notes (English)

Kandro is a general wellness nutrition-planning app for users aged 14 and over. It does not diagnose or treat a medical condition and is not submitted in the Kids category.

No login is required. On first launch, the reviewer completes onboarding and gives explicit consent before any nutrition, body, photo or text data is transferred. Consent can be withdrawn under **You → Analysis & data use**. The app then blocks all analysis and cloud processing while preserving existing data. **You → Delete account and data** permanently deletes the Supabase account, linked Kandro cloud data, linked RevenueCat customer and local Kandro data without contacting support. An Apple subscription remains separately manageable through the Apple subscription settings, which are linked on the same screen.

The central Scan button offers four paths:

1. Photo: camera permission is requested only after the reviewer chooses Photo. Photograph one meal, then tap the shutter.
2. Describe: enter a meal in words.
3. Barcode: scan a packaged-food barcode.
4. Search: select a food without an AI call.

Every photo or text estimate goes to a confirmation screen before it is saved. The reviewer can change gram amounts and remove ingredients. The meal result then updates the daily targets and reveals exactly three next-meal options.

The first three successful AI results are free and count when the result is returned, even if the confirmation screen is later abandoned. Afterwards the paywall offers the live App Store monthly and annual subscriptions, with up to 60 photo or text analyses per UTC day. Prices, period, auto-renewal, cancellation, Privacy Policy, Terms and Restore Purchases are visible before purchase. Search, previously logged meals and account deletion do not require a subscription. After purchase or restore, Kandro displays Pro as active only after its authenticated server verifies a currently access-giving Apple App Store subscription against the submitted app, product and entitlement IDs. The app performs a bounded retry if RevenueCat has not yet observed the Apple transaction; Restore Purchases repeats the same server verification and never grants access from the device alone.

**Age and calorie safety are enforced in both the client and database.** Ages below 14 cannot be entered. Ages 14–15 remain locked until a parent or legal guardian affirmatively confirms a single-use emailed link; the protected analysis gateway independently verifies that record before any provider receives data. Ages 16–17 can consent themselves. Optional PostHog analytics remain disabled for every user under 18.

For ages 14–17, Kandro uses the 2023 Dietary Reference Intake adolescent Estimated Energy Requirement equation, which includes normal growth. Their goal may change meal ranking, but Kandro applies neither a calorie deficit nor a surplus and shows no weight-change pace. Adults use Mifflin-St Jeor times an activity factor. Adult targets never fall below 1,300 kcal or 70% of maintenance, whichever is higher. There is no aggressive option, fasting mode, streak or punishment mechanic.

Test account: none required; Kandro creates an anonymous Supabase session only after consent.

Subscription products submitted with this version:

- `com.hewaddorani.kandro.pro.monthly`
- `com.hewaddorani.kandro.pro.annual`
- Entitlement: `kandro_pro`

For review, use the App Store sandbox purchase sheet. Apple sandbox subscriptions are accepted for TestFlight/App Review; RevenueCat Test Store purchases used by Expo Go are explicitly rejected by the production gateway. If analysis is temporarily unavailable, the deterministic **Example meal** remains available, but the production endpoint is expected to be live during review.

**Age policy.** The Terms, onboarding and database consistently require age 14 or over. Apple’s questionnaire should disclose Health or Wellness Topics and a 13+ developer age tier; the app itself blocks age 13 and below. This is not a Kids-category app. Guardian confirmation for ages 14–15 is described in the privacy notice and can be withdrawn through support.

Adolescent EER methodology: `https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html`

Support: `https://getkandro.com/en/support`
Privacy: `https://getkandro.com/en/privacy`
Terms: `https://getkandro.com/en/terms`

## Final build evidence to attach internally

- Production build number and EAS build URL.
- RevenueCat Offering screenshot showing monthly and annual packages.
- Sandbox purchase and restore result on a physical iPhone.
- Video or screenshots of consent grant, consent withdrawal, and in-app account deletion.
- Live scan, description, barcode-not-found fallback, offline retry, and oversized-photo error.
- Five final App Store screenshots per locale from the submitted binary.
- 30-meal weighed iPhone accuracy report from `npm run accuracy`.
