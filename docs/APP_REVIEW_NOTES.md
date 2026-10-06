# App Review notes — Kandro 1.0.3 (next build after 38, see Release gate in AGENTS.md)

Paste the "Review notes" section into App Store Connect → version 1.0.3 → App Review Information → Notes.

## Review notes (English)

Kandro is a general wellness calorie and nutrition tracker for users aged 14 and over. It does not diagnose or treat a medical condition and is not submitted in the Kids category.

**No login is required.** On first launch the reviewer completes a short onboarding (goal, age, body data, activity, optional target weight) and gives explicit consent before any nutrition, body, photo, voice-transcript or text data is transferred. Kandro then builds the personal plan on screen and shows it.

**Subscription and free trial.** New adult installs are randomly assigned to one of two access variants of the same subscription offer:
- Variant A: the app can be used first; the paywall appears after the free AI analyses are used.
- Variant B: after onboarding the paywall offers the 7-day free trial before AI logging starts.
Both variants show price, period, auto-renewal, cancellation, Privacy Policy, Terms and **Restore Purchases** before purchase, and both offer the same App Store products. Please use the App Store sandbox purchase sheet. Search, previously logged meals, settings, consent withdrawal and account deletion never require a subscription. Pro is shown as active only after Kandro's server verifies the Apple transaction; Restore Purchases repeats the same verification.

Subscription products:
- `com.hewaddorani.kandro.pro.monthly` (7-day free trial for eligible new subscribers)
- `com.hewaddorani.kandro.pro.annual`
- Entitlement: `kandro_pro`

**Logging.** The central button offers:
1. Photo — camera permission is requested only when Photo is chosen. A torch button is available for dark rooms.
2. Describe — type a meal in your own words, or tap the microphone and speak it. Speech is converted to text by Apple's speech recognition (on device where supported); no audio is recorded or stored.
3. Barcode — scan a packaged food.
4. Search — pick a food from the German Federal Food Code (BLS) or product database without any AI call.

Every AI estimate goes to a confirmation screen where amounts can be changed and ingredients removed before saving.

**Privacy controls.** Consent can be withdrawn under **You → Analysis & data use**; analysis and cloud processing then stop while existing data is kept. **You → Delete account and data** permanently deletes the account, cloud data, the linked RevenueCat customer and local data in the app, without contacting support. An Apple subscription remains manageable in the Apple subscription settings, linked on the same screen.

**Age and calorie safety (client and database).** Ages below 14 cannot be entered. Ages 14–15 remain locked until a parent or guardian confirms a single-use emailed link. For ages 14–17 Kandro uses the adolescent Estimated Energy Requirement (DRI 2023) including growth, applies no deficit or surplus and shows no weight pace; teens are excluded from the paywall experiment and from analytics. Adults use Mifflin-St Jeor × activity factor; targets never fall below 1,300 kcal or 70 % of maintenance. There is no fasting mode or punishment mechanic.

Sign in with Apple is optional: under **You → Account** an anonymous account can be linked to an Apple ID. Deleting the account also revokes the Apple token. No login is required to use the app.

Support: https://getkandro.com/en/support
Privacy: https://getkandro.com/en/privacy
Terms: https://getkandro.com/en/terms

## What's New (DE)

Schneller erfassen und ehrlichere Ergebnisse:
- Mahlzeit einsprechen per Mikrofon
- Taschenlampe beim Foto-Scan
- Zuverlässigere Fotoerkennung und Beschreibung, auch bei langen Sätzen
- Bessere Suche für Alltagslebensmittel (Wein, Salat, Paprika, Eiweiß …)
- Dein Plan wird jetzt Schritt für Schritt vor deinen Augen erstellt
- Viele Design- und Stabilitätsverbesserungen

## What's New (EN)

Faster logging and more reliable results:
- Speak your meal with the microphone
- Torch for photo scans
- More reliable photo recognition and descriptions, even long ones
- Better search for everyday foods
- Your plan is now built step by step in front of you
- Many design and stability improvements
