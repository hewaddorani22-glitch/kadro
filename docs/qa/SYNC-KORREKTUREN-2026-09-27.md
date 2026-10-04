# Zwei gezielte Sync-Korrekturen – lokaler Kandidat vom 27.09.2026

Diese Änderungen gehören **nicht** zum bereits eingereichten Store-Build 1.0.2 (19).
Keine Veröffentlichung, Remote-Migration, Function-Bereitstellung, OTA oder neuer
Build/Upload wurden in dieser Aufgabe ausgeführt. Der letzte Apple-Nachweis vom
26.09., 23:35 MESZ lautet „Warten auf Prüfung“, Veröffentlichung manuell; keine
erneute Statusabfrage in dieser Sitzung.

## Änderungen

1. **Mengen-/Faktorkompatibilität:** Neue, nur lokal geprüfte Migration
   `20260926221131_meal_portion_factor_range.sql` erweitert `portion_factor` von
   `numeric(6,3)` auf `numeric(10,6)` und die obere Faktorgrenze von 20 auf 5000.
   Die vorhandene Grammeingabe 1..5000 g ergibt mögliche Quotienten 0,0002..5000.
   Dadurch können beispielsweise 5 g → 150 g sowie 5000 g → 1 g dargestellt werden.
   Mengen, Ausgangsreferenz und Nährwerte werden weder gekappt noch umgerechnet.
   Die bisherigen Gramm-/Nährwertgrenzen, RLS, RPCs, Rechte und Quoten bleiben
   unverändert. Ungültige Faktoren werden weiter abgelehnt. Die Migration ist
   transaktional mit 5 s Lock- und 30 s Statement-Limit; kein UPDATE/DELETE von
   Nutzerdaten und keine Änderung der bereits bereitgestellten Migration.

2. **Altbestand:** `legacyMealMatches` vergleicht Zutaten über ihre IDs und
   toleriert ausschließlich die alte Rundung des Faktors (maximal 0,0005 plus
   Gleitkommareserve) sowie die Reihenfolge. Mengen, Basisgramm, Nährwerte,
   Quellen und Einschluss bleiben exakt verglichen. Bereits von Build 19
   markierte Altbestandskonflikte ohne Mutation-ID werden ebenso geprüft.
   Echte lokale Mutationen bleiben geschützt; fehlende Referenzmetadaten
   werden wie bisher ergänzt und als neue Mutation vorgemerkt.

Die normale Speicher-Gleichheitsprüfung bleibt streng. Kein Client-Adapter
berechnet andere Ernährungswerte. Die Mengenbehebung benötigt die **noch ausstehende Backendmigration**; die Konfliktbehebung einen **neuen App-Build**.

## Tatsächliche Nachweise

| Prüfung | Status | Grenze |
|---|---|---|
| Ausgang gegen drei Release-Manifeste: 243/237/305 Dateien | BESTANDEN | Überschneidende Dateimengen; keine Summe und kein Git-HEAD-Ersatz |
| 25 zusätzliche Altbestandsfälle im echten Repositorymodul | BESTANDEN | Synthetischer lokaler Speicher; Rundung/Reihenfolge, schon markierte Konflikte, echte Unterschiede, Metadaten und Mutationsschutz |
| `npm run verify` einschließlich TypeScript und Web-Bundle | BESTANDEN | Dotenv aus, keine Provider-Schlüssel, npm offline; Log und Exit 0 vorhanden |
| 14 PostgreSQL-Gruppen auf dem bestehenden isolierten PG-17-Testcluster | BESTANDEN | Echte SQL/RPC/Transaktionen unter normaler Datenbankrolle, Auth-UID synthetisch; **kein echter JWT-Nachweis** |
| Große/kleine Faktoren, Standardportionen, Wiederholung, ungültige Werte | BESTANDEN | Bestandteil obiger SQL-Gruppen; bestehende Nährwertgrenzen bleiben absichtlich erhalten |
| Entfernen, konkurrierende Änderungen, Rollback, RLS, alte Schreibwege und Löschschutz | BESTANDEN | Bestehende notwendige SQL-Regressionen nach der Schemaänderung |
| Zusätzlicher aktueller Auth → JWT → PostgREST → RPC-Durchlauf | BESTANDEN | 10/10 gezielte Gruppen mit tatsächlichen Clientdiensten/SDK, Auth 2.197.0, PostgREST 16.4 und PG 17; lokale normale A/B-Nutzer und echte geprüfte JWTs |
| Frisches EAS-Uploadarchiv und iOS-Hermes-Produktbundle | BESTANDEN | 306 Dateien, 18 statische Produkt-/Isolationschecks; nur lokaler Export, kein signierter Build |
| Physische Prüfung eines neuen signierten Store-Kandidaten | AUSSTEHEND | Kein neuer Build erstellt; bestehende iPhone-Bestätigungen gelten für Build 19 |

