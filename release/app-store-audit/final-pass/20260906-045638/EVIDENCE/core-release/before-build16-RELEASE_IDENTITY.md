# Release-Identität — 6. September 2026

## Lokaler Arbeitsstand

- Wiederhergestelltes lokales Repository: `/Users/hewaddorani/Developer/Kandro-recovery-20260906`.
- Wrapper `app-lokal` verweist hierher; ursprüngliches iCloud-Repository und Chatarchiv bleiben erhalten.
- Branch `audit/app-store-release-gate-20260904`, Basis-Commit `633d688e6a6247a6e1cc66f85788c157b6e12863` **plus uncommittete Änderungen**. Der Commit allein bezeichnet den Kandidaten nicht vollständig.
- Vorher aktiver Build 14: EAS `7d0305a9-6826-4fec-a83b-144763be6e94`, Commit `50d80b8d5f5fdd40a71190ce03c4fefe8d5e7d37`.
- Uploadvorbereitung: 295 Datei-Hashes in `EVIDENCE/upload-context-sha256.json`, wesentliche Produktdateien bytegleich geprüft. Dieser Hashsatz gehört zu Build15. Danach kam F08 in `src/app/paywall.tsx` und `src/components/ui.tsx` hinzu; der lokale Produktstand ist deshalb nicht mehr bytegleich mit Build15. Neuer lokaler Uploadkontext wird getrennt geführt.
- Lokale Debug-Runtime ist nicht das Store-Binary. Historische unrecoverte iCloud-Änderungen bleiben eine separate Wiederherstellungsgrenze (Bericht 34); sie wurden nicht erfunden oder überschrieben.

## Neuer Produktionsbuild

- **1.0.0 (15)**, Bundle-ID `com.hewaddorani.kandro`.
- EAS Build `46d24f60-c300-47ed-95ac-2fa366a30124`, genau ein angeforderter Produktionsbuild, erfolgreich.
- Erstellung `2026-09-06T03:16:00.735Z`, fertig `2026-09-06T03:20:50.459Z`.
- EAS Submit `3cb56544-4442-45e1-812e-4d2693e5f226`: erfolgreich zu Apple hochgeladen. ASC Build-Uploads zeigte 1.0.0 (15), „Verarbeitung läuft“, 06.09.2026 05:23 MESZ.
- IPA SHA-256: `18d99756f2c886014f618519a83cbdb0abfcb8f9852a319daa09030b9a7e3176`.
- main.jsbundle SHA-256: `2decb2952f1092d6209e21afdc3d12a52eceed0fd1c776fdbab254ed35f1ab58`.
- Signaturprüfung `codesign --verify --deep --strict`: erfolgreich.
- Archiv: **Xcode 26.0 / 17A324, iPhoneOS SDK 26.0**, Mindest-iOS **15.1**, DeviceFamily **1 (iPhone)**. Lokales Xcode 26.6/iOS-26.5-Simulator ist davon getrennt.
- 16 Privacy-Manifeste enthalten; aggregierte Gründe für UserDefaults, FileTimestamp, BootTime, DiskSpace. Struktur gelesen; keine automatische Garantie, dass jede Third-party-API semantisch korrekt begründet ist.
- Native Kamera-Permission-Texte in `de.lproj/InfoPlist.strings` und `en.lproj/InfoPlist.strings`. Fehlender separater CFBundleLocalizations-Schlüssel bedeutet hier nicht fehlende lproj-Ressourcen.
- ATS `NSAllowsArbitraryLoads=false`. EAS-Produktionsumgebung und Produktionsreleaseprüfung bestanden. Keine private Provider-/Service-Role-Konfiguration im Uploadkontext.
- Keine OTA-Veröffentlichung und keine App-Review-Einreichung durch diesen Pass. TestFlight-Verarbeitungsabschluss/Auswahl wird im Statusnachtrag festgehalten.

## Backend und Datenbank

Projekt `omtmxqzwxvthycyfkggv`: nutrition **51**, JWT-Prüfung aktiv, alle zehn zurückgeladenen Quelldateien bytegleich. Unverändert: delete-account12, guardian-consent5, waitlist10, revenuecat-webhook3. Zwanzig lokale/remote Migrationen deckungsgleich; Dry-run meldet aktuell, keine DB-Mutation vorgenommen.

Vision-Modell/Detail anhand Secret-Metadaten-Digests geprüft: GPT-4.1 mini / high. Vier Live-Fotoaufrufe insgesamt (drei v50, einer v51); kein weiterer KI-Call nach dem Budgettest. Alle dabei angelegten synthetischen API-Konten gelöscht, Profilkaskade und Tokenwiderruf geprüft. Simulator-QA-Konto für weiteren Test erhalten.

