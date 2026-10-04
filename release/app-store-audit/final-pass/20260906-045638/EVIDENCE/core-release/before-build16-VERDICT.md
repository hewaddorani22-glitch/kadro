# NO_GO für Build 15 — zusätzliche App-Korrektur noch nicht ausgeliefert

**Der vom Nutzer bestätigte Foto-/Korrektur-/Speicher-/Neustarttest und die aktive Abo-Wiederherstellung sind bestanden (OWNER_CONFIRMED).** Ein zusätzlicher Simulatorcheck fand jedoch einen konkreten Fehler: Bei maximaler Systemschrift verdrängt der feste Paywall-Footer die Tarifauswahl und schneidet Rechtstexte ab. Dieser Fehler ist lokal korrigiert und gezielt nachgeprüft, aber noch in Build 15 enthalten. Deshalb wird Build 15 nicht zur App Review eingereicht.

Lokaler Retest: DE/EN bei normaler und maximaler Schrift, Monat/Jahr-Auswahl, vollständig sichtbarer Kaufknopf, Rechtslinks samt Navigation und Größenwechsel im geöffneten Screen geprüft. Vollständiges `npm run verify` nach letzter Codeänderung erfolgreich. Belege und Grenzen: `EVIDENCE/large-text/RESULT.md`. Ein weiterer Produktionsbuild/TestFlight-Upload ist noch nicht gestartet. Kostenkorrektur: Expo zeigt aktuell Free mit 11 von 15 iOS-Builds verwendet; nach diesem Stand kostet der nächste Standardbuild nichts zusätzlich. Die vorher erfragte 5-EUR-Kostenfreigabe war vorsorglich und unnötig. Die Nutzerrückfrage zu Kosten ist noch keine Bestätigung des zusätzlichen Build-/Upload-Auftrags. Details: `EVIDENCE/large-text/billing-check.md`.

Weitere fehlende Nachweise zu Hardware-/Abo-Laufzeitfällen, Foto-Genauigkeit und regionalen Rechts-/Processor-Fragen bleiben einzeln markiert. DSA ist weiterhin in Prüfung; dies betrifft EU-Veröffentlichung und ist nicht als allgemeine Apple-Voraussetzung für das Absenden zur Review dargestellt. Der Anhang ist nicht pauschal als bestanden erklärt.

## Erledigter Teil

- Bevorzugte DE/EN-Gerätesprache/Region, begrenzte Netzwerkwartezeit, lokalisierte Fehler und JPEG-Eingang korrigiert. Vorher/Nachher-Tests, vollständige Verify-Suite, TypeScript, Expo Doctor 18/18 und lokale/remote Produktionskonfiguration bestanden.
- nutrition51 mit ausdrücklicher Freigabe veröffentlicht; zurückgeladene Quellen identisch. Zehn fehlerhafte Bildanfragen live400, Übergröße413, gültiges Foto200. JWT bleibt aktiv; alle20Migrationen synchron.
- Milka LU über echten Barcode in DE/EN live verifiziert; keine pauschale Schokolade-/Keksidentität angenommen.
- Vier technisch erfolgreiche Fotoanalysen desselben vorhandenen Bilds. Keine gewogenen Referenzen; schwankende Portionen/Zubereitung. Keine Genauigkeitsquote ableitbar.
- Genau ein EAS-Produktionsbuild **1.0.0 (15)** erstellt, signiertes IPA geprüft und zu App Store Connect/TestFlight hochgeladen, von Apple fertig verarbeitet, Kandro Internal zugeordnet und für Version 1.0.0 ausgewählt. Xcode26/iOS26SDK, iPhone/iOS15.1+, 16Privacy-Manifeste und nativeDE/EN-Permissiontexte bestätigt.
- Native Debug-Simulatorprüfungen: persistierte Tagesbilanz, Profil-/Sprachwechsel, Store-Preis-/Aboauswahl, leerer Restore und Kaufdialog. Simulator-Login scheitert mit HTTP 502. Inzwischen bestätigt der Nutzer auf dem iPhone die aktive Wiederherstellung nach Kontolöschung/Neuanlage; zeitlich passender Serverzustand mit aktivem Pro und Sandbox-Kauf/Kündigung gelesen. Vollständige Abo-Laufzeitmatrix bleibt offen.
- ASC: Datenschutz veröffentlicht, DE/EN-Aboprodukte mit Prüfscreenshots/Notizen vorhanden, Verträge aktiv, DSA pending. Zehn Website-Seiten exakt mit lokalem Stand abgeglichen.

## DE / EN und Märkte

Deutsch funktioniert in den automatisierten Sprach-/Zahlen-/Nährwerttests und beobachteten Simulatorflows. Englisch funktioniert im bevorzugten Sprachfallback, den automatisierten Tests, dem sichtbaren Profil/Paywall und Live-Gateway. Vollständige manuelle DE/EN-Screenabnahme bleibt offen.

DE: Sprach-/Datum-/Zahlenbasis geprüft, DSA und Hardware-/Kauf-/Rechtsabschluss offen. US/UK/SG: englische Locale-, Datums-/Zeitzonenbasis geprüft; kein separat authentifizierter regionaler Store-Kauf. BR: Portugiesisch **nicht unterstützt**, Englischfallback und São-Paulo-/Manaus-Datumstests bestanden; keine portugiesische UI und keine BR-Rechtsfreigabe. Weitere169 konfigurierte Gebiete ungeprüft; Festlandchina ausgeschlossen. Englischfallback ist keine weltweite Unterstützung.

## Offene Gates

`OWNER_ACTIONS.md` und `FINDINGS_AND_FIXES.md` trennen fehlende Nachweise von nachgewiesenen Fehlern. 26 transitive npm-Advisories bleiben ein dokumentiertes Wartungs-/Reachability-Thema; keine ungeprüfte Major-Migration im Releasekandidaten. Alter Build11-Crashhinweis ohne Diagnose ist nicht als behoben nachgewiesen.

`COVERAGE.csv` enthält 74 Prüfbereiche, darunter ausgeführte Validatoren und klar markierte Lücken. `EVIDENCE/source-inventory.csv` inventarisiert113Quelldateien; ein Hash ist **keine** vollständige manuelle Codeprüfung. Kein GO durch reine Dateiliste oder grüne Quelltext-Suchprüfungen.

## Belege und Grenzen

Exakte Kandidaten-/Backend-/Website-Identität: `RELEASE_IDENTITY.md`. Primärquellen mit Datum/Anwendbarkeit: `SOURCE_REGISTER.md`. Datenwege/Consent/Labels/Löschung: `PRIVACY_MATRIX.md`. Rohresultate ohne Tokens: `EVIDENCE/`; Sprach-/Ländermatrix und Fotofälle in den beiden CSV-Dateien.

Es wurde keine App-Review-Einreichung ausgelöst. Dieses Ergebnis garantiert weder Apple-Annahme noch Fehlerfreiheit oder weltweite Rechtskonformität. Die bisherige Chat-/Audithistorie wurde nicht überschrieben.