Es gibt keinen verbleibenden fehlgeschlagenen Produkttest in diesem begrenzten
Durchlauf. Die lokale Integrationslücke ist geschlossen. Ein neuer signierter/physischer
Kandidat ist damit nicht geprüft; Build 19 enthält die Clientkorrektur nicht.

## Getrennte Werkzeugprobleme

- Der erste erweiterte SQL-Test benutzte Zutaten-ID `a` auch in neuen Fixtures;
  ein alter Test erwartete sie nur einmal. Eindeutige Fixture-IDs korrigiert,
  anschließend alle 14 Gruppen bestanden. Kein Produktpatch dafür.
- Der ursprüngliche Auth-/PostgREST-Testbestand liegt unter Documents/iCloud.
  PostgreSQL meldete `XX001`, Datei `base/16384/1249`, 0 statt 8192 gelesene Bytes;
  die Datei war als `compressed,dataless` markiert. Dienste beendet, Original
  erhalten. Ein begrenzter Kopierversuch desselben Bestands außerhalb iCloud
  lief zunächst in ein Timeout (Nachweis erhalten). Nach gezielter macOS-
  Materialisierung sind alle 1.492 Datenbankdateien größen- und SHA-256-geprüft
  außerhalb iCloud gesichert; lediglich Finder-Metadaten `.DS_Store` sind
  ausgenommen. Derselbe Cluster wurde gestartet, alle zehn Gruppen bestanden
  und die Dienste danach sauber beendet. Keine Neuinitialisierung/Down-Migration.
  Original und synthetischer Datenstand bleiben erhalten.
- Die erforderliche Offline-Paketinstallation ohne Lock-Verwendung änderte
  vorübergehend installierte Versionen. Eine erneute Offline-Installation mit
  dem vorhandenen Lock stellte alle gesperrten Versionen wieder her. Manifest
  und Lockdatei sind byteidentisch zum Ausgang; Prüfsuite erst danach bestanden.

## Aktueller Übergabepunkt

Die älteren Roadmap-/QA-Abschnitte sind historische Stände. Die atomic-sync-
Migration vom 25.09. und nutrition v53 wurden bereits am 26.09. bereitgestellt;
die neue Faktor-Migration vom 26.09. um 22:11 UTC ist dagegen **nicht live**.
`store.config.json` bleibt eine bekannte alte Metadatenkonfiguration; kein
Metadaten-Push daraus ohne separaten Abgleich mit der manuellen Apple-Freigabe.
Pro-Verzögerung, Demo-Speicherung und Supportzugang waren nicht Teil dieser
beiden Korrekturen. Der historische Produktions-QA-Vorfall bleibt separat.

Nachweise und neuer Kandidatenabgleich:
[Sync-Korrekturen-2026-09-27](/Users/hewaddorani/Documents/Codex/2026-09-06/k/outputs/Kandro/Sync-Korrekturen-2026-09-27/STATUS.md).

Aktuell: Nutzer beauftragt die Korrektur und erneute Review-Einreichung. Die
Produktion wurde nur anhand von Verwaltungsmetadaten geprüft: nutrition 53,
atomic-sync vorhanden, neue Faktor-Migration fehlt. Keine Kundendaten gelesen.
EAS @hewad/kandro steht weiterhin auf Remote-Buildnummer 19; Free-Kontingent
15/15 iOS bis 1. Oktober verbraucht. Apple wurde inzwischen erneut lesend geprüft: 1.0.2 (19) wartet auf Prüfung,
Veröffentlichung manuell.
Daher noch keine Migration, kein neuer Build/Upload und keine Reviewänderung.
Der Eigentümer wählt ausdrücklich das nächste kostenlose Kontingent. Eine
einmalige Fortsetzung am 1. Oktober um 10:00 Uhr Europe/Berlin ist eingerichtet. Die bisherigen
0-Euro-Kostengrenzen sowie manuelle Veröffentlichung bleiben erhalten.
