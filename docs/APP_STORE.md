# App Store and TestFlight handoff

This file is the source of truth for Kandro's first iOS beta. Store metadata remains a draft until the legal controller details, public privacy URL, Apple Developer account, and native subscription products are complete.

## Product metadata (German)

- **Name:** Kandro
- **Subtitle:** Die Aufstellung deines Tages
- **Primary category:** Health & Fitness
- **Bundle ID:** `com.hewaddorani.kandro`
- **Version:** `1.0.0`
- **SKU suggestion:** `kandro-ios-001`
- **Copyright:** must be filled with the legal publisher name
- **Support URL:** must be a public page with a working contact channel
- **Privacy Policy URL:** publish the reviewed `/datenschutz` landing-page route after adding the legal controller and contact details

### Promotional text

Fotografiere deine Mahlzeit, bestätige die Schätzung und sieh sofort, was heute noch passt. Kandro stellt deinen Tag nach jedem Essen neu auf.

### Description

Kandro ist kein klassisches Ernährungstagebuch. Die App hilft dir, nach jeder Mahlzeit eine praktische nächste Entscheidung zu treffen.

So funktioniert es:

- Fotografiere, beschreibe oder scanne den Barcode deiner Mahlzeit.
- Prüfe erkannte Zutaten und passe die Portion mit einem Tap an.
- Sieh geschätzte Kalorien und Makronährstoffe samt Konfidenz.
- Erhalte einen neu berechneten Tagesstand.
- Wähle zwischen genau drei Ideen für Zuhause, Supermarkt oder unterwegs.

Kandro zeigt Schätzungen bewusst mit Unsicherheit und lässt dich jede Zutat vor dem Speichern korrigieren. Originalfotos werden nicht als Teil deiner Mahlzeit gespeichert. Die App bietet allgemeine Wellness-Orientierung und ersetzt keine medizinische Beratung.

### Keywords

Ernährung,Kalorien,Makros,Mahlzeit,Protein,Essensplan,Foto,Wellness,Tagesplan

### What's New

Erste private Kandro-Beta: Foto, Beschreibung oder Barcode, Zutaten- und Portionskorrektur, Tagesbilanz, drei kontextbezogene nächste Ideen, echter Gewichtsverlauf, Cloud-Sicherung und transparente Schätzwerte.

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
3. Create the App Store Connect app record for bundle ID `com.hewaddorani.kandro`.
4. Create annual and monthly auto-renewable subscriptions, connect them to RevenueCat's `kandro_pro` entitlement, and add the public iOS RevenueCat SDK key to the production EAS environment.
5. Build with the checked-in `production` profile and submit to TestFlight.
6. Run a sandbox purchase, cancellation, entitlement refresh, and restore on a physical iPhone.
7. Test camera permission denied/granted, no network queue/retry, account linking, consent, analytics opt-out, and live account deletion in that exact build.
8. Capture the six final screenshots only after the build passes.

## Release blockers

- Apple Developer Program activation is pending Apple's identity review. The signed bundle ID, App Store record, subscriptions, and TestFlight upload remain unavailable until Apple approves the paid enrollment.
- Legal publisher/controller name, address, contact channel, processor/transfer review, and final retention periods.
- Public privacy and support URLs.
- Final legal/provider disclosure and retention review for the live production analysis gateway.
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

Die Website liegt in `site/` und wird als statische Dateien deployt; siehe
[site/README.md](../site/README.md).

Die Rechtstexte auf der Website und in der App sind wortgleich. Änderst du
einen, ändere beide.
