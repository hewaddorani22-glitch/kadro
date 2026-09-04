# 16 – Finales GO/NO-GO

## 1. Urteil

**Status: `NO_GO`**

Mindestens ein technischer, datenschutzbezogener, geschäftlicher und
reviewkritischer Blocker besteht. Tatsächlich bestehen mehrere voneinander
unabhängige P0-Gates. Ein `GO` oder `CONDITIONAL_NO_GO` wäre nach den
Auditregeln daher nicht wahrheitsgemäß.

## 2. Geprüfte Identität

| Merkmal | Wert |
| --- | --- |
| App | Kandro |
| Marketingversion | `1.0.0` |
| EAS-Auditarchiv | Build `7` |
| EAS Build-ID | `420935a7-2aed-43e1-9daf-cb53f306a549` |
| Bundle ID | `com.hewaddorani.kandro` |
| Plattform/Architektur | iOS / arm64 |
| Mindest-iOS | 15.1 |
| Buildtoolchain | Xcode 26.0 / iOS SDK 26.0 |
| EAS-Fingerprint | `e410ce56a5e09e470cff837903cbbb433924a639` |
| Source-Basis | Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5` plus Audit-Working-Tree beim Upload |
| Auditdatum | 5. September 2026, Europe/Berlin |

EAS weist als Git-Commit den Basiscommit aus, obwohl der Upload die lokalen
Audit-Remediations enthielt. Der Fingerprint identifiziert den hochgeladenen
Kontext, ersetzt aber keinen sauberen, reproduzierbaren Release-Commit. Nach
Produktiv-Rollout und finaler Konfigurationsfreigabe ist daher ein sauberer
Submission-Build erforderlich; Build 7 wird nicht als unveränderlicher finaler
Review-Candidate ausgegeben.

## 3. Submission Readiness Score

| Kategorie | Punkte | Maximum | Begründung |
| --- | ---: | ---: | --- |
| Apple Guidelines und Geschäftsmodell | 9 | 20 | aktuelle Primärquellen und vollständige Matrix vorhanden; Paid Apps/Bank, DSA, IAP-Anhang und finale ASC-Felder offen |
| Release Build, Stabilität und Runtime-QA | 14 | 20 | signiertes Store-Archiv und breite Regression grün; keine Installation, physische Runtime oder TestFlight-Sandbox |
| Datenschutz, Tracking und Privacy Manifest | 8 | 20 | lokale Datenkarte/Consent/Manifeste stark; Live-Policy, ASC Labels und Drittanbieter-Löschung offen |
| Codequalität, Security und Abhängigkeiten | 12 | 15 | statische P0/P1-Grenzen korrigiert; Deployment, Live-Proxynachweis, Timeouts und bekannte npm-Advisories offen |
| Login, Account-Löschung, IAP und Subscriptions | 4 | 10 | Supabase-Löschung belegt und Servermodell lokal geprüft; StoreKit, Produktanhang und Provider-Erasure fehlen |
| UI, UX, HIG und Accessibility | 7 | 10 | umfangreiche responsive/DE/EN/Web-Tests; VoiceOver, echtes Dynamic Type und Hardware fehlen |
| Landingpage, Support und Metadaten | 4 | 5 | bestehende Kern-URLs 200 und Storepaket vorbereitet; lokaler Endstand nicht live, Unsubscribe 404 |
| **Gesamt** | **58** | **100** | **keine Freigabegarantie** |

## 4. Harte Gate-Matrix

| Gate | Schwere | Status | Evidenz | Was zum Schließen fehlt |
| --- | --- | --- | --- | --- |
| Aktueller offizieller Quellenzugriff | P0 | PASS | [`01_SOURCE_REGISTER.md`](./01_SOURCE_REGISTER.md), Abruf 2026-09-04 | keine |
| Vollständiger lokaler Verify und Auditpaket | P0 | PASS | [`evidence/build/26_final_release_verify.log`](./evidence/build/26_final_release_verify.log), Exit 0; [`evidence/build/33_final_audit_package_checks.log`](./evidence/build/33_final_audit_package_checks.log) | keine, solange Produktcode unverändert bleibt |
| Signiertes Release-Archiv | P0 | PASS | Statischer Archivnachweis: Build 7 `FINISHED`; Signatur/Entitlements/IPA separat inventarisiert | sauberen finalen Commit nach Rollout erneut bauen |
| Physische Ausführung des exakten Kandidaten | P0 | UNVERIFIED_BLOCKER | Build 7 weder TestFlight noch installiert | vollständige iPhone-Matrix |
| Produktiver Review-Backendstand | P0 | FAIL | [`evidence/network/23_final_supabase_dry_run.log`](./evidence/network/23_final_supabase_dry_run.log): drei Migrationen offen | Secrets setzen; Migrationen/Functions kontrolliert deployen; Live-Negativ-/Kosten-/Retentiontests |
| StoreKit/IAP/Restore | P0 | UNVERIFIED_BLOCKER | nur statische/Browserprüfung; keine Apple-Sandbox | Produkte komplettieren/anhängen; Kauf-, Restore-, Pending-, Refund-, Expiry-/Grace-Test |
| App Privacy | P0 | FAIL | ASC-Antworten unvollständig gegenüber [`04_DATA_PRIVACY_MAP.md`](./04_DATA_PRIVACY_MAP.md) | aus finalem Archiv korrigieren und veröffentlichen |
| Account-Löschung | P0 | FAIL | Supabase-E2E positiv; historisches PostHog/RevenueCat nicht abschließend | Erasure oder enge zulässige Retention belegen; nativen Cleanup testen |
| Public Privacy/Support | P0/P1 | FAIL | Kern-URLs 200, aber lokaler Stand abweichend und Unsubscribe EN/DE 404 | Backend zuerst, dann Website; kompletter Live-Crawl und Mail-/Lösch-E2E |
| Paid Apps/Bank/DSA | P0 | MANUAL_CONFIRMATION_REQUIRED | zuletzt `Processing`/`In Review` | Apple-Status aktiv/verifiziert nachweisen |
| Reviewer-Zugang | P0 | UNVERIFIED_BLOCKER | anonyme Nutzung konzipiert; exakter Submission-Build nicht end-to-end geprüft | frische UUID, `Anybody`-Sandboxzugang und alle Kernpfade auf TestFlight belegen |
| Metadata/Screenshots | P0/P1 | MANUAL_CONFIRMATION_REQUIRED | EN/DE lokal validiert; ASC/Buildgleichheit nicht final | finale Texte/Bilder/IAP/Build in ASC vergleichen und auswählen |
| Minderjährige 14–17 (`LEGAL_EXTERNAL`) | P1 | UNVERIFIED_BLOCKER | technischer Guardian-/Analytics-Gate lokal geprüft | Mail-E2E und qualifizierte Länder-/Storefrontentscheidung |
| Accessibility/Hardware | P1 | MANUAL_CONFIRMATION_REQUIRED | Web-AX/Layouts positiv | VoiceOver, Dynamic Type, Kamera, Torch, Barcode, Safe Areas auf Geräten |

## 5. Archivurteil

Das erzeugte Build-7-Archiv ist als technische Release-Artefaktprobe
erfolgreich: Distribution-Signatur, arm64, Bundle-/Versionsdaten,
`get-task-allow=false`, ATS, Purpose Strings und eingebettete Privacy Manifests
sind plausibel. Öffentliche Supabase-, PostHog- und RevenueCat-Clientwerte sind
erwartungsgemäß enthalten; serverseitige Providerkeys nicht. Dependency-
Defaults mit `localhost` wurden gefunden, aber keine aktive Release-Konfiguration
zu einem Entwicklungsserver.

Dieser statische Archivbefund ersetzt weder den von Xcode empfohlenen
zusammengefassten Privacy Report noch eine Netzwerkerfassung und Ausführung des
exakten Builds auf einem Gerät.

## 6. Reihenfolge bis zu einem neuen Gate

1. Offen gelegte OpenRouter-/USDA-Credentials rotieren; Provider-Spend-Cap und
   Warnungen setzen.
2. Beide Rate-Limit-Salts und alle sieben RevenueCat-Server-Secrets setzen und
   per Namensaudit bestätigen, ohne Werte zu protokollieren.
3. Exakt die drei Dry-run-Migrationen anwenden; danach `nutrition`,
   `guardian-consent` und `revenuecat-webhook` gemeinsam deployen. Die geänderte
   `waitlist`-Function und Website als abgestimmtes Webrelease ausrollen.
4. Live-Tests für Auth, Free/Pro, Providerlimits, Proxy/IP, Retention,
   Guardian, Waitlist, Abmeldung und Account-Löschung durchführen.
5. App Privacy, Paid Apps/Bank/DSA, Abo-Metadaten/Review-Screenshots und ersten
   Subscription-Anhang in App Store Connect abschließen.
6. Aus dem sauberen finalen Commit einen neuen Production-Build erstellen,
   statisch inspizieren und nur zu TestFlight hochladen.
7. Den vollständigen physischen EN/DE-/Teen-/Permission-/Offline-/A11y-/IAP-
   Testplan auf genau diesem Build bestehen.
8. Erst danach Matrix, Reviewer Notes und Store-Screenshots gegen exakt diesen
   Build abgleichen. `Add for Review` und `Submit for Review` benötigen jeweils
   eine gesonderte Eigentümerfreigabe.

## 7. Endaussage

Der lokale Quellstand ist nach der Remediation erheblich belastbarer und ein
signiertes Release-Archiv konnte erzeugt werden. Die noch offenen Punkte sind
jedoch keine kosmetische Restliste, sondern konkrete Apple-, Datenschutz-,
Backend-, IAP- und Runtime-Gates. Daher lautet die einzig regelkonforme
Entscheidung zum Auditstichtag: **`NO_GO`**.
