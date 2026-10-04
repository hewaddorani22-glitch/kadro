# Scan-Rückmeldung und Apple-Status – 30.09.2026

## Aktueller Stand

Apple zeigt **1.0.2 (19): Ausstehende Entwicklerfreigabe**. Die Version ist
genehmigt, aber nicht öffentlich freigegeben. Im deutschen öffentlichen Store
steht weiterhin **1.0.1**. TestFlight führt Build 19 in **Kandro Internal**;
das eigene Testerkonto ist `hewaddo28@icloud.com`. Keine Apple-Einstellung geändert.

Der Nutzer verwendet nach eigener Angabe die App-Store-App; unter Kandro Pro
steht laut seiner heutigen Bestätigung **Upgrade / Pro kaufen**. Das belegt
keine aktive Pro-Anzeige. Keine RevenueCat-/Kundendatenabfrage und kein Refresh
wurden ausgeführt. Die TestFlight-Einladung ist keine Pro-Berechtigung. Apples
TestFlight-Käufe laufen in Sandbox und kosten den Tester nichts; sie gelten
nicht als bezahltes Abo in der normalen Store-App.

## Gezielte lokale Änderungen

1. **Fotoanzeige:** `MealPhoto` verwendete `cover` im festen Rahmen. Das schneidet
   bei anderem Seitenverhältnis sichtbare Bildränder ab. Echte Foto-URIs verwenden
   jetzt `contain`, gemeinsam in Bestätigung und Ergebnis. Das Demo-Bild bleibt
   unverändert. Aufnahme, Bildkompression, Analyse, Löschung und Speicherung sind
   unverändert. Der Code verkleinert das Analysefoto ohne expliziten Crop. Ob
   bereits die Kameraaufnahme auf dem Nutzergerät abweicht, ist damit nicht bewiesen.
2. **„45 % Milch“:** Der lokale BLS-Katalog liefert für die exakte Angabe keine
   Treffer. Für eine unaufgelöste reine Milchangabe mit einer Fettprozentzahl
   öffnet der bestehende Korrekturbildschirm jetzt automatisch die gewöhnliche
   Datenbanksuche nach Milch. Die ersten passenden BLS-Referenzen sind 1,5 %
   (`M111200`) und 3,5 % (`M111300`); die Originalangabe bleibt sichtbar.
   DE/EN erklären, dass der Nutzer die passende Variante wählen und die Menge
   bestätigen muss. Kein automatisches Ersetzen oder Erraten von Nährwerten.
   Portionsmenge, Zutaten-ID und andere Zutaten bleiben beim bestehenden
   Korrekturweg erhalten. Manuelle Suche/Barcode bleiben nutzbar; ein fehlender
   Treffer zwingt nicht zum Löschen einer tatsächlich verzehrten Zutat.

Die vereinfachte Milchsuche greift ausschließlich bei unaufgelösten reinen
Milchnamen. Pflanzliche, laktosefreie, aromatisierte und gemischte Produkte werden
nicht durch gewöhnliche Kuhmilch ersetzt. Das ist keine allgemeine semantische
Tippfehlerkorrektur für alle Lebensmittel. Bekannte genaue Treffer werden nicht
verändert. Unbekannte Nährwerte bleiben eine Speichersperre; Quoten und Pro-Regeln
sind unverändert. Kein Backendcode musste für diese beiden Änderungen geändert werden.

## Prüfungen

