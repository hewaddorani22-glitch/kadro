# 14 – Gesamt-Remediation-Log

**Auditzeitraum:** 4.–5. September 2026, Europe/Berlin
**Ausgangsbasis:** Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5`
**Scope:** lokaler App-, Server-, Datenbank-, Website-, Store- und Auditstand
**Produktivänderungen:** keine Supabase-Migration, keine Edge Function, keine
Website und keine App-Store-Metadaten veröffentlicht; keine Review-Einreichung

## 1. Ergebnis

Alle im Audit reproduzierten und lokal sicher behebbaren statischen P0-/P1-
Codeprobleme wurden minimalinvasiv korrigiert und mit gezielten Regressionen
sowie dem vollständigen Projekt-Verify erneut geprüft. Zwei unabhängige
adversariale Quellcode-Nachprüfungen fanden danach keine verbleibende statische
P0-/P1-Lücke in RLS/Grants, Analyseautorisierung, Providerlimits, RevenueCat,
Guardian, Warteliste, Zustandsintegrität oder Consent-Grenzen.

Das bedeutet ausdrücklich **nicht**, dass das Release freigegeben ist. Drei
Migrationen und die dazugehörigen Functions sind remote noch nicht ausgerollt;
App Store Connect, Apple-Sandbox, Drittanbieter-Löschung und physische iOS-QA
enthalten weiterhin P0/P1-Gates. Der Gesamtstatus bleibt deshalb `NO_GO`.

## 2. Behobene P0-/P1-Probleme

| ID | Schwere | Ursache | Lokale Korrektur | Verifikation | Stand |
| --- | --- | --- | --- | --- | --- |
| REM-01 | P1 | Der bezahlte Analysepfad vertraute dem Client-Paywallzustand und konnte durch direkte Gateway-Aufrufe umgangen werden. | Serverseitiges, transaktionales Free-/Pro-Ledger mit stabiler Request-UUID, Reserve/Start/Commit/Refund/Replay, genau drei Lifetime-Free-Erfolgen, 60 Pro-Analysen pro UTC-Tag und fail-closed RevenueCat-Verifikation. | Lokal: `validate:entitlements`, `validate:allowance`, `validate:subscription`, `validate:supabase`, Full Verify Exit 0; Deployment/Sandbox offen. | `FIXED_VERIFIED` |
| REM-02 | P1 | Provider-Fehler konnten fremde Fehlerbodies und damit potenziell Inhalt/PII in Logs übernehmen. | Ausschließlich feste, gekürzte Safe-Codes; keine Prompts, Bilder, Ergebnisse, Providerbodies, UUIDs oder Authheader in App-Logs. | Lokal: `validate:privacy`, `validate:entitlements`, Quellprüfung, Full Verify Exit 0; Live-Logtest offen. | `FIXED_VERIFIED` |
| REM-03 | P1 | Anonyme Kontorotation und parallele Requests konnten Drittanbieterlimits bzw. Kosten-Circuit-Breaker überlasten. | Atomare service-role-only Account-, Netzwerk- und globale Provider-Buckets vor jedem USDA-, Open-Food-Facts- und RevenueCat-Aufruf; TRANSFER reserviert alle Alias-Lookups vor Parallelisierung; stündliche Bereinigung. | Lokal: `validate:provider-limits`, `validate:entitlements`, `validate:supabase`, Remote-Dry-run Exit 0; Salts/Deployment/Live-Lasttest offen. | `FIXED_VERIFIED` |
| REM-04 | P1 | Späte Analyseantworten konnten nach neuem Scan, Consent-Widerruf oder Identitätswechsel einen neueren Zustand überschreiben; doppelte Requests konnten doppelt zählen. | Getrennte Screen-/Identity-Generationen, In-flight-Request-IDs und serverseitiger idempotenter Replay-/Commit-Pfad. | `validate:state-integrity`, `validate:allowance`, `validate:entitlements`, Full Verify Exit 0. | `FIXED_VERIFIED` |
| REM-05 | P1 | Ein unterbrochener Wechsel von anonymer zu bestehender Identität konnte lokale Daten des falschen Accounts exponieren oder unter dem Zielaccount überschreiben. | Dauerhafter Account-Switch-Marker vor Auth-Mutation, fail-closed Recovery-Gate, atomarer lokaler Austausch erst nach bestätigter Cloudhydration, Telemetrie-/Consent-/Reminder-Cleanup. | Lokal: `validate:state-integrity`, `validate:privacy`, TypeScript, Full Verify Exit 0; nativer Crash/Recovery-Test offen. | `FIXED_VERIFIED` |
| REM-06 | P1 | Alters-/Analyticsregeln waren nicht an jeder Hydrations- und Profiländerungsgrenze identisch; beim Widerruf blieben lokale PostHog-Identität/Queues erhalten. | Zentrale Age Policy vor Profilfreigabe, Analytics unter 18 fail-closed, vollständiges lokales PostHog-Queue-/ID-Cleanup bei Widerruf, Löschung und Accountwechsel. | Lokal: `validate:privacy`, `validate:state-integrity`, `validate:accessibility`, Full Verify Exit 0; historischer Provider-Erasure-Nachweis offen. | `FIXED_VERIFIED` |
| REM-07 | P1 | Guardian-Anfragen konnten historische Klartextadresse enthalten, Bestätigung war nicht atomar single-use und Versandgrenzen waren nicht vollständig fail-closed. | Guardian-Adresse nur transient an Resend; Altwerte genullt; 4-KiB-Bodygrenze; atomare Lock-/Consume-RPC; 14-/15-Altersprüfung; Nutzer-/Guardian-/IP-Limits mit getrenntem Salt; abgelaufene Requests per Cron entfernt. | Lokal: `validate:privacy`, `validate:supabase`, `validate:state-integrity`, Function-Syntaxprüfung, Full Verify Exit 0; Mail-/Link-E2E offen. | `FIXED_VERIFIED` |
| REM-08 | P1 | Wartelistenmail hatte keinen Abmeldelink, Abmeldung behielt Datensatz, Token waren nicht getrennt und zugesagte Fristen wurden nicht technisch erzwungen. | Unabhängige 192-Bit-Bestätigungs-/Abmeldetoken, DE/EN-Mail und Seiten, expliziter Löschbutton, vollständige Zeilenlöschung ohne Existenzleck, CAS bei Mailfehlern, IP/E-Mail-Limit und Cron für 30 Tage bzw. Launch plus sechs Monate. | Lokal: `validate:waitlist`, `validate:site`, `validate:privacy`, responsive Browserbelege, Remote-Dry-run Exit 0; Live-Seiten derzeit 404. | `FIXED_VERIFIED` |
| REM-09 | P1 | Deutsche BLS-Suche behandelte `Haferflocken` und `Hafer Flocken` nicht als exakten Match und führte ein Nussgebäck mit 517 kcal/100 g. | Compound-Normalisierung und reale BLS-Fixture; Grundprodukt führt mit 348 kcal/100 g. | Lokal: `validate:bls-search`, `validate:german-search`, Runtime-Vorher/Nachher-Beleg, Full Verify Exit 0; Gateway-Deployment offen. | `FIXED_VERIFIED` |
| REM-10 | P1 | Kostenlose Suche, Barcode, Demo oder Plan konnten bei Cloudhydration fälschlich das KI-Lifetimekontingent erhöhen; erfolgreiche, später verworfene Providerantworten konnten umgekehrt ungezählt bleiben. | Nur Foto-/Text-`origin='scan'`; Zählung der erfolgreichen Request-UUID vor Bestätigung; Serverledger bleibt autoritativ. | `validate:analysis-allowance`, `validate:product`, isolierter Runtime-Re-Test, Full Verify Exit 0. | `FIXED_VERIFIED` |
| REM-11 | P1 | Auf 320×568 überlagerte die fixierte Onboarding-CTA eine Auswahl; große Schrift verschärfte dies. | Fensterhöhenabhängiger Kompaktmodus, scrollbarer Inhalt und Safe-Area-Abstand; Auswahl springt nicht automatisch weiter. | Im Web: Alle elf Schritte auf 320×568/393×659 plus 135-%-Textstress; `validate:accessibility`; Screenshots. Native Dynamic Type offen. | `FIXED_VERIFIED` |
| REM-12 | P1 | Offline-Copy behauptete bei Beschreibung/Barcode/Suche eine lokale Queue, obwohl nur ein Foto queued wird. | Status- und modusspezifische ehrliche EN/DE-Fehlermeldung; kein falscher Persistenzclaim. | `validate:offline-copy`, Storage- und Runtime-Vorher/Nachher-Test. | `FIXED_VERIFIED` |
| REM-13 | P1 | Radioauswahlen exponierten im Accessibility-Tree keinen verlässlichen Checked-State. | `accessibilityState.checked` und `aria-checked` an allen Radio-Rollen. | Im Web: `validate:accessibility`, Browser-AX-Snapshot, Full Verify Exit 0; VoiceOver offen. | `FIXED_VERIFIED` |
| REM-14 | P1 | Storecopy bewarb eine nicht vorhandene Exportfunktion. | Exportclaim aus EN/DE-Storekonfiguration entfernt; Namen, Keywords und Längen neu validiert. | Lokal: `validate:store-listing` Exit 0; ASC-Übernahme offen. | `FIXED_VERIFIED` |
| REM-15 | P1 | Lokale Recovery konnte bei fehlgeschlagener Sessionabfrage Onboarding öffnen und damit Daten unter eine unbestätigte Identität schreiben. | Recovery-Gate bleibt bei unlesbarer/abweichender Session geschlossen; erst belegte alte Identität darf lokale Daten wieder freigeben. | Lokal: `validate:state-integrity`, `validate:privacy`, Full Verify Exit 0, adversarialer Zweitaudit; Prozessabbruchtest offen. | `FIXED_VERIFIED` |

## 3. Zusätzlich behobene P2-/P3-Probleme

- Locale-Memo des Verlaufs invalidiert jetzt beim Sprachwechsel.
- Plan-Multiplikatoren verwenden in EN Punkt und in DE Komma.
- Suchbestätigung führt mit korrekter Copy zurück in die Suche statt zu einem
  nicht vorhandenen Foto.
- Legal-Seiten umbrechen lange Begriffe auf 320–430 px; Hero-Microcopy erreicht
  im lokalen Stand 5,20:1; Reduce-Motion- und Theme-Pfade wurden geprüft.
- Obsoleter EU-ODR-Hinweis wurde entfernt; Datenquellen versprechen keine
  absolute, nicht geschätzte Genauigkeit mehr.
- EAS-Kontext schließt lokale Secrets, native Credentials, Auditbelege und
  Scratch-Dateien explizit aus.

## 4. Verifikationskette

| Stufe | Befehl/Beleg | Ergebnis |
| --- | --- | --- |
| Gezielte Regressionen | alle in `package.json` unter `verify` eingebundenen Validatoren | Exit 0 |
| Vollständiger Zweitaudit | `npm run verify` | Exit 0; TypeScript und die in `verify` verkettete Regression-Suite, Expo Doctor 18/18, Webexport. Direkt unter `scripts/` liegen 54 Programme, rekursiv einschließlich drei Daten-/Fixturedateien 57 Dateien. |
| Remote-Schemaabgleich | `npm run db:remote:check` | Exit 0, `dryRun:true`, kein Push; exakt drei Migrationen offen |
| Signed archive | `npx eas-cli build --platform ios --profile production --non-interactive --wait` | EAS Store Build 7 `FINISHED`; nicht submitted |
| Git-Hygiene | `git diff --check`, aktualisierter 262-Dateien-Index | Exit 0 / vollständig |
| Adversarial recheck | zwei getrennte read-only Quellprüfungen | keine verbleibende statische P0/P1-Lücke; operative Gates bestätigt |

Primäre Belege:

- [`evidence/build/26_final_release_verify.log`](./evidence/build/26_final_release_verify.log)
- [`evidence/network/23_final_supabase_dry_run.log`](./evidence/network/23_final_supabase_dry_run.log)
- [`evidence/build/27_eas_release_archive.log`](./evidence/build/27_eas_release_archive.log)
- [`evidence/build/29_build7_archive_inspection.txt`](./evidence/build/29_build7_archive_inspection.txt)
- [`evidence/build/32_final_secret_and_debug_scan.txt`](./evidence/build/32_final_secret_and_debug_scan.txt)
- [`evidence/build/33_final_audit_package_checks.log`](./evidence/build/33_final_audit_package_checks.log)
- [`14_ENTITLEMENT_REMEDIATION_LOG.md`](./14_ENTITLEMENT_REMEDIATION_LOG.md)
- [`14_WEB_REMEDIATION_LOG.md`](./14_WEB_REMEDIATION_LOG.md)

## 5. Nicht als behoben markierte Gates

1. Remote fehlen weiterhin drei Migrationen sowie die korrespondierenden
   Function-Deployments und Live-Tests.
2. Im letzten erfolgreichen Secret-Namensaudit fehlten
   `NUTRITION_RATE_LIMIT_SALT`, `GUARDIAN_RATE_LIMIT_SALT` und sieben
   serverseitige `REVENUECAT_*`-Secrets; ein späterer Read-only-Kontrollversuch
   wurde durch Supabase mit HTTP 403 blockiert.
3. Build 7 wurde signiert und archiviert, aber weder in App Store Connect
   hochgeladen noch auf einem physischen iPhone installiert.
4. StoreKit-/RevenueCat-Sandbox, Kamera/Torch/Barcode, VoiceOver/Dynamic Type,
   Offline-Prozessabbruch, Tageswechsel/DST und Teen-Guardian-Mailflow sind am
   finalen nativen Artefakt nicht end-to-end belegt.
5. App Privacy ist in App Store Connect nicht final ausgefüllt/veröffentlicht;
   Paid Apps/Bank und DSA-Traderstatus waren zuletzt noch in Bearbeitung.
6. Die lokalen Website-/Privacy-/Abmeldekorrekturen sind nicht live; die beiden
   Abmeldeseiten antworteten am 5. September 2026 weiterhin mit HTTP 404.
7. Historische PostHog-/RevenueCat-Daten benötigen einen belegten Erasure-Pfad
   oder eine eng dokumentierte zulässige Retention; lokale SDK-Bereinigung
   ersetzt diesen Nachweis nicht.

Diese Punkte bleiben in `15_OWNER_INPUT_REQUIRED.md` und
`16_FINAL_GO_NO_GO.md` als echte Release-Blocker erhalten.
