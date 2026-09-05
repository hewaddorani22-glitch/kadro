# 17 - Release Candidate Refresh, 5. September 2026

Dieser Nachtrag ersetzt keine historischen Rohbelege. Er dokumentiert, welche
damals offenen Gates nach dem ursprünglichen 58/100-Audit tatsächlich
geschlossen wurden.

## Reproduzierbare Quelle

- Git-Commit: `9a95530c264060d78fb94009a7cf40fc1b3ec090`
- GitHub `main`: Fast-forward auf denselben Commit
- GitHub CI: Run `33934792804`, erfolgreich
- GitHub Pages: Run `33934792870`, erfolgreich
- iOS-Kandidat: Version `1.0.0`, Build `8`
- EAS-Build-ID: `7cd7151b-a97d-471b-85f0-e5e488ae5d5f`
- App-Review-Submission: nicht erstellt und nicht abgesendet

## Lokal und remote bestanden

- vollständiges `npm run verify`, einschließlich TypeScript, 18/18 Expo
  Doctor, Webexport und aller Produktvalidatoren
- `npm run validate:eas:remote`
- `npm run validate:release:production:remote`
- Supabase Remote-Dry-Run: `upToDate:true`
- Supabase Remote-Lint: keine Schemafehler oder Warnungen
- Supabase Security Advisor: keine Fehler; Warnungen sind auf das bewusst
  anonyme, weiterhin nutzerisolierte Authmodell sowie optionale Free-Plan-
  Authfeatures beschränkt
- live authentifizierter Nutrition-Scan: HTTP 200 und plausibler
  USDA/BLS-Abgleich
- live Account-Löschung: Auth-User, Profildaten und Refreshzugang entfernt;
  RevenueCat-Erasure wird vor der Supabase-ID fail-closed ausgeführt
- live negative Tests für Function-Auth, Webhook-Auth, Guardian-Auth und
  Providerlimits
- Website-Crawl: zwölf zentrale EN/DE-URLs HTTP 200; Privacy 1.7 live

## App Store Connect und Dienste

- App-Version `1.0.0` weiterhin `PREPARE_FOR_SUBMISSION`
- keine Review-Submission vorhanden
- App Privacy veröffentlicht: Name, Device ID, Email Address, Purchase
  History, Health, Product Interaction, Other Diagnostic Data und User ID;
  Tracking `No`
- zwei Auto-Renewable Subscriptions `READY_TO_SUBMIT`, mit EN/DE-Metadaten,
  Preisen und Review-Screenshot
- RevenueCat-Produkte, Offering, Entitlement, Webhook und Sandbox Testing
  Access `Anybody` gesetzt
- PostHog verwirft Client-IP; App deaktiviert Person Profiles, Autocapture,
  Replay, Remote Flags und ungefragtes Tracking
- Paid Apps, Bank, Tax/W-8BEN und DAC7 aktiv
- DSA-Händlerprüfung weiterhin extern bei Apple `In Review`

## Bewusste Grenze

Automatisierung kann Kamera-/Torch-Geschwindigkeit, echte Barcode-Erkennung,
VoiceOver, Dynamic Type, Apple-Sandbox-Dialoge, Ask to Buy, Refund/Ablauf,
App-Kill und Gerätespeicher nicht stellvertretend beweisen. Diese Punkte
bleiben die letzte physische TestFlight-Matrix. Eine Einreichung zu App Review
wurde ausdrücklich nicht vorgenommen.
