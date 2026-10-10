# App Review notes — Kandro 1.0.4 (candidate build 41; not submitted)

> Updated 09.10.2026. The production access experiment is confirmed paused. Build 41 must pass the real-device purchase/trial checks and receive exact-build owner approval before these notes are submitted.

Paste the "Review notes" section into App Store Connect → version 1.0.4 → App Review Information → Notes.

## Review notes (English)

Kandro is a general wellness calorie and nutrition tracker for users aged 16 and over (age rating 16+). After every meal it suggests three dishes that fit the rest of the day. It does not diagnose or treat a medical condition and is not submitted in the Kids category.

**No login is required.** On first launch the reviewer completes a short onboarding (goal, age, body data and activity; five steps including the starting plan) and gives explicit consent before any nutrition, body, photo, voice-transcript or text data is transferred. Kandro then builds the personal plan on screen and shows it. The first meal can be logged immediately. A dismissible Pro offer appears after the first saved meal. The optional reminder prompt follows that offer; declining notifications does not prevent use.

**Subscription and free trial.** Every user gets the same access (the earlier access experiment is paused). Food search, barcode, daily balance, meal suggestions and history are free, together with three successful AI analyses by photo, voice or text. A dismissible offer appears after the first saved meal, and another offer appears when the three free AI analyses are exhausted. Kandro Pro includes: further photo, voice and text analyses (fair use: up to 60 per day) and the weekly review. The paywall can always be closed; the free features keep working without a purchase. It shows price, period, auto-renewal, cancellation, Privacy Policy, Terms and **Restore Purchases** before purchase. Both the monthly and annual product currently include a seven-day free trial for eligible subscribers (Apple metadata checked 6 October 2026). Please use the App Store sandbox purchase sheet. Previously logged meals, settings, consent withdrawal and account deletion always remain accessible. Pro is shown as active only after Kandro's server verifies the Apple transaction; Restore Purchases repeats the same verification.

Subscription products:
- `com.hewaddorani.kandro.pro.monthly` (7-day free trial for eligible new subscribers)
- `com.hewaddorani.kandro.pro.annual` (7-day free trial for eligible new subscribers)
- Entitlement: `kandro_pro`

**Logging.** The central button offers:
1. Photo — camera permission is requested only when Photo is chosen. A torch button is available for dark rooms.
2. Describe — type a meal in your own words, or tap the microphone and speak it. Speech is converted to text by Apple's speech recognition (on device where supported); no audio is recorded or stored.
3. Barcode — scan a packaged food.
4. Search — pick a food from the German Federal Food Code (BLS) or product database without any AI call.

Every AI estimate goes to a confirmation screen where amounts can be changed and ingredients removed before saving. Nutrition values remain estimates, especially for portions, hidden ingredients and mixed dishes.

**Privacy controls.** Consent can be withdrawn under **You → Analysis & data use**; analysis and cloud processing then stop while existing data is kept. **You → Delete account and data** permanently deletes the account, cloud data, the linked RevenueCat customer and local data in the app, without contacting support. An Apple subscription remains manageable in the Apple subscription settings, linked on the same screen.

**Age and calorie safety.** New users cannot select an age below 16 in this build. Existing users from earlier builds keep the applicable legacy safety protections. For ages 16–17 Kandro uses the adolescent Estimated Energy Requirement (DRI 2023) including growth, applies no deficit or surplus and shows no weight pace; they are excluded from analytics. Adults use Mifflin-St Jeor × activity factor; targets never fall below 1,300 kcal or 70 % of maintenance. There is no fasting mode or punishment mechanic.

Sign in with Apple is optional: under **You → Account** an anonymous account can be linked to an Apple ID. Deleting the account revokes stored Apple authorization when available. If no revocable authorization was stored, after confirmed deletion the app explains how to remove its Apple authorization in Apple settings. No login is required to use the app.

Support: https://getkandro.com/en/support
Privacy: https://getkandro.com/en/privacy
Terms: https://getkandro.com/en/terms

## What's New

The canonical DE/EN release notes are in `store.config.json`.
