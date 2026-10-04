# F08 — nativer Großschrift-Nachtest, 6. September 2026

**FIXED_VERIFIED / SIMULATOR, lokaler Stand nach Build15. Nicht ausgeliefert.**

Umgebung: Kandro QA Local, Simulator DBA83E22-0DF4-4B41-81FE-EF8C9EAA4F6D,
iOS26.5, eigenständige lokale Debug-App. Metro aus dem tatsächlichen lokalen
Repository. Alter CI-Metro-Prozess ohne Watcher wurde beendet; frischer Metro mit
Cache-Reset lud die neuen Quellen. Kein TestFlight-Binary-Test durch den Agenten.

## Reproduktion und Korrektur

Mit `simctl ui … content_size accessibility-extra-extra-extra-large` verdrängte
der feste Footer die Tarifauswahl. Rechtstext/Links ragten unter das Display;
Tarife fehlten im AX-Baum. Screenshot `paywall-before.png`.

Kaufbereich ab fontScale > 1 im gleichen ScrollView, vertikale Tarifpreise,
umbruchfähiger Restore/Linkbereich und PrimaryButton. Bei Größenwechsel werden
native Textknoten neu aufgebaut: Der zusätzliche Wechseltest hatte zuvor eine
zu kurz gemessene Freitextkarte und alte Restore-Größe gezeigt. Mit Root-Key
fontScale ist die Karte sofort vollständig umgebrochen (Screenshot).

## Ausgeführte Nachtests

- EN, maximale Systemschrift: beide Tarife sichtbar; Auswahl Monat/Jahr ändert
  Radiozustand und Rechnungs-/Verlängerungstext. Kaufknopf vollständig lesbar.
- EN: Terms öffnet die Nutzungsbedingungen; Zurück führt zur Paywall, Terms und
  Privacy am Seitenende vollständig sichtbar.
- DE, maximale Systemschrift: Tarifnamen, Preise, Button und Rechtshinweise
  lesbar; Datenschutz öffnet die richtige deutsche Seite; Rückkehr funktioniert.
- DE, Systemschriftwechsel bei geöffneter Paywall normal → maximal → normal:
  Restore, Freigrenzen-Text, Tarife und Footer neu vermessen; Auswahl funktioniert.
- Normale Schrift DE und EN: beide Tarife, CTA und Rechtslinks vollständig
  sichtbar; EN-Jahres-/Monatsabrechnung korrekt lokalisiert.
- `npm install`: Exit0. `DOTENV_CONFIG_PATH=.env.local npm run verify` nach letzter
  funktionaler Codeänderung: Exit0, inklusive TypeScript, Expo Doctor18/18,
  bestehender Prüfsuite und Webexport. Logs in diesem Verzeichnis.

Die Screenshots wurden im nativen Simulator betrachtet und anschließend mit
`simctl io screenshot` gesichert. Zum Erreichen tiefer Inhalte nutzte CUA
Accessibility-Klicks auf Tarife bzw. passive Textknoten; dies bewegte den nativen
Scrollbereich sichtbar. CUA-Rad-/Ziehgesten zeigten wiederholt keine Bewegung.
Deshalb kein behaupteter physischer Swipe- oder VoiceOver-PASS. Der gezielte
Fingerbedienungsnachtest gehört zum zusätzlichen TestFlight-Kandidaten.

Keine Käufe, zusätzlichen KI-Aufrufe, Deployments oder Produktionsbuilds in
diesem Retest. Simulator-Schrift auf `large`, App-Sprache auf Englisch und
Darstellung hell zurückgesetzt. Quellhashes separat in `source-sha256.json`.

Versionierte Primärquellen für die Implementierung (Abruf 2026-09-06):
https://reactnative.dev/docs/0.81/usewindowdimensions und
https://docs.expo.dev/versions/v54.0.0/.
