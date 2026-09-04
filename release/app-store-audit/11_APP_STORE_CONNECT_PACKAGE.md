# 11 – App-Store-Connect-Paket

**Auditdatum:** 2026-09-05
**Modus:** App Store Connect blieb schreibgeschützt: Es wurden keine Metadaten veröffentlicht, kein Build hochgeladen oder zugeordnet und nichts zur Prüfung hinzugefügt oder eingereicht. Ein separates signiertes EAS-Store-Archiv wurde ohne automatische Einreichung erstellt.

## Identität und Version

| Feld | Verifizierter Wert | Status |
| --- | --- | --- |
| App | Kandro Macro & Protein Tracker | PASS |
| Apple ID | `6808622187` | PASS |
| Bundle ID | `com.hewaddorani.kandro` | PASS |
| App-Version | `1.0.0` | PASS |
| Versionsstatus | In Vorbereitung für die Einreichung | PASS |
| Primärsprache | Englisch (USA) | PASS |
| Plattformen | Nur iPhone; Mac- und Vision-Verteilung nicht ausgewählt | PASS |
| Veröffentlichung | Manuelle Veröffentlichung; stufenweise Veröffentlichung deaktiviert | PASS |
| Prüfungseinreichung | Keine vorhanden | PASS |
| Der Version zugeordneter Build | Keiner; Einreichungsblocker | FAIL |

In App Store Connect/TestFlight sind nur die Builds 4 und 5 vorhanden. Build 5 wurde aus Commit `bb213926` erstellt, nicht aus dem auditierten Quellstand, und kann nicht als aktueller Release-Nachweis dienen. Siehe `evidence/app-store-connect/01_testflight_builds.png` und `evidence/build/07_build5_archive_inspection.txt`.

### Aktuelles EAS-Auditarchiv

| Feld | Verifizierter Wert | Status |
| --- | --- | --- |
| EAS-Build-ID | `420935a7-2aed-43e1-9daf-cb53f306a549` | PASS |
| EAS-Build-Seite | `https://expo.dev/accounts/hewad/projects/kandro/builds/420935a7-2aed-43e1-9daf-cb53f306a549` | PASS |
| App / Build | `1.0.0` / `7` | PASS |
| Bundle / SDK | `com.hewaddorani.kandro` / Expo SDK 54 | PASS |
| Verteilung / Status | Store / Finished | PASS |
| EAS-Fingerprint | `e410ce56a5e09e470cff837903cbbb433924a639` | PASS |
| Upload zu App Store Connect/TestFlight | Nicht durchgeführt | FAIL |
| Physische Installation und native Ausführung | Nicht durchgeführt | UNVERIFIED_BLOCKER |

Build 7 belegt, dass aus dem hochgeladenen lokalen Arbeitsbaum ein signiertes Store-Archiv erstellt werden konnte. EAS verzeichnet den Repository-Baseline-Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5`, während der Upload zusätzlich nicht committete Auditkorrekturen enthielt; der Fingerprint, nicht dieses nominelle Git-Feld, bindet den hochgeladenen Build-Kontext. Die statische IPA-, Signatur-, Provisioning-, Entitlement-, Framework-, Manifest- und Bundleprüfung ist in den Nachweisen 28–31 bestanden. Bis der finale Quellstand committet, der exakte Kandidat aus TestFlight installiert und nativ geprüft sowie sein zusammengeführter Xcode Privacy Report und Apples Processing bestätigt sind, muss Build 7 trotzdem als **Auditarchiv** bezeichnet werden, nicht als vollständig qualifizierter Einreichungskandidat. Build-Protokoll: `evidence/build/27_eas_release_archive.log`.

## Lokalisierte Produktseite

Die Versionsseite enthält englische (USA) und deutsche Metadaten sowie fünf Screenshots im Format `1320 × 2868` pro Sprache. Das Repository-Paket liegt unter `app-store/screenshots/`; dessen Validator besteht.

| Sprache | Name | Untertitel | Support | Datenschutz | Marketing |
| --- | --- | --- | --- | --- | --- |
| en-US | Kandro Macro & Protein Tracker | Know what to eat next | `https://getkandro.com/en/support` | `https://getkandro.com/en/privacy` | `https://getkandro.com/en/` |
| de-DE | Kandro Makro & Protein Tracker | Die Aufstellung deines Tages | `https://getkandro.com/support` | `https://getkandro.com/privacy` | `https://getkandro.com/` |

