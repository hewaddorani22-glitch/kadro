# Vorbereiteter Kandidat — 6. September 2026

Basis `633d688e6a6247a6e1cc66f85788c157b6e12863`, Branch `audit/app-store-release-gate-20260904`, einschließlich erhaltener uncommitteter Bilanz-/Nährwertkorrekturen. Aktuell in Apple ausgewählt: 1.0.0 (14), EAS `7d0305a9-6826-4fec-a83b-144763be6e94`, Runtime-Commit `50d80b8`.

## Neu in diesem Audit

- Gerätesprachen werden nach Präferenz bis zur ersten unterstützten DE-/EN-Sprache geprüft. Explizite App-Auswahl bleibt vorrangig; `pt-BR` allein fällt auf Englisch zurück. Script-Subtags wie `Hans` werden nicht als Land interpretiert.
- Analyse-/Such-/Barcode-Anfragen haben eine 90-Sekunden-Grenze einschließlich Session-Warten und JSON-Antwortkörper. Bei Ablauf wird der Upload abgebrochen; bestehender lokaler Retry-/Fehlerweg bleibt erhalten. Unbekannte Provider-Fehler und Warntexte erscheinen nicht ungefiltert in der Oberfläche.
- Der serverseitige JPEG-Eingang prüft Base64-Format und JPEG-Anfang/-Ende vor bezahlter Analyse. Die bestehende 413-Größenbegrenzung bleibt erhalten. Das ist keine vollständige Bilddecoder-Prüfung.
- Neue Verhaltenstests laufen im bestehenden Verify-Gate. Reine Quelltextprüfungen für Sprachauswahl und Auth-Header wurden durch Aufrufe des tatsächlichen Moduls ersetzt.

## Nachweis und Auslieferung

`npm install` und vollständiges konfiguriertes `npm run verify` erfolgreich (Exit 0); Expo Doctor 18/18; Produktions-Konfigurationsprüfung erfolgreich. Vorher/Nachher-Regressionen in `EVIDENCE/`.

EAS-Uploadkontext lokal mit `build:inspect --stage archive` erstellt und die wesentlichen Produktdateien bytegleich mit dem Kandidaten verglichen. `.env.local` und Gateway-Secrets ausgeschlossen. Dies ist noch kein signiertes Binary. Keine Framework-/SDK-Upgrades.

Nach ausdrücklicher Freigabe: JPEG-Prüfung als `nutrition` v51 veröffentlicht und live nachgetestet. Genau ein iOS-Produktionsbuild 1.0.0 (15), EAS `46d24f60-c300-47ed-95ac-2fa366a30124`, erfolgreich erstellt, IPA/Signatur geprüft und zu App Store Connect hochgeladen. Verarbeitungs-/Auswahlstatus in `RELEASE_IDENTITY.md`; kein App Review beantragt.

DSA weiterhin „In Prüfung“; kein offenes Nachreichungsformular beobachtet. Physisches iPhone bisher nicht verbunden. Keine Apple-Review-Freigabe ableitbar.

## Zusätzlicher lokaler Kandidat nach Build 15

F08: Paywall bei großer Systemschrift vollständig scrollbar; Tarife/Preise, Kaufknopf und Rechtslinks bleiben zugänglich. PrimaryButton erlaubt mehrzeiligen Text. Native Textmessung wird bei Schriftgrößenwechsel erneuert. Nur `src/app/paywall.tsx` und `src/components/ui.tsx` sind zusätzliche Produktänderungen gegenüber dem Build-15-Uploadstand; keine Backend-/Schema-/Dependencyänderung. Vollständiges Verify und gezielter nativer DE/EN-Retest bestanden. Belege: `EVIDENCE/large-text/RESULT.md`.

Der Nutzer hat Build15 ohne USB getestet und Foto/Korrektur/Speichern/Neustart sowie aktive Wiederherstellung bestätigt. Diese Belege bleiben auf Build15 bezogen. Zusätzlicher Produktionsbuild mit TestFlight ist noch nicht autorisiert oder gestartet. App Review bleibt ausstehend.