| Prüfung | Ergebnis | Tatsächlicher Nachweis / Grenze |
|---|---|---|
| Originalfall und reale Milchreferenzen DE/EN | BESTANDEN | Erweiterter `validate-ingredient-correction.mjs`: exakter Miss, echte BLS-Codes, Mengen-/Identitätserhalt, unveränderte andere Zutat |
| Keine unbemerkte Normalisierung anderer Milcharten | BESTANDEN | Negative Fälle für Hafer/Soja/Ziege, laktosefrei, Kondensmilch, Milchpulver, Geschmack, Mischungen und mehrere Prozentangaben |
| Verspätete/mehrfache Suche, Fehler und Verlassen | BESTANDEN | Fünf Läufe des aus dem aktuellen Bildschirm kompilierten Async-Handlers mit synthetischem Transport; `search-races.log` |
| Tatsächliche MealPhoto-Komponente | BESTANDEN (Web) | Acht Web-Renderings: DE/EN × Hoch-/Querformat × Bestätigungs-/Ergebnishöhe; geladene Bilder und berechnetes `contain`; Randmarkierungen visuell sichtbar, `photo-preview.png` |
| Paketinstallation und Lock-Erhalt | BESTANDEN | Offline-Installation ohne Lifecycle-Skripte; `package.json` und Lock bytegleich zum Ausgang |
| Vollständiges `npm run verify` | BESTANDEN | `verify-final.log`, Exit 0, TypeScript/Regressionen/Expo Doctor/Web-Export; Dienstschlüssel entfernt, Dotenv deaktiviert, nur öffentliche Legal-Konfiguration |
| Lokaler iOS-Hermes-Export | BESTANDEN | `ios-export.log`, Exit 0; ungesigniertes Bundle, keine EAS-Ausführung und kein Nachweis der späteren Produktionskonfiguration |
| Foto-/Korrekturablauf auf iPhone mit neuem Build | BLOCKIERT | Noch kein neuer signierter Build; die bisherigen Bestätigungen zu Build 19 decken diese Änderungen nicht ab |
| Live-Kamera, KI-Antwort auf „45 % Milch“, Kauf/Restore | NICHT AUSGEFÜHRT | Keine Live-KI-Aufrufe, Käufe oder Backend-Kundenabfragen in diesem Auftrag |

Erster Verify-Lauf scheiterte an fehlender öffentlicher Legal-Konfiguration des
isolierten Prüfprozesses. Mit den bereits vorhandenen öffentlichen Legal-Werten
aus `eas.json` und deaktiviertem Dotenv bestand der unveränderte Websitevergleich.
Keine Website oder Rechtstexte dafür geändert. Das ist ein Testaufbaufehler,
kein nachgewiesener Produktfehler. Die erste private SSR-Prüfung erwartete einen
Inline-Stil; React Native Web erzeugt dafür eine CSS-Klasse. Danach wurden die
tatsächlichen berechneten Stile im Browser geprüft, nicht bloß ein Quelltextstring.

## Kandidat und Releasegrenze

Der Arbeitsbaum außerhalb iCloud bleibt einschließlich aller vorherigen Änderungen
erhalten: `/Users/hewaddorani/Developer/Kandro-recovery-20260906`.
Vorher-/Nachher-Manifeste, nur der heutige Zusatzpatch, Prüfprotokolle und Bildnachweis:
`/Users/hewaddorani/Developer/Kandro-QA-Feedback-20260930`.
Maßgeblich ist `candidate-after.json` einschließlich uncommitteter Dateien,
nicht Git-HEAD allein. Das private QA-Verzeichnis liegt außerhalb des Uploadrepos.

Die bestehende Sync-Korrektur samt nur lokal vorhandener Migration
`20260926221131_meal_portion_factor_range.sql` bleibt erhalten. Die zehn lokalen
Auth-/JWT-/PostgREST-Gruppen vom vorherigen Durchlauf werden nicht neu als heutige
Prüfung ausgegeben und nicht wiederholt; ihr Codebereich wurde nicht geändert.
Die heutigen Korrekturen sind **nicht in 1.0.2 (19)**. Kein Build, Upload, Deployment,
OTA, Store-Submit oder Release wurde hier ausgeführt. Zusätzliche Dienstkosten: 0 €.

Für die bestehende Fortsetzung am 1. Oktober ist der Apple-Status gegenüber dem
früheren Freigabevorschlag verändert: genehmigt statt wartend. Die genehmigte
Freigabe darf nicht stillschweigend abgebrochen werden. Vor einer Ausführung
müssen aktuelles Gratis-Kontingent, exakter Kandidat und passender Releaseauftrag
abgeglichen werden. Der konkrete neue iPhone-Test umfasst Hoch-/Querformatfoto
mit Randmarken sowie fehlende Milchangabe → reale Variante wählen → Menge prüfen
→ Speichern genau einmal, jeweils DE/EN und bei großer Schrift. Kein allgemeiner
Auditneustart und keine Behauptung einer fehlerfreien KI-Erkennung.

Quellen: [Apple TestFlight](https://testflight.apple.com/),
[App Store Connect – Kandro](https://appstoreconnect.apple.com/apps/6808622187/distribution/ios/version/inflight),
[öffentlicher deutscher Store](https://apps.apple.com/de/app/id6808622187).
