# App Store and TestFlight handoff

This file is the source of truth for Kadro's first iOS beta. Store metadata remains a draft until the legal controller details, public privacy URL, Apple Developer account, and native subscription products are complete.

## Product metadata (German)

- **Name:** Kadro
- **Subtitle:** Die Aufstellung deines Tages
- **Primary category:** Health & Fitness
- **Bundle ID:** `com.hewaddorani.kadro`
- **Version:** `1.0.0`
- **SKU suggestion:** `kadro-ios-001`
- **Copyright:** must be filled with the legal publisher name
- **Support URL:** must be a public page with a working contact channel
- **Privacy Policy URL:** publish the reviewed `/datenschutz` landing-page route after adding the legal controller and contact details

### Promotional text

Fotografiere deine Mahlzeit, bestätige die Schätzung und sieh sofort, was heute noch passt. Kadro stellt deinen Tag nach jedem Essen neu auf.

### Description

Kadro ist kein klassisches Ernährungstagebuch. Die App hilft dir, nach jeder Mahlzeit eine praktische nächste Entscheidung zu treffen.

So funktioniert es:

- Fotografiere deine Mahlzeit.
- Prüfe erkannte Zutaten und passe die Portion mit einem Tap an.
- Sieh geschätzte Kalorien und Makronährstoffe samt Konfidenz.
- Erhalte einen neu berechneten Tagesstand.
- Wähle zwischen genau drei Ideen für Zuhause, Supermarkt oder unterwegs.

Kadro zeigt Schätzungen bewusst mit Unsicherheit und lässt dich jede Zutat vor dem Speichern korrigieren. Originalfotos werden nicht als Teil deiner Mahlzeit gespeichert. Die App bietet allgemeine Wellness-Orientierung und ersetzt keine medizinische Beratung.

### Keywords

Ernährung,Kalorien,Makros,Mahlzeit,Protein,Essensplan,Foto,Wellness,Tagesplan

### What's New

Erste private Kadro-Beta: Mahlzeitenfoto, Zutaten- und Portionskorrektur, Tagesbilanz, drei kontextbezogene nächste Ideen, Cloud-Sicherung und transparente Schätzwerte.

## Screenshot storyboard

Capture native screenshots from the production/TestFlight build, not the web preview. Use one accepted 6.9-inch portrait size, preferably `1320 × 2868` px with no alpha channel. Keep real status bars and avoid personal email addresses or account identifiers.

1. **Heute:** headline `Dein Tag. Sofort im Blick.` with calories remaining, macros, and Next Move.
2. **Scan:** headline `Ein Foto reicht.` with a real plate fully visible and the photo-only scanner.
3. **Bestätigen:** headline `Du behältst die Kontrolle.` with detected ingredients and the portion selector.
4. **Ergebnis:** headline `Schätzung statt Scheingenauigkeit.` with confidence and source labels.
5. **Plan:** headline `Drei Ideen, die jetzt passen.` with exactly three contextual recommendations.
6. **Account:** headline `Deine Daten, deine Entscheidung.` with account security, analytics opt-out, privacy, and deletion entry.

## Native TestFlight gate

1. Sign in to an Expo account and link/create the EAS project.
2. Add production environment values in EAS. Only public client values use `EXPO_PUBLIC_`; AI/USDA secrets belong behind a hosted authenticated analysis gateway, never in the iOS bundle.
3. Create the App Store Connect app record for bundle ID `com.hewaddorani.kadro`.
4. Create annual and monthly auto-renewable subscriptions, connect them to RevenueCat's `kadro_pro` entitlement, and add the public iOS RevenueCat SDK key to the production EAS environment.
5. Build with the checked-in `production` profile and submit to TestFlight.
6. Run a sandbox purchase, cancellation, entitlement refresh, and restore on a physical iPhone.
7. Test camera permission denied/granted, no network queue/retry, account linking, consent, analytics opt-out, and live account deletion in that exact build.
8. Capture the six final screenshots only after the build passes.

## Release blockers

- Legal publisher/controller name, address, contact channel, processor/transfer review, and final retention periods.
- Public privacy and support URLs.
- Hosted production analysis gateway with authentication, rate limiting, deletion/retention policy, and production secrets.
- Native StoreKit sandbox test and App Store subscription metadata/review screenshots.
- At least 30 real iPhone meal-photo results reviewed against the confirmed food and portion, including poor light, blur, partial plates, multiple dishes, and offline retry.
- Native accessibility pass with VoiceOver, Dynamic Type, Reduce Motion, and contrast on a physical iPhone.
