# 02 – Projektinventar

Stand: 5. September 2026
Audit-Basis: Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5` plus die im aktuellen Arbeitsbaum lokal verifizierten Audit-Remediations
Branch: `audit/app-store-release-gate-20260904`
Scope: statischer Projekt-, Datei-, Konfigurations- und Backend-Inventar-Audit einschließlich lokal ergänzter Remediations; kein Deployment und keine Submission

## Ergebnis

Status: **UNVERIFIED_BLOCKER** für die Freigabe als Ganzes. Die JavaScript/TypeScript-Seite lässt sich reproduzierbar prüfen. EAS hat aus dem hochgeladenen Audit-Arbeitsbaum ein signiertes Store-Archiv **Kandro 1.0.0 (7)** für `com.hewaddorani.kandro` erfolgreich erzeugt (Build-ID `420935a7-2aed-43e1-9daf-cb53f306a549`, SDK 54, Fingerprint `e410ce56a5e09e470cff837903cbbb433924a639`, IPA-SHA-256 `c027a4957b148a846c7a5faf434afa60dd1f3aac76c92d29806dd3ac911b6d4e`). EAS zeigt dabei als Git-Basis weiterhin `22b1bf91…`; weil der Upload lokale Auditänderungen enthielt, ist der Fingerprint und nicht dieser Basis-Commit die belastbare Artefaktidentität. Die statische Archivprüfung bestätigt arm64, iOS 15.1, Xcode/SDK 26.0, App-Store-Profil, `get-task-allow=false`, strikte Deep-Signatur, ATS strict, 16 Privacy Manifests und keine Provider-Secrets/operative Dev-URL. Build 7 wurde weder installiert noch zu TestFlight/App Store Connect hochgeladen oder eingereicht. Native Geräte-, StoreKit-, Accessibility-, Apple-Processing- und zusammengeführte Privacy-Report-Prüfungen bleiben offen.

Der erste Baseline-Index erfasste **246 versionierte Dateien**. Der abschließend neu erzeugte produktrelevante Working-Tree-Index erfasst **262 Dateien** (Auditberichte, Evidenz, `tmp/`, `dist/` und `.expo/` ausgenommen). [`02_FILE_AUDIT_INDEX.csv`](./02_FILE_AUDIT_INDEX.csv) enthält für genau diesen aktuellen Dateisatz den am 5. September 2026 neu berechneten Git-Blobhash, Eigentum, Klasse, erlaubten Auditstatus, Prüfmethode und Finding-Verweise. Die 246er-Tabelle unten bleibt ausschließlich historische Ausgangsevidenz.

## Auditgrenzen

- Geprüft wurden alle versionierten app-eigenen Dateien per vollständigem Index, TypeScript-Typecheck, gezielten Pattern-Scans und manueller Prüfung der sicherheits- und releasekritischen Pfade.
- Generierte/Vendor-Artefakte wurden nicht pauschal ignoriert: Lockfile, Herkunft, Integrität, Lizenzen, npm-Advisories, native Autolink-Ergebnisse, vorhandene Privacy Manifests und Apple-SDK-Pflichten sind in `05_DEPENDENCY_SDK_AUDIT.md` inventarisiert.
- Binäre Store-/Website-Assets wurden nach Zweck und Herkunft klassifiziert. Pixel-/Store-Metadatenprüfung gehört in den gesonderten Store- und Runtime-Audit.
- `node_modules`, Expo-Buildcache und temporär erzeugte iOS-Dateien sind nicht versioniert. Für Native Discovery wurde ein `expo prebuild --no-install --platform ios` ausschließlich in `/tmp` ausgeführt.
- Der bestehende unversionierte Ordner `tmp/` wurde nicht verändert. Auditberichte und Evidenz sind bewusst nicht Teil des produktrelevanten Index, weil sie das Prüfergebnis statt den auslieferbaren Produktstand bilden; die lokalen Produkt-Remediations sind vollständig im 262-Dateien-Index enthalten.
- Lokal wurden unter anderem Provider-Logging, serverseitige Analyseberechtigung, Guardian-/Wartelisten-Retention, rechtliche Copy und mehrere Runtime-/Accessibility-Fehler korrigiert und automatisiert getestet. Kein App-Store-Upload, kein Deployment und keine Remote-Schreiboperation wurde ausgeführt.

## Gelesene Leitdokumente

| Datei | Prüfart | Wesentliche Festlegung |
|---|---|---|
| `AGENTS.md` | READ_FULL | Expo SDK 54 ist bewusst fixiert; Kernloop, Datenschutz- und Designinvarianten |
| `README.md` | READ_FULL | iOS-first Expo-App, anonyme Supabase-Session, drei kostenlose KI-Analysen, RevenueCat, EU-PostHog |
| `docs/ARCHITECTURE.md` | READ_FULL | lokale/Cloud-Datenflüsse, Auth/RLS, temporäre Fotos, Integrationsgrenzen |
| `docs/ROADMAP.md` | READ_FULL | Day 4 Code abgeschlossen; native TestFlight-, StoreKit-, Geräte- und Fotogenauigkeits-Gates offen |

## Projektaufbau

```text
Expo Router / React Native 0.81.5 / TypeScript
├── src/app                     20 Routen, davon 5 Primärtabs
├── src/components              wiederverwendbare UI
├── src/context                 zentraler App-Zustand und Core-Loop
├── src/services                Analyse, Supabase, Sync, Billing, Analytics
├── src/data                    zweisprachige Kataloge/Referenzen
├── src/i18n                    Englisch + Deutsch
├── server                      optionaler LAN-Entwicklungs-Gateway
├── supabase
│   ├── functions               5 Edge Functions + 7 Shared-Module
│   ├── migrations              17 Migrationen
│   └── templates               E-Mail-Template
├── app-store                   Store-Screenshots und Preview-Kontaktbögen
├── site                        zweisprachige Landingpage und Rechtstexte
├── scripts                     54 Build-/Validierungsprogramme
└── assets/docs/config          App-Assets, Dokumentation und Release-Konfiguration
```

## Baseline-Datei-Inventar

Die folgenden Zählungen dokumentieren nur den ersten 246-Dateien-Ausgangsindex. Der verbindliche aktuelle Produktdateisatz mit 262 Dateien steht im maschinenlesbaren Abschlussindex. Dort bedeutet `PASS`, dass die für die Dateiklasse dokumentierte Prüfung ohne dateispezifischen offenen Befund abgeschlossen wurde; `FIXED_VERIFIED` kennzeichnet lokal korrigierte und durch die angegebene Methode erneut geprüfte Dateien; zwei Dokumentationsdateien tragen wegen INV-03 `FAIL`. Systemweite Live-/Geräte-Gates werden dadurch nicht positiv vorweggenommen.

### Nach Eigentum

| Eigentumsklasse | Anzahl | Behandlung |
|---|---:|---|
| APP_OWNED | 241 | vollständig indexiert; Source/Config nach Klasse typechecked, statisch oder manuell geprüft |
| APP_CURATED_THIRD_PARTY_DERIVATIVE | 1 | Herkunft/Lizenz inventarisiert |
| THIRD_PARTY_DERIVED_DATA | 1 | Herkunft/Lizenz inventarisiert |
| THIRD_PARTY_CAPTURED_FIXTURE | 1 | Testfixture klassifiziert, nicht als eigene Aussage behandelt |
| THIRD_PARTY_LICENSED_ASSET | 1 | Lizenz/Attribution inventarisiert |
| GENERATED_DEPENDENCY_METADATA | 1 | Lockfile- und Supply-Chain-Audit |
| **Gesamt** | **246** |  |

### Nach Dateiklasse

| Klasse | Anzahl |
|---|---:|
| APP_SOURCE | 71 |
| TEST_OR_BUILD_SCRIPT | 52 |
| WEBSITE_SOURCE | 23 |
| DOCUMENTATION | 15 |
| DATABASE_MIGRATION | 14 |
| APP_ASSET | 10 |
| GENERATED_STORE_ASSET | 10 |
| EDGE_FUNCTION | 8 |
| APP_DATA | 8 |
| APP_BUILD_CONFIG | 6 |
| WEB_ASSET | 6 |
| OTHER | 5 |
| CI_CONFIG | 3 |
| BINARY_ASSET | 3 |
| ENV_TEMPLATE | 2 |
| DEV_SERVER_SOURCE | 2 |
| je 1 | BLS_DATASET, BLS_REFERENCE_DATA, BACKEND_CONFIG, DEPENDENCY_MANIFEST, LOCKFILE, LEGAL_ATTRIBUTION, REPOSITORY_CONFIG, TEST_FIXTURE |

### Nach Prüfart

| Prüfart | Anzahl | Bedeutung |
|---|---:|---|
| TYPECHECKED_STATIC_REVIEW | 71 | Typecheck + Patternscan + gezielte manuelle Prüfung kritischer Stellen |
| INVENTORIED_SCRIPT | 45 | inventarisiert; einzelne Validatoren zusätzlich ausgeführt |
| ASSET_CLASSIFIED | 29 | Zweck/Herkunft klassifiziert |
| SECURITY_REVIEWED | 28 | gezielte Security-/RLS-/Secret-/Konfigurationsprüfung |
| INDEXED_FOR_WEB_LEGAL_AUDIT | 23 | an Web-/Rechtstext-Audit übergeben |
| INVENTORIED_REFERENCE | 12 | Dokumentations-/Referenzbestand inventarisiert |
| DATA_VALIDATED | 8 | vorhandene Katalog-/Datenvalidatoren bzw. strukturelle Prüfung |
| EXECUTED_OR_STATIC_REVIEWED | 7 | relevante Build-/Auditprogramme ausgeführt oder manuell bewertet |
| CONFIG_REVIEWED | 6 | Expo/EAS/TypeScript/Store-Konfiguration geprüft |
| INDEXED_STATIC | 5 | vollständig erfasst; keine ausführbare Releasefläche |
| READ_FULL | 4 | vollständig gelesen |
| DEPENDENCY_AUDITED | 2 | Manifest + Lockfile |
| VENDOR_DATA_CLASSIFIED | 2 | Drittanbieter-Datenbestand klassifiziert |
| FIXTURE_CLASSIFIED | 1 | externes Testfixture klassifiziert |

Die Prüfarten sind bewusst enger als „vollständig manuell reviewed“. Der Index behauptet insbesondere bei 52 Hilfsskripten, 29 Assets und 23 Website-Dateien keine nicht durchgeführte Einzelprüfung.

## Plattform- und Releasekonfiguration

| Bereich | Ist-Zustand | Evidenz/Prüfart |
|---|---|---|
| Produkt | Kandro 1.0.0 | `app.json`, `package.json` |
| Primärziel | iPhone/iOS; `supportsTablet=false`; Portrait; Light/Dark automatisch | `app.json`; CONFIG_REVIEWED |
| Bundle ID | `com.hewaddorani.kandro` | `app.json`; temporäres Prebuild |
| Scheme | `kandro` | `app.json`; temporäres Prebuild |
| App Store Connect | numerische App-ID in EAS-Submitprofil gesetzt | `eas.json`; Wert nicht in diesem Bericht wiederholt |
| Expo/EAS | Expo SDK 54, EAS Projekt gebunden, Remote-Versionierung, Auto-Increment | `app.json`, `eas.json` |
| iOS Minimum / Architektur / Toolchain | iOS 15.1 / arm64 / Xcode-SDK 26.0 | Build-7-Archivinspektion |
| JS Engine | Hermes | generiertes Podfile; Build-7-Frameworkbestand und strikte Deep-Signatur statisch bestanden; SDK-Einzel-/Apple-Processing-Gate bleibt |
| New Architecture | aktiviert im generierten Info.plist | temporäres Prebuild |
| OTA Updates | Expo-Plist enthält `EXUpdatesEnabled = 0`; `expo-updates` nicht installiert | `PASS`; keine Remote-Code-Updates im aktuellen Dependencybaum |
| Transport Security | `NSAllowsArbitraryLoads=false` | `app.json`, temporäres Info.plist und Build-7-Archiv |
| Verschlüsselung | `ITSAppUsesNonExemptEncryption=false` | `app.json` und Build-7-Archiv; Storeantwort separat bestätigen |
| Kamera | Kamera-Purpose-String; kein Mikrofon/Audio | `app.json`; `expo-camera` Plugin |
| Benachrichtigungen | nur lokale Erinnerungen im App-Code | `src/services/reminders.ts`; generiertes APNs-Entitlement siehe DEP-04 |
| Tablet | nicht unterstützt | `app.json` |
| App Groups/Associated Domains/HealthKit/Keychain Groups | im generierten Projekt und Build-7-Entitlementscan nicht gefunden | `PASS` für Build 7; bei geändertem oder späterem Submission-Build erneut prüfen |

## Laufzeit- und Buildumgebung

| Werkzeug | Ergebnis |
|---|---|
| macOS | 13.4 (22F2063) |
| Node | 24.14.1 |
| npm | 11.11.0 |
| Expo CLI | 54.0.27; Paket `expo` 54.0.37 |
| React Native | 0.81.5 |
| TypeScript | 5.9.3 |
| Supabase CLI | 2.116.0 |
| Swift | 5.8.1 |
| Xcode | **nicht verfügbar**; aktiver Developer-Pfad zeigt nur Command Line Tools |
| CocoaPods | **nicht installiert** (`pod`: command not found) |

Folge: Der statische iOS-JS-Export und ein temporäres Prebuild waren lokal möglich. EAS erzeugte Build 7 erfolgreich als signiertes Store-IPA; die lokale statische IPA-Prüfung bestand Signatur-, Architektur-, Plist-/Entitlement-, Framework-/Manifest- und Dev-/Secret-Scans. Lokale Pod-Auflösung, lokaler Release-Build, ein `.xcarchive` und ein zusammengeführter Xcode Privacy Report waren auf diesem Mac weiterhin nicht möglich. Der Cloud-/Archivpass ersetzt weder Installation/Laufzeit noch StoreKit, Apples Processing oder den Xcode Privacy Report.

## UI-, Feature- und Datenflächen

| Fläche | Einstieg/Code | Netzwerk/Backend | lokale Daten | Monetarisierung/Berechtigung |
|---|---|---|---|---|
| Consent/Onboarding | `data-consent.tsx`, `onboarding.tsx`, `AppRouteGuard` | Supabase Profile; Guardian-Funktion für 14–15 | Profil, versionierte Einwilligung | Voraussetzung für Wellness-/KI-Verarbeitung |
| Today/Progress/Profile | fünf Tabs, `AppContext` | optionale Supabase-Synchronisierung | Profil, Targets, Mahlzeiten, Gewichte | Grundfunktion gratis |
| Fotoanalyse | `scan` → `mealAnalysis` → `nutrition` | Supabase Edge → OpenRouter/Azure → BLS/USDA; RevenueCat Customer Subscriptions für Pro | komprimiertes Bild nur aktiver Flow; maximal 3 fehlgeschlagene Scans in Queue | lokal serverseitig: drei Lifetime-Free-Erfolge pro User, max. 60 Pro/User/UTC-Tag, 1.000 KI-Providerstarts global/UTC-Tag sowie atomare User-/Netz-/Global-Limits für USDA/OFF/RevenueCat; Live-Gateway noch unverändert |
| Beschreibung | Scan-Describe → `nutrition/v1/describe` | wie Foto ohne Kamera | Text nur transient, Resultat nach Bestätigung | wie Fotoanalyse |
| Barcode | Scan-Barcode → Open Food Facts | `nutrition/v1/barcode` | nur bestätigtes strukturiertes Resultat | kostenlos |
| Suche | Scan-Suche → BLS/USDA | `nutrition/v1/search` | nur bestätigtes Resultat | kostenlos |
| Empfehlungen | Today/Plan/Result | Katalog lokal; Feedback optional Supabase | Auswahl/Meal | genau drei Optionen; Grundfunktion |
| Billing | Paywall/Profil | RevenueCat / StoreKit im nativen Build | öffentliche Konfiguration, Entitlementcache im SDK | Pro Monats-/Jahresabo |
| E-Mail-Verknüpfung | Profil `AccountLinkCard` | Supabase Auth/Resend SMTP | persistierte Supabase-Session | optional |
| Analytics | expliziter Profil-Opt-in | EU PostHog | SDK-Opt-in-Status | unter 18 deaktiviert; keine Session Replay/Autocapture |
| Account-Löschung | Profil → `delete-account` | authentifizierte Edge Function | danach lokale Bereinigung | Abo separat über Apple verwaltet |
| Warteliste | öffentliche Website | Supabase waitlist + Resend | keine App-Lokalspeicherung | Marketing, Double Opt-in |

## Speicher- und Vertrauensgrenzen

- `AsyncStorage`: Supabase-Session/Refresh-Token, Profil, Ziele, Mahlzeiten, Gewichte, Consent, Scan-Zähler, lokale Erinnerungsflags und maximal drei fehlgeschlagene komprimierte Fotos. Siehe SEC-04.
- App-Cache: komprimierte Arbeitskopie eines Fotos während Analyse; Kameraoriginal wird nach erfolgreicher Kompression entfernt.
- Supabase (EU-Projekt laut Projektdokumentation): Auth, RLS-geschützte Profile/Targets/Mahlzeiten/Feedback sowie server-only Tabellen für User-/globale Quota, kurzlebige Provider-Ratenzähler, Analyse-Request-Ledger, Entitlementstatus/Refresh-Cooldown, RevenueCat-Webhook-Deduplizierung, Cache, Guardian-Requests und Warteliste.
- OpenRouter (U.S.-Verarbeitung offengelegt) mit Azure-only, ZDR, `store:false`, keine Fallbacks; Bild/Text nur bei bewusst gestarteter Analyse.
- USDA/Open Food Facts: Lebensmittelsuche/Nährwerte; kein Provider-Secret im Client.
- RevenueCat: Kaufstatus im nativen Build; nur öffentliche SDK-Schlüssel im Expo-Client. Der lokale Auditstand ergänzt einen serverseitigen Customer-Subscriptions-REST-v2-/Webhook-Abgleich mit exakter Apple-Store-/App-/Produkt-/Entitlement-Allowlist und Test-Store-Ablehnung; live noch nicht ausgerollt.
- PostHog EU: opt-in, allowlisted kategoriale Events; keine Gesundheitswerte/Identifikatoren laut Code-Gate.

## Backendinventar

### Edge Functions

| Funktion | Auth-Grenze | Remote-Status im Audit | Zweck |
|---|---|---|---|
| `nutrition` | Plattform-JWT + `auth.getUser`, Consent/Alter/Guardian; lokal zusätzlich serverseitiges Free-/Pro-Ledger, globaler Circuit-Breaker, Provider-Ratelimits und authentifizierter Entitlement-Refresh | ACTIVE, `verify_jwt=true`, aber noch ohne die drei lokalen Migrationen und zugehörige aktuelle Function-Fassung | Foto/Text/Barcode/Suche sowie lokal `POST /v1/entitlement/refresh` |
| `delete-account` | Plattform-JWT + `auth.getUser` | ACTIVE, `verify_jwt=true` | exakten Auth-User löschen |
| `waitlist` | öffentlich; enge Originliste, IP-Hash-Rate-Limit | ACTIVE, `verify_jwt=false`; neue Lösch-/Retentionlogik noch nicht deployed | Double-Opt-in-Warteliste |
| `guardian-consent` | öffentliche Bestätigungslinks; Request/Status prüft User-JWT im Handler | ACTIVE, `verify_jwt=false`; atomare Single-use-/Purgelogik noch nicht deployed | Eltern-/Sorgeberechtigtenzustimmung 14–15 |
| `revenuecat-webhook` | dedizierter Authorization-Wert + RevenueCat-HMAC über Raw Body; keine User-JWT | nur lokal vorhanden, nicht deployed | serverseitige Pro-Entitlement-Synchronisierung |

### Datenbank

- **17 lokale Migrationen** liegen vor. Der finale Remote-Dry-Run (Exit 0, `dryRun:true`) weist genau drei noch nicht ausgerollte Migrationen aus: `20260904184701_add_waitlist_retention.sql`, `20260904185227_server_authoritative_analysis_access.sql` und `20260904212500_rate_limit_nutrition_providers.sql`. Es besteht daher bewusst **keine** Remote-Parität.
- Der frühere Remote-`supabase db lint --level warning --linked` lief gegen den damaligen 14-Migrationen-Stand mit Exit 0. Die drei neuen Migrationen sind erst nach Deployment erneut remote zu linten und funktional zu testen.
- Alle clientseitig verwendeten Tabellen aktivieren RLS und haben owner-gebundene Policies/gezielte Grants.
- `analysis_usage`, `analysis_access`, `analysis_requests`, `analysis_global_usage`, `revenuecat_webhook_events`, `usda_food_cache`, `waitlist` und `guardian_consent_requests` haben lokal keine Client-Policies und ihre Tabellenrechte für `anon`/`authenticated` sind widerrufen. `private.nutrition_provider_rate_limits` liegt zusätzlich außerhalb des exponierten Schemas, hat RLS und keine Clientgrants. Diese neue Analyse-/RevenueCat-/Provider-Grenze ist noch nicht remote.
- `private` ist nicht in den Data-API-Schemas exponiert. Der öffentliche Quota-Wrapper hat keine Parameter und die Implementierung verwendet ausschließlich `auth.uid()`.
- Das Remote-Secret-Inventar wurde ausschließlich als **Namensliste** geprüft. Zuletzt fehlten `NUTRITION_RATE_LIMIT_SALT`, `GUARDIAN_RATE_LIMIT_SALT` und sieben serverseitige `REVENUECAT_*`-Secrets. Ohne diese Werte muss der korrigierte Backendpfad fail-closed bleiben. Kein Secretwert wurde ausgegeben oder in Audit-Artefakte übernommen.

## Zentrale offene Inventar-Gates

| ID | Prio | Typ | Status | Sachverhalt |
|---|---:|---|---|---|
| INV-01 | P1 | BUILD/APPLE | MANUAL_CONFIRMATION_REQUIRED | Das signierte Store-IPA Build 7 besteht die statische Archivprüfung; es wurde noch nicht installiert, nicht in TestFlight hochgeladen und nicht als Submission-Build ausgewählt. Zusammengeführter Privacy Report, Apple Processing, Gerätelaufzeit und StoreKit bleiben zu belegen. |
| INV-02 | P2 | CONFIG/LEAST_PRIVILEGE | MANUAL_CONFIRMATION_REQUIRED | Build 7 enthält `aps-environment=production`, obwohl der App-Code nur lokale Notifications nutzt. Notwendigkeit dokumentieren oder Remote-Push-Capability entfernen, neu bauen und erneut prüfen. |
| INV-03 | P3 | DOC/OBSERVABILITY | FAIL | Roadmap/README erwähnen noch geplantes natives Sentry; im installierten und versionierten Dependencybaum ist kein Sentry SDK enthalten. Kein Releasecrash, aber Dokumentations-/Observability-Drift. |

## Befehlsnachweis

| Befehl/Prüfung | Exit | Ergebnis |
|---|---:|---|
| produktrelevante Working-Tree-Zählung und Abschlussindex | 0 | 262 Pfade; aktuelle Git-Blobhashes und ausschließlich erlaubte Statuswerte im finalen CSV-Index |
| `git status --short` | 0 | vorhandene fremde Änderungen erkannt und unangetastet gelassen |
| `npm run typecheck` | 0 | TypeScript ohne Fehler |
| `npm run validate:privacy` nach SEC-01 | 0 | body-bearing Fehler kollabiert auf fixen Safe Code; kein `response.text()` in beiden Gateways |
| `npm run verify` nach dem finalen lokalen Remediationstand | 0 | vollständige Repo-Suite, Expo Doctor 18/18 und Webexport bestanden; siehe `evidence/build/26_final_release_verify.log` |
| `npx expo-doctor` | 0 | 18/18 Checks bestanden |
| `npx expo config --type public --json` | 0 | öffentliche Expo-Konfiguration auflösbar |
| `npx expo export --platform ios` (Output in `/tmp`) | 0 | 1.549 Module, iOS-Bundle erzeugt |
| `expo prebuild --no-install --platform ios` (Kopie in `/tmp`) | 0 | generiertes iOS-Projekt für Discovery; keine Repoänderung |
| `npm run validate:eas` | 0 | lokale EAS-Konfigurationsregeln bestanden |
| `npm run validate:eas:remote` | 0 | Production/Preview Remote-Variablen gemäß Validator vollständig; kein lokaler Gateway in Production |
| `npx eas-cli build --platform ios --profile production --non-interactive --wait` | 0 | signiertes Store-IPA Kandro 1.0.0 (7) erfolgreich; Build-ID/Fingerprint oben; weder Upload zu TestFlight/ASC noch Submission |
| Build-7-Metadaten/SHA-256 | 0 | Build-ID, Fingerprint und IPA-SHA-256 unveränderlich festgehalten; `evidence/build/28_eas_build7_summary.json` |
| Build-7-IPA/Plist/Entitlement/Provisioning/Signaturprüfung | 0 | arm64, iOS 15.1, Xcode/SDK 26.0, Storeprofil, `get-task-allow=false`, `codesign --deep --strict` PASS; `evidence/build/29_build7_archive_inspection.txt` |
| Build-7-Bundle-/Manifestscan | 0 | 16 Privacy Manifests, Required-Reason APIs erklärt, keine Provider-Secrets/operative Dev-URL; `evidence/build/30_build7_bundle_scan.txt` |
| `npm run validate:release:production` | 1 | der secret-freie lokale Prozess hatte keinen RevenueCat-Production-Key; Remote-EAS-Konfiguration und erfolgreicher Build 7 belegen die Cloud-Buildkonfiguration, nicht den StoreKit-Lauf |
| `npm run validate:supabase` | 0 | statische Supabase-/RLS-Regeln bestanden |
| `npm run db:remote:check` | 0 | finaler Dry-run erfolgreich (`dryRun:true`); genau drei lokale Migrationen stehen zur Remote-Anwendung an; siehe `evidence/network/23_final_supabase_dry_run.log` |
| `supabase db lint --linked --level warning` | 0 | frühere 14-Migrationen-Basis ohne Remote-DB-Lintfehler; drei neue Migrationen noch nicht live geprüft |
| `supabase functions list` | 0 | vier bisher deployte Funktionen aktiv; neue `revenuecat-webhook`-Funktion fehlt live |
| `supabase secrets list` | 0 | ausschließlich Namensabgleich; zwei Rate-Limit-Salts und sieben RevenueCat-Serversecrets zuletzt fehlend |
| `npm ls expo-updates --all` | 0 | leer; keine OTA-Library installiert |
| `xcodebuild -version` | 1 | vollständiges Xcode nicht aktiv/verfügbar |
| `pod --version` | 127 | CocoaPods nicht installiert |

Die npm-, Native-SDK-, Secret- und Security-Befehle sind in `05_DEPENDENCY_SDK_AUDIT.md` und `07_CODE_SECURITY_REPORT.md` detaillierter dokumentiert.