Die Namen umfassen jeweils exakt 30 Zeichen. Die Primärkategorie ist Health & Fitness, die Sekundärkategorie Food & Drink. Die Frage zu Inhaltsrechten ist bejahend beantwortet. Die Standard-Apple-EULA ist ausgewählt. Bei Export Compliance ist konfiguriert, dass keine nicht freigestellte Verschlüsselung verwendet wird. Die am 4. September inventarisierten Kern-/Baseline-URLs lieferten HTTP 200; das belegt weder die Bereitstellung der aktuellen lokalen Korrekturen noch die neuen Abmeldeseiten. `/unsubscribe/` und `/en/unsubscribe/` lieferten beim gesonderten Live-Retest am 5. September HTTP 404.

### Lokal vorgenommene Metadatenkorrektur

In der Live-Entwurfsbeschreibung stand, Nutzer könnten ihre Datensätze exportieren; eine Exportfunktion existiert in der App jedoch nicht. Diese Behauptung wurde in `store.config.json` aus beiden Lokalisierungen entfernt. Die Korrektur wurde **nicht** zu App Store Connect hochgeladen. Der Dashboard-Text muss daher vor der Einreichung ersetzt werden.

## Screenshots

- 5 englische und 5 deutsche Dateien, alle im Hochformat `1320 × 2868`, ohne persönliche Kontodaten.
- Die Reihenfolge erklärt zuerst den Nutzen, dann die Prüfung der Analyse, die adaptive Planung, die einfache Erfassung und Rezepte.
- Die Texte beschreiben durchgehend Schätzungen und bearbeitbare Portionen statt medizinischer Genauigkeit.
- Finales Gate: Jeden Bildschirm mit dem finalen nativen Build vergleichen. Die vorhandenen Bilder sind gestaltete Assets und kein Nachweis dafür, dass das finale Binärpaket jeden dargestellten Zustand identisch rendert.

## Altersfreigabe und Minderjährige

App Store Connect berechnet derzeit 13+ in 172 Regionen und die entsprechenden regionalen Einstufungen in den übrigen Regionen. Die App selbst lehnt ein Alter unter 14 ab, verlangt bei 14–15 die Zustimmung eines Erziehungsberechtigten, deaktiviert optionale Analytics unter 18 und vermeidet Defizit-/Überschussvorgaben für 14–17-Jährige. Health or Wellness Topics ist angegeben; ein Status als Medizinprodukt wird nicht behauptet. Kandro ist nicht in der Kids-Kategorie.

Das Ergebnis der Einstufung ist intern konsistent. Die Verteilung in 175 Gebieten erzeugt jedoch eine `LEGAL_EXTERNAL`-Anforderung: Der Eigentümer muss bestätigen, dass das 14+-/Erziehungsberechtigten-Modell und die Datenschutzhinweise in jedem Zielmarkt rechtmäßig sind, oder die Gebiete für den Start reduzieren.

## In-App-Käufe und RevenueCat

| Element | Verifizierte Konfiguration | Status |
| --- | --- | --- |
| Abonnementgruppe | Kandro Pro (`22358915`) vorhanden | PASS |
| Monatlich | `com.hewaddorani.kandro.pro.monthly`, Apple ID `6808643495`; in Vorbereitung | FAIL |
| Jährlich | `com.hewaddorani.kandro.pro.annual`, Apple ID `6808646840`; in Vorbereitung | FAIL |
| RevenueCat-Entitlement | `kandro_pro`; korrekte Dashboard-Zuordnung | PASS |
| Aktuelles Offering | `default` mit `$rc_monthly` und `$rc_annual`; korrekte Dashboard-Zuordnung | PASS |
| App Store Server Notifications | RevenueCat Produktions-/Sandboxendpunkte konfiguriert; kein reales Ereignis belegt | MANUAL_CONFIRMATION_REQUIRED |
| RevenueCat-Apple-Zugangsdaten | In-App-Purchase-Key und App-Store-Connect-API-Key im Dashboard als gültig angezeigt | PASS |
| Produkt-Screenshots für die Prüfung | Für beide Produkte fehlen sie | FAIL |
| Der ersten App-Version zugeordnetes Abonnement | Nein | FAIL |
| Sandbox-Kauf/Wiederherstellung/Erstattung/Ablauf auf physischem Gerät | Auf einem finalen Build nicht durchgeführt | UNVERIFIED_BLOCKER |

