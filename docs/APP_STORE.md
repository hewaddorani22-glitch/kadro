# App Store and TestFlight handoff

This file is the source of truth for Kandro's first iOS release. English is the primary App Store localization; German is provided as an additional localization. Apple activated the Developer Program membership on 4 September 2026; build-specific fields remain open until the native subscriptions and first TestFlight build exist.

## Product metadata (English — primary)

- **Name:** Kandro
- **Subtitle:** Know what to eat next
- **Primary category:** Health & Fitness
- **Bundle ID:** `com.hewaddorani.kandro`
- **Apple Team ID:** `85S69CVRAY`
- **App Store Connect Apple ID:** `6808622187`
- **Version:** `1.0.0`
- **SKU suggestion:** `kandro-ios-001`
- **Copyright:** `2026 Hewad Dorani`
- **Support URL:** `https://getkandro.com/en/support`
- **Privacy Policy URL:** `https://getkandro.com/en/privacy`
- **Age rating:** answer the current questionnaire truthfully with **Health or Wellness Topics** present and no medical-treatment or objectionable-content descriptors. Set the developer minimum to **13+**, the closest Apple tier below Kandro's enforced 14+ onboarding minimum. Do not select the Kids category.

### Promotional text

Snap what you ate. Confirm the estimate and know what fits next. Kandro re-plans your day after every meal.

### Description

Kandro is not another food diary. It helps you make the next practical decision after every meal.

How it works:

- Photograph or describe a meal, scan a barcode, or search for a food.
- Review every detected ingredient and adjust the portion before saving.
- See estimated calories and macros with confidence and source labels.
- Get a recalculated daily balance.
- Choose from exactly three ideas for home, the supermarket or on the go.

Kandro shows estimates honestly and keeps every ingredient and portion editable. Original photos are discarded after analysis and are not saved with your meal. Kandro is a general wellness tool from age 14 and does not replace medical advice. Ages 14–15 require guardian confirmation; ages 14–17 receive no prescribed calorie deficit or surplus.

### Keywords

nutrition,calories,macros,meal,protein,food,photo,wellness,daily plan

### What's New

Meet Kandro: meal photo, description, barcode and food search; ingredient and portion review; adaptive daily totals; three practical next-meal ideas; progress and secure cloud sync.

## German localization

- **Subtitle:** Die Aufstellung deines Tages
- **Promotional text:** Fotografiere deine Mahlzeit, bestätige die Schätzung und sieh sofort, was heute noch passt. Kandro stellt deinen Tag nach jedem Essen neu auf.
- **Keywords:** Ernährung,Kalorien,Makros,Mahlzeit,Protein,Essensplan,Foto,Wellness,Tagesplan
- **Support URL:** `https://getkandro.com/support`
- **Privacy Policy URL:** `https://getkandro.com/privacy`
- Use the German description from `store.config.json`, with the same 14+, guardian, growth-safe estimate and non-medical disclosures as the English description.

## Screenshot storyboard

Capture native screenshots from the production/TestFlight build, not the web preview. Use one accepted 6.9-inch portrait size, preferably `1320 × 2868` px with no alpha channel. Keep real status bars and avoid personal email addresses or account identifiers.

1. **Heute:** headline `Dein Tag. Sofort im Blick.` with calories remaining, macros, and Next Move.
2. **Scan:** headline `Foto, Text oder Barcode.` with a real plate fully visible and the three honest input modes.
3. **Bestätigen:** headline `Du behältst die Kontrolle.` with detected ingredients and the portion selector.
4. **Ergebnis:** headline `Schätzung statt Scheingenauigkeit.` with confidence and source labels.
5. **Plan:** headline `Drei Ideen, die jetzt passen.` with exactly three contextual recommendations.
6. **Account:** headline `Deine Daten, deine Entscheidung.` with account security, analytics opt-out, privacy, and deletion entry.

## Native TestFlight gate

1. [x] Sign in to Expo and link the EAS project `@hewad/kandro`.
2. [x] Add the public Supabase production values in EAS and keep the local gateway override absent. AI/USDA secrets are live behind the authenticated Supabase gateway, never in the iOS bundle.
3. [x] Create the App Store Connect app record for bundle ID `com.hewaddorani.kandro`. Store metadata is versioned in `store.config.json`; review-contact details, subscription metadata, privacy nutrition labels, regulated-medical-device status, DSA trader details, and screenshots remain dashboard-only checks.
4. Create `com.hewaddorani.kandro.pro.monthly` and `com.hewaddorani.kandro.pro.annual` as auto-renewable subscriptions, connect them to RevenueCat's `kandro_pro` entitlement, and add the public iOS RevenueCat SDK key to the production EAS environment.
5. Build with the checked-in `production` profile and submit to TestFlight.
6. Run a sandbox purchase, cancellation, entitlement refresh, and restore on a physical iPhone.
7. Test camera permission denied/granted, no network queue/retry, account linking, consent, analytics opt-out, and live account deletion in that exact build.
8. Capture the six final screenshots only after the build passes.

## Remaining native evidence

- Native StoreKit sandbox test and App Store subscription metadata/review screenshots.
- At least 30 real iPhone meal-photo results reviewed against the confirmed food and portion, including poor light, blur, partial plates, multiple dishes, and offline retry.
- Native accessibility pass with VoiceOver, Dynamic Type, Reduce Motion, and contrast on a physical iPhone.

## Anbieter- und URL-Angaben

Diese Werte sind gesetzt und werden von `npm run validate:release` erzwungen:

| Feld | Wert |
|---|---|
| Anbieter | Hewad Dorani, Altenessener Str. 124, 45326 Essen |
| Rechtsform | Einzelunternehmen (Kleingewerbe), § 19 UStG |
| Kontakt | hewaddorani22@gmail.com |
| Privacy Policy URL | https://getkandro.com/privacy |
| Support URL | https://getkandro.com/support |
| Bedingungen | https://getkandro.com/terms |
| Impressum | https://getkandro.com/impressum |

Die Website liegt in `site/` und wird bei jedem Push automatisch über GitHub
Pages deployt. Sie ist bereits live unter
https://getkandro.com/ sowie als GitHub-Pages-Ursprung unter
https://hewaddorani22-glitch.github.io/kadro/.

Die Rechtstexte auf der Website und in der App sind wortgleich. Änderst du
einen, ändere beide.

The exact privacy-label mapping is in [APP_PRIVACY.md](./APP_PRIVACY.md). The reviewer-ready English note and the evidence checklist are in [APP_REVIEW_NOTES.md](./APP_REVIEW_NOTES.md). Run the production gate inside the EAS production environment before building: `npm run validate:release:production`.