## Website / Vertrieb / Kosten

Zehn öffentliche DE-/EN-Seiten auf getkandro.com sind bytegleich zum lokalen `site/`-Stand; SHA-256 in `EVIDENCE/website-live.json`. Kein Website-Deployment erforderlich. App für 174 Gebiete konfiguriert, Festlandchina ausgenommen; Mac-/Vision-Verfügbarkeit aus. Das ist keine weltweite Funktions-/Rechtsfreigabe.

Owner freigegeben: KI maximal 0,50 EUR, genau ein Build + TestFlight maximal 5 EUR. Vier KI-Calls ohne automatische Wiederholungen; konservative Tokenpreis-Abschätzung 0,1728 USD, tatsächliche Rechnung nicht verfügbar. EAS medium Standard: 2 USD vor Credits/Steuern laut aktueller Expo-Tabelle; keine Tarifänderung, kein Zusatzbuild, kein echter Abo-Kauf.

## Statusnachtrag: Apple-Verarbeitung abgeschlossen

Build15 ist in TestFlight verarbeitet, Status Bereit zur Übermittlung, Gruppe Kandro Internal zugeordnet. Apple-Build-ID `aba3a964-5ae5-47d2-b864-c12356a3ef2f`. ASC bestätigt inzwischen Installation 1.0.0 (15); aktive Wiederherstellung und ein realer Foto-/Korrektur-/Speicher-/Neustarttest sind OWNER_CONFIRMED. Kein App Review ausgelöst.

Build15 außerdem für die vorbereitete App-Version1.0.0 ausgewählt und gespeichert. Reviewer-Notizen aktualisiert; manuelle Veröffentlichung bleibt eingestellt. Die Subscriptions bleiben vor Einreichung; keine App-Review- oder Beta-Review-Einreichung ausgelöst.

## Zusätzlicher lokaler Uploadkontext nach Build15

F08 ist in `src/app/paywall.tsx` und `src/components/ui.tsx` lokal korrigiert und
nachgetestet. `EVIDENCE/large-text/upload-context-sha256.json` enthält den neuen
vollständigen Hashsatz. `upload-delta.json` weist genau diese zwei zusätzlichen
Produktänderungen gegenüber dem Build15-Kontext aus; übrige Änderungen sind
Audit-/QA-/Dokumentationsdateien. Alle Laufzeitquellen sowie Paket-/App-/EAS-
Konfiguration mit lokalem Stand bytegleich geprüft, Dependencydateien gegenüber
Build15 unverändert. `build:inspect --stage archive` erfolgreich; kein Remote-
Build gestartet, keine Buildnummer erhöht, kein TestFlight-Upload. Privatkopie:
`/Users/hewaddorani/.codex/backups/kandro-large-text-eas-context-20260906`.

Nächster Schritt nach neuer Freigabe: genau einen Produktionsbuild mit diesem
Stand erstellen, signiertes IPA/Quellenidentität prüfen und zu TestFlight
hochladen; bei Abweichung stoppen. Bestehenden Build15 und v51 als nachvollziehbaren
Rückfallstand erhalten. Kein Backend-/Datenbank-/Website-Deployment erforderlich.
App Review erst nach Kandidatenprüfung und Abschluss der verbleibenden Gates.

## Kostenkorrektur nach aktueller Kontoprüfung

6. September 2026: Die authentifizierte Expo-Billing-Seite für hewad zeigt
Free ($0/Monat), 15 inklusive iOS-Builds, 11 verwendete iOS-Builds und eine
voraussichtliche Rechnung von $0.00. Nach diesem angezeigten Stand sind vier
iOS-Builds im kostenlosen Kontingent verfügbar. Ein zusätzlicher Standardbuild
benötigt daher derzeit keine zusätzliche Kostenfreigabe. Die vorher erfragten
5 EUR waren eine vorsorgliche Obergrenze, keine bestätigte Gebühr oder Abbuchung.
Keine Tarifänderung und kein zusätzlicher Produktionsbuild/Upload ausgeführt.
Die letzte Nutzernachricht war eine Kostenfrage, keine Bestätigung des weiteren
Build-/Upload-Auftrags. Kein kostenpflichtiger Fallback ohne neue Freigabe.
Quelle: https://expo.dev/accounts/hewad/settings/billing (authentifiziert).