Das frühere RevenueCat-Entitlement `kadro_pro` und seine Testprodukte werden von der aktuellen App nicht verwendet; sie dürfen nicht für die Prüfung ausgewählt werden. Sie werden während dieses Audits nicht gelöscht, weil eine Löschung unnötig und potenziell destruktiv ist.

Der lokale Audit-Arbeitsbaum bindet den serverseitigen Pro-Zugang zusätzlich an RevenueCats project-scoped REST-v2-Subscription-Antwort, `store=app_store`, Apple-Sandbox oder Produktion sowie exakte interne App-, Produkt- und Entitlement-Allowlisten. RevenueCat Test Store/`rc_billing` wird fail-closed abgelehnt; nach Kauf oder Restore zeigt der Client Pro erst nach einem authentifizierten, positiv beantworteten Server-Refresh. Diese Korrektur ist lokal getestet, aber weder Migration noch Functions/Secrets/Webhook sind live. Für die loginlose App muss RevenueCats **Sandbox Testing Access** während App Review auf `Anybody` stehen, weil ein Reviewer eine neue, vorher unbekannte anonyme Supabase-UUID erhält; `Allowed App User IDs only` würde den Kauf trotz erfolgreicher Apple-Sandboxtransaktion nicht freischalten. Die Sicherheitsgrenze ist deshalb der Serverabgleich: Apple `app_store` muss funktionieren, RevenueCat Test Store darf auch bei `Anybody` keinen Produktionszugang erzeugen.

## App-Privacy-Antworten

App Store Connect verzeichnet derzeit nur Email Address, Health, User ID und Purchases als mit dem Nutzer verknüpfte Daten für die App-Funktionalität. Dieser Entwurf ist für die aktivierte Produktionskonfiguration unvollständig.

Mindestens die folgenden Punkte müssen anhand des finalen Archivs und von `04_DATA_PRIVACY_MAP.md` abgeglichen und veröffentlicht werden:

- Contact Info → Name: verknüpft, App Functionality/Account Management, weil ein optionaler Anzeigename im Profil gespeichert wird.
- Identifiers → Device ID: für optionale PostHog-Analytics vorsichtshalber als mit Gerät/Nutzer verknüpft angeben, weil das SDK eine zufällige Distinct-/Device-ID dauerhaft speichert.
- Usage Data → Product Interaction: Analytics, optionale PostHog-Ereignisse mit Opt-in durch Erwachsene.
- Diagnostics → Other Diagnostic Data oder Crash Data, je nachdem, wie der App-Store-Fragebogen die bereinigten PostHog-Exception-Ereignisse klassifiziert; Analytics/App Functionality, soweit zutreffend.
- Purchases → Purchase History bleibt verknüpft, weil RevenueCat die Supabase-UUID als Custom App User ID erhält.
- Health, User ID und die optionale Email Address bleiben deklariert.
- Das serverautoritativ geführte Analyse-Ledger ist mit dem Supabase-Nutzer verknüpft; der Providerschutz erzeugt zudem kurzlebige pseudonyme Konto-/Netzwerkzähler und nicht verknüpfte globale Routenaggregate. Deren exakte Apple-Kategorien, Zwecke und Verknüpfung anhand des bereitgestellten Schemas abgleichen, statt sie als rein operativ wegzulassen.
- Für Photos/Videos und Other User Content ist eine finale Entscheidung zur vorübergehenden Verarbeitung erforderlich. Sie dürfen nur weggelassen werden, nachdem das final bereitgestellte Gateway nachweist, dass Inhalte weder in Provider- noch in Anwendungsprotokollen gespeichert werden, und die finale Richtlinie dasselbe aussagt.

Es wird kein ATT-Dialog erwartet, weil Code und Konfiguration weder IDFA, Werbung, Datenhändler noch anbieterübergreifendes Werbetracking zeigen. `NSPrivacyTracking` muss dennoch im finalen Archiv und in jedem SDK-Manifest erneut geprüft werden.

## Prüfungsinformationen

- Die Kontaktfelder für die Prüfung sind ausgefüllt.
- Die Review Notes erläutern anonymen Zugang, Einwilligung, Kamera/Beschreibung/Barcode/Suche, Korrektur vor dem Speichern, Erziehungsberechtigten-Ablauf, Paywall, Restore Purchases und Kontolöschung.
- Es werden keine Zugangsdaten für einen Reviewer benötigt. Die private lokale Übergabedatei sagt dies ausdrücklich und enthält keine Zugangsdaten.
- Die deterministische Beispielmahlzeit ist nur ein Fallback; das Produktions-Backend muss während der Prüfung verfügbar bleiben.
- `APP_REVIEW_NOTES_TEMPLATE.txt` nach dem Ersetzen der buildspezifischen Nachweise verwenden.

## Geschäfts- und Gebietsbereitschaft

Schreibgeschützte Nachweise liegen in `evidence/app-store-connect/02_business_status_redacted.md`.

- Free Apps Agreement: aktiv.
- Paid Apps Agreement: in Bearbeitung.
- Bankkonto: in Bearbeitung.
- Steuerformulare zum Auslandsstatus: aktiv.
- DSA-Händlerverifizierung: in Prüfung.
- Ein gesonderter Hinweis in App Store Connect zeigte zuvor, dass DAC7-Informationen noch vervollständigt werden müssen; dies bleibt eine Bestätigung durch den Eigentümer, bis das Dashboard den Punkt als erledigt anzeigt.

Abonnements dürfen nicht eingereicht werden, solange Paid Apps Agreement/Bankeinrichtung noch ausstehen. Die EU-Verteilung darf nicht fortgesetzt werden, solange der Händlerstatus ungeklärt ist.

## Finales Paket-Gate

Nicht auf **Add for Review** oder **Submit for Review** klicken, bis alle folgenden Punkte nachgewiesen sind:

1. Der aktuelle Quellstand ist committet; die statische Build-7-Prüfung ist abgeschlossen und wird bei jeder Änderung an Produkt-/Build-Eingaben an einem neuen Ersatzarchiv wiederholt; das exakte Binärpaket ist zu TestFlight hochgeladen, installiert und nativ geprüft.
2. Genau drei ausstehende Supabase-Migrationen sind angewendet und `nutrition`, `guardian-consent` sowie `revenuecat-webhook` werden gemeinsam bereitgestellt, nachdem alle erforderlichen serverseitigen Salts/RevenueCat-Secrets gesetzt wurden; der exakte Build besteht anschließend Live-Abläufe, Provider-Circuit-Breaker-, Proxy-/IP-Grenz- und Entitlement-Tests.
3. Die App-Privacy-Antworten sind korrigiert und veröffentlicht.
4. Für beide Abonnements existieren Review-Screenshots und beide Abonnements sind Version 1.0.0 zugeordnet.
5. Paid Apps Agreement, Bankkonto und DSA-Status sind aktiv/gelöst.
6. Nativer StoreKit-Kauf, Kündigung, Wiederherstellung, Ablauf/Widerruf und Verhalten ohne Produkte bestehen auf einem physischen iPhone.
7. RevenueCat Webhook/REST ist mit minimalem `customer_information:subscriptions:read`-Scope, exakten internen Allowlisten und `Sandbox Testing Access = Anybody` für den anonymen Reviewflow live geprüft; Test Store bleibt serverseitig gesperrt.
8. Der finale Build ist zugeordnet und der Eigentümer führt die verlangte finale Sichtprüfung durch. Weder **Add for Review** noch **Submit for Review** wird ohne gesonderte ausdrückliche Freigabe angeklickt.
