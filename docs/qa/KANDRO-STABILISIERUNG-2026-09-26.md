# Kandro – lokale Stabilisierung, 26.09.2026

## Ergebnis und Aussagegrenze

Der lokale Kandidat enthält bestätigte Korrekturen für Speicherung, Kontentrennung, Pro-Zustände, Dezimalportionen, Wiederholungen und einen nativ belegten Layoutfehler. Vorhandene Release-A-Arbeit ist erhalten. **Lokal behoben ist keine Releasefreigabe und bedeutet nicht, dass die Änderungen bereits bei Kunden angekommen sind.**

29 neue lokale Verhaltenstests bestehen; 17 Fälle scheiterten vor ihrer jeweiligen Korrektur. Hinzu kommen die vollständige Verify-Suite (**Exit 0**, 26.09.2026, 01:46:57–01:47:24 MESZ), 12 Prüfgruppen mit echtem isoliertem PostgreSQL und unten einzeln beschriebene native Interaktionen. Die finalen Befehlszeiten/Exit-Codes stehen in den JSON-Nachweisen.

Kein EAS-Build, Upload, App-Store-Submit, Push, OTA, Deployment oder Remote-Migrationslauf. Kein Kauf und kein echter KI-Modellaufruf. **Der erste native Test kontaktierte jedoch unerwartet externe Dienste. Die Aussage „keine Produktionskontakte oder externen Änderungen“ wäre falsch.**

## Vorfall im ersten nativen QA-Lauf

Trotz bereinigter Prozessumgebung und `EXPO_NO_DOTENV=1` enthielt der erste Entwicklungsbundle Dienstkonfiguration. Das eigene QA-Log belegt **9 RevenueCat-Anfragestarts und 9 Antworten**. Im eigenen Simulator entstand eine **Supabase-Sitzung**. Kein Kauf wurde gestartet. Eingegeben wurden ausschließlich synthetische Daten im neuen eigenen QA-Simulator.

Die Ursache wurde im installierten `node_modules/@expo/metro-config/build/transform-worker/transform-worker.js` bestätigt: Das virtuelle Entwicklungsmodul `expo/virtual/env.js` lädt `.env*` zusätzlich über `require.context`. Die CLI-Umgebungsbereinigung verhinderte dies nicht. Der erste Netzwerk-Preloader fehlte im tatsächlichen Modulgraphen; native RevenueCat-Anfragen würden zudem eine reine JavaScript-fetch-Sperre umgehen.

Nach Erkennen wurden eigene App und Metro sofort beendet. Der korrigierte QA-Aufbau liegt außerhalb des Produktrepositorys:

- `.env*` wird auf ein leeres Modul aufgelöst; Supabase auf eine nicht konfigurierte Schnittstelle; Purchases auf einen abweisenden SDK-Adapter.
- Ein tatsächlich eingebundener Layout-Vorlader installiert vor dem echten App-Layout Sperren für nicht lokale fetch-/XHR-/WebSocket-Ziele.
- Eigener Metro-Cache, explizit leere SDK-Variablen und localhost-Gateway ohne Provideraufrufe.
- Tatsächlich erzeugter iOS-Bundle vor dem nächsten Start auf Sperren und Fehlen passender SDK-Schlüsselmuster geprüft.
- Nur die Sitzungsschlüssel der eigenen lokalen QA-Installation entfernt; synthetische Mahlzeiten von Kontobindungen bereinigt.

Im zweiten Lauf wurden die Sperren ausgeführt. **0 RevenueCat-Netzwerkstarts im Log, 0 Supabase-Sitzungsschlüssel im QA-Speicher.** Das ist ein Bundle-/Schnittstellen-/Lognachweis, keine vollständige Paketaufzeichnung des Betriebssystems.

**Unbekannt bleibt, ob die erste Sitzungs-/Profil-/Consent-Initialisierung synthetische Cloud-Testdaten hinterlassen hat.** Es gab keine nachträgliche Produktionsabfrage oder Fernlöschung, weil der Auftrag beides untersagt. Der erste Lauf zählt nicht als sauber isolierte Abnahme. Eine gezielte externe Untersuchung wäre separat freizugeben; keine automatische Kundendatenreparatur.

Evidenz: `native/isolation-incident.json`, `native/metro-initial-unsafe.redacted.log`, `native/bundle-isolation-check.json`, `native/safe-final-storage.json`. Keine Schlüssel, Tokens oder Cloud-Kundenkennungen in diesem Bericht. Die Codex-401-Unterbrechung ist davon getrennt und kein Nachweis eines Kandro-Produktfehlers.

## Ausgangsstand und erhaltene Vorarbeit

Repository: `/Users/hewaddorani/Developer/Kandro-recovery-20260906`.
Branch: `audit/app-store-release-gate-20260904`.
HEAD: `633d688e6a6247a6e1cc66f85788c157b6e12863`.

`app-lokal` im Wrapper verweist auf diese Arbeitskopie. iCloud-Original und Chatarchiv blieben unberührt. Kein Reset, Clean, Stash, Commit oder Push. Baseline ist der vorhandene schmutzige Arbeitsbaum, nicht HEAD. Release A vom 25.09. war bereits enthalten.

Gelesen: geltende AGENTS, README, Architektur/Roadmap, aktueller Auftrag, K01–K08, unveränderte Originalauditdateien und die angeforderten Handbuchkapitel 1–5, 7–9, 12–20, 23–24 und 30. PDF: 76 Seiten. Das alte Charakterisierungsskript erwartet teilweise ausdrücklich Fehler; es wurde weder umgeschrieben noch als Reparaturtest ausgegeben.

Private Sicherung: `baseline/source.zip`, Manifest, Gitstatus/Branch/HEAD. Alle **270** gesicherten Dateien sind noch vorhanden, **248 bytegleich**, **22 gezielt geändert**. Neu: dieses Dokument und `scripts/validate-stabilization.mjs`. `changed-files.json` und `stabilization-changes.patch` beziehen sich ausschließlich auf diese Baseline. Keine Behauptung eines Vollbackups sämtlicher Verzeichnisse.

Paket-Lock unverändert: `9c4831dcf4dfcbb95a9524eb6a43b702878a3d16f18a23793174857f1a7bc81b`. Keine Framework-/SDK-Aktualisierung. Vorhanden: Expo 54.0.37, React 19.1.0, React Native 0.81.5, RevenueCat 10.8.1, Supabase JS 2.112.4.

## K01–K08: aktueller Status

| Befund | Bewertung / Änderung | Nachweis und Grenze |
|---|---|---|
| K01 Zielerklärung | Bereits in Release A behoben. Gemeinsames `caloriePlan` liefert Erhaltung, angefragten und angewendeten Aufschlag. Keine neue Ernährungsformel. | `validate-release-a`, Ziel-/Plan-/Einheitentests. Beispiel: 2447,5 Erhaltung, +550 angefragt, 3000 Ziel, +552,5 angewendet. Keine medizinische Aussage. |
| K02 OFF-Nullmakros | Bereits behoben. Edge-Suche und Barcode verwenden denselben strengen Vollständigkeitsprüfer. | Tatsächlicher Edge-Suchadapter mit synthetischer Antwort: fehlend/null/leer/negativ, echte Nullen, Dezimalwerte, kcal/kJ. Kein bloßer Development-Gateway-Nachweis; Edge noch nicht veröffentlicht. |
| K03 Zutatenreste | Bereits behoben: vollständige versionierte Mahlzeiten-RPC ersetzt den Zustand atomar. | Lokales PostgreSQL A+B→A, Austausch/leerer Satz, Wiederholung. Keine produktiven Mahlzeiten untersucht. |
| K04 Teiltransaktion | Bereits behoben: Parent, Zutaten und Revisionsbuchung rollen gemeinsam zurück. | Injizierter Zutatenfehler, Zustandsvergleich, zwei gleichzeitige DB-Sitzungen. Keine Remote-Migration. |
| K05 Metadaten | Bereits behoben: additive Metadaten und kompatibler Altlesepfad. Zusätzlich jetzt tatsächlicher clientseitiger Dezimal-/Mindestmengenfehler korrigiert. | Release-A-Roundtrip, neue Portionstests, native Rückkehr auf 100,5 g. Fehlende Originalreferenzen werden nicht erfunden. |
| K06 Proteinstatus | Bestehende Berechnung vergleicht vergangene Tage mit dem heutigen Ziel. Jetzt ehrlich in DE/EN als Vergleich mit dem **aktuellen** Ziel beschriftet. | `progress.tsx`, i18n, englischer Hinweis nativ sichtbar. Kein historisches Ziel-/Sync-System hinzugefügt. |
| K07 Wiederholung | Gleichentagsfilter bleibt Produktregel. Tatsächliche Doppelspeicherung und Scan-Ursprungsübernahme bei Wiederholung korrigiert. | Zwei parallele Callback-Aufrufe teilen einen Speichervorgang; freier `plan`-Ursprung verhindert spätere Scan-Nachzählung. Keine neue Wiederholungs-/Favoritenfunktion. |
| K08 Roh/Gar | Release A enthält bereits explizite Referenz-/Wiegezustände für 67 Rezepte / 85 Zutaten. Keine zusätzlichen Garfaktoren erfunden. | Summen und DE/EN-Portionsprüfungen erneut bestanden; nativ Seitan 1×/0,7× mit 3→2,1 g Öl. Kochzeit unverändert. Offene Zeitangabe unten. |

Die vorbereitete Release-A-Neuberechnung verändert bei 48 Rezepten Summen. Das ist erhaltene Vorarbeit, keine neue Änderung dieser Runde. Bereits gespeicherte Kundengerichte wurden nicht neu berechnet.

## Neue Fehler: Reproduktion, Korrektur, Test

| Bestätigter Fehler / Wirkung | Lokale Änderung und Fundstelle | Nachweis |
|---|---|---|
| Beschädigtes Mahlzeiten-/Gewichts-JSON wurde als leer behandelt. | `localRepository.ts`: Lesefehler weitergeben; nur Abwesenheit erhält Defaults. `AppContext.tsx`, `AppRouteGuard.tsx`, i18n: blockierende, nicht löschende Wiederholung. | Vorher zwei Solltests rot; nachher Originalspeicher erhalten und späterer Retry erfolgreich. |
| Parallele Gewichtsschreibvorgänge verloren einen Tag; verspäteter Altwert beim Kontowechsel. | Serielle Hilfsschreibqueue für Gewicht/Profil/Analyseaufträge; Generation erfassen; Kontoersetzen/-löschen wartet auf laufende Schreibvorgänge. | Vorher 1 statt 2 Tage bzw. Altwert; nachher beide Tage und sichere Ersatzkontogrenze. Stabile Analyse-Request-IDs zusätzlich geprüft. |
| Kontowechsel während Lösch-Identitätslookup konnte danach lokal löschen. | `syncRepository.ts`: Generation vor erstem await und erneute Prüfung nach Lookup; Callback-Grenzen in `AppContext.tsx`. | Vorher fehlte erwarteter Abbruch; danach keine Löschung. Späte UI-Antworten zusätzlich geprüft. |
| Löschmarker geschrieben, Tagebuchschreiben fehlgeschlagen: gelöschte Mahlzeit erschien beim Lesen wieder. | `localRepository.ts`: dauerhaften Tombstone schon beim Lesen sichtbarer Mahlzeiten berücksichtigen. | Vorher Mahlzeit sichtbar, danach verborgen. Native Löschung plus Neustart separat bestanden. |
| SDK-Free verdeckte serverbestätigtes Pro. | `SubscriptionContext.tsx`: native Storeaktualisierung fragt auch bei SDK-Free den vorhandenen Serververtrag ab. | Vorher `ready`, danach `active` bei positivem Serverrecht. |
| Store-Erfolg mit ausstehender Serverbestätigung sowie Apple-Payment-Pending als Fehler. | `pending`-Status und differenzierte Ergebnisse in Subscription-Service/-Context, Paywall, Scan, i18n und Telemetrie-Allowlist. Pending-CTA prüft erneut. | Kauf/Restore/Pending vorher rot; nachher keine falsche Kaufmisserfolgsmeldung und keine Freischaltung ohne Server. |
| Doppeltap startete SDK-Kauf zweimal; spätes Ergebnis nach Kontowechsel setzte altes Recht. | Synchrone Billing-Sperre, Account-/Consent-/Unmount-Generation, `interrupted`-Ergebnis. | Vorher zweimal / `active`, nachher einmal / verworfen. Abbruch, fehlende Produkte, Timeout, Ablauf, Fehler und Restore zusätzlich geprüft. |
| Portion 1× machte aus 3 g plötzlich 10 g und 100,5 g zu 101 g. | Beide Skalierungsstellen in `AppContext.tsx`: bestehende Grenzen 1–5000 g, Zehntelgramm statt Mindestwert 10 und Ganzzahlrundung. | Gleiche Portion unverändert; Rückkehr auf Basis ohne Summendrift. Nativ 100,5→70,4→100,5 g / 211→148→211 kcal. |
| Wiederholung doppelt gespeichert und beim späteren Zählen als zusätzliche KI-Analyse verbucht. | Gemeinsame laufende Wiederholung pro Konto/Mahlzeit, freier Ursprung, Freigabe der Sperre auch bei Fehler; `today.tsx` zeigt bestehenden Speicherfehler. | Zwei Aufrufe → ein Eintrag, keine zusätzliche Scan-Zählung, Fehlerretry und verspätete Kontorückgabe geprüft. |
| Große Schrift schnitt englischen Portionshinweis rechts ab. | Nur `confirm.tsx`: Zeile darf umbrechen, Titel auf Containerbreite begrenzt. | Native Vorher-/Nachher-Bilder; Hinweis danach vollständig sichtbar. Kein Redesign. |
| Abschließender Review fand neue Regression: schneller Wechsel metrisch→US→metrisch während Speichern verlor letzte Wahl. | `AppContext.tsx`: bei laufendem Einheitenschreiben auch Rückwahl zum noch angezeigten Wert seriell speichern; Zähler im finally freigeben. | Neuer Test zuerst Exit 1 (`us !== metric`), danach grün; Fehlerfall löst Sperre und erhält Profil. Nicht nochmals nativ getestet. |

**29 Tests sind nicht 29 neue Bugs.** 17 Testfälle scheiterten vor dem jeweiligen Fix; weitere Fälle sichern angrenzendes Verhalten. Der Layoutfehler hat einen separaten nativen Nachweis. Der Test gegen erneutes Befüllen einer leeren Fremdkonto-UI bestand bereits zuvor und wird nicht als zusätzlicher Vorher-Bug gezählt.

## Befehle und Belege

Evidenzwurzel im Wrapper: `Stabilisierung-2026-09-26/`. Alle unten genannten Evidenzpfade sind relativ dazu; Codepfade relativ zum oben genannten Repository. Zeiten MESZ (UTC+2), JSON-Zeiten teilweise UTC.

| Prüfung | Befehl / Zeitpunkt / Exit | Ergebnis und Art |
|---|---|---|
| Abhängigkeiten | `npm install --offline --ignore-scripts --no-audit --no-fund`, Exit 0 | Bereits aktuell; Lock unverändert. Keine Install-Skripte/Upgrades. |
| Erste Reproduktion | `node scripts/validate-stabilization.mjs`, ca. 00:58, Exit 1 | 10 fachliche Fehler, `reproduction-before.json` + `reproduction-before-exit.json`. |
| Portion/Wiederholung/Löschrace | gleicher Befehl, ca. 01:08, Exit 1 | 5 zusätzliche Fehler, `reproduction-before-portions.json`. |
| Unterbrochene Löschung | gleicher Befehl, ca. 01:12, Exit 1 | 1 zusätzlicher Fehler, `reproduction-before-deletion.json`. |
| Einheit-Rückwahl | gleicher Befehl, nach finalem Codereview, Exit 1→0 | 1 zusätzlicher Fall, `reproduction-before-unit-reversal.json`, entsprechender Exit-Nachweis. |
| Neue Regressionen final | `node scripts/validate-stabilization.mjs`, Exit 0, ebenfalls im Verify | 29 PASS, `stabilization-results.json`. Echte Module/Callbacks, synthetische React-/Storage-/SDK-/Servergrenzen; keine native Transaktion. |
| Vollständige Prüfsuite | `python3 Stabilisierung-2026-09-26/run-verify.py` führt `npm run verify` im Repo aus | `verify-result.json` enthält finale Start-/Endzeit und Exit; `verify.log` vollständige Ausgabe. TypeScript, Release A, 29 Tests, Consent/Quota/Privacy, Suche/Barcode, Rezepte/Sprachen, Expo Doctor, Webexport. |
| Lokale DB | `python3 scripts/validate-meal-sync-postgres.py`, Exit 0 | 12 PASS, `postgres-final.log` und `postgres-result.json`. Frischer Socket-Cluster anschließend gestoppt. |
| Abschluss | `git diff --check`, Baseline-/Hashvergleich | `final-checks.json`, `changed-files.json`, `stabilization-changes.patch`. |

Vollständige grüne Läufe vor den zwei späten, begrenzten Korrekturen liegen unter `before-layout-verify.*` und `before-unit-verify.*`. Zwischenfehler wegen fehlendem Testadapter, statischer Reihenfolgeannahme und veraltetem Pending-Vertrag sind unter `verify-harness-failure.log`, `verify-static-order-failure.log`, `verify-entitlement-old-contract.log` und `verify-unit-harness-failure.log` getrennt. Das sind keine zusätzlichen Kundenfehler. Assertions wurden nicht gelöscht/übersprungen. Callback-Adapter wurden um echte neue Abhängigkeiten ergänzt; der alte statische Entitlement-Vertrag ist durch Runtime-Tests abgesichert angepasst.

Die Verify-Suite umfasst 2592 reale Empfehlungs-/Rezept-/Speicherkombinationen, darunter 20 kcal Rest → 200 kcal Vorschlag → 180 kcal über Ziel, sowie 67 Rezepte mit 85 Quellenzutaten. Expo Doctor meldet 18/18. Ein Export ist kein nativer Test.

Ein zusätzlicher lesender Review verglich den Delta gegen die Baseline und fand die schnelle Einheit-Rückwahl. Die anschließende Gegenprüfung bestätigte die Korrektur und fand keine weiteren konkreten hohen/mittleren Regressionen im geprüften Umfang. Das ersetzt keine zusätzliche Geräte- oder Produktionsprüfung.

### Echte Datenbankprüfung

PostgreSQL 17, leere eigene Instanz ohne TCP-Listener, synthetische `auth.users`/`auth.uid()`, echte Rollen A/B. Relevante Migrationen in Reihenfolge: `20260831111459`, `20260901150000`, `20260901160000`, `20260905141007`, `20260925142154`.

Geprüft: vollständige Metadaten; idempotenter Retry; Parent-/Children-/Revision-Rollback; entfernte Zutaten; veraltete Revision; verlorene Bestätigung; leerer Ersatz; parallele Sitzungen; alter Clientpfad/Löschung; Löschretry; RLS/private Tabelle/anonymer Zugriff; Kontolösch-Cascade; Invoker-Wrapper und begrenzte Definer mit leerem search_path.

Ein erster Versuch stoppte an der lokalen `/tmp/kandro-pg-`-Pfadschutzprüfung, bevor DB-Tests liefen. Erst `postgres-final.log` enthält den bestandenen Lauf. Kein vollständiger Supabase-Auth/PostgREST-Stack, keine Produktionsprüfung und keine heute neu geänderte SQL-Datei.

## Native Prüfung und ihre Grenzen

macOS 26.6.2 (25G83), Xcode 26.6 (17F113), iOS 26.5 (23F77), eigener Simulator „Kandro Stabilisierung 26 Sep“, iPhone 17 Pro. Vorhandener kompatibler nativer Debug-Unterbau mit aktuellem Metro-JavaScript. Kein neu signierter App-Store-Build.

**Erster Lauf nicht als sauber isolierter Pass gewertet:** Erwachsenes Onboarding (90,5/90.5 akzeptiert, 0 abgewiesen), Consent, fünf Tutorialseiten, Demo mit Portion/Zutat/Ergebnis und Neustart, DE-Suche sowie Softwaretastatur wurden bedient. Wegen des Vorfalls sind dies begrenzte Beobachtungen, keine isolierte Abnahme.

**Zweiter Lauf mit harten SDK-/Cloudgrenzen:**

| Interaktion | Sichtbarer / gespeicherter Nachweis | Datei unter `native/` |
|---|---|---|
| Synthetisches Profil, DE→EN, Hell→Dunkel, metrisch→US | 90,5 kg als 199,5 lb; lokaler Gewichtsverlauf und aktuelles Proteinziel erläutert; Backup unkonfiguriert | `safe-progress-en-dark.*` |
| Bread-Suche über lokale echte BLS-Suche, 100.5 g | 211 kcal; genau ein neuer Eintrag; Gesamt 906 kcal | `safe-search-result.*`, `safe-storage-after-search.json` |
| Rezept zweimal öffnen/zurück; 1×→0,7× | 510→357 kcal; 3→2,1 g Öl; 15→10,5 g Tahini; Kochdauer bleibt 30 min; gespeichert 357 kcal | `safe-recipe-07.*`, `safe-storage-roundtrip.json` |
| Brot-Details zweimal öffnen, 0,7×/1× speichern | 100,5→70,4→100,5 g; 211→148→211 kcal; Gesamt wieder 1263 | `safe-storage-roundtrip.json` |
| Kaltstart 1 | 3 Mahlzeiten, 1263 gegessen / 1877 übrig; Englisch, Dunkel, US und Profil erhalten | `safe-cold-restart-ready.*` |
| Synthetisches Brot löschen; Kaltstart 2 | 2 Mahlzeiten, 1052 gegessen / 2088 übrig, 1 dauerhafter Löschmarker | `safe-delete-restart.*`, `safe-storage-after-delete-restart.json` |
| Home→App-Symbol zweimal | Beide Rückkehrzyklen mit unveränderter 1052-kcal-Bilanz | `safe-background-cycle-1.txt`, `safe-background-cycle-2.txt` |
| Pro öffnen/schließen ohne Storekonfiguration | Bestehende Vorschau-Paywall und Rückweg zum Profil, kein Kauf | `safe-paywall-unconfigured.*` |
| Lokaler Textanalysefehler 502 | Verständlicher Fehler, „Change input“ zum vorhandenen Editor | `safe-describe-error.*`, `fixture-gateway.log` |
| Neue Beschreibung mit lokaler 200-Fixture | 100,5 g/201 kcal; Bestätigung, Resultat, Heute; genau ein Eintrag; Gesamt 1253 | `safe-describe-recovered.*`, `safe-analysis-back-today.txt`, `safe-final-storage.json` |
| Bevorzugte Textgröße einmal erhöhen | Abgeschnittener Hinweis reproduziert; Umbruch vollständig sichtbar | `safe-describe-recovered.png` vorher, `safe-confirm-large-text-fixed.png` danach |

Gezählte Zyklen: 2 Rezept öffnen/zurück, 3 Brot-Details (2 Portionen + Löschung), 1 Paywall öffnen/schließen, 2 Kaltstarts, 2 Hintergrund-/Vordergrundwechsel. Kein Belastungstest behauptet.

`safe-cold-restart.*` ohne `-ready` zeigt noch das Laden, keinen erfolgreichen Neustart. Scroll-/Drag-Aufrufe des Werkzeugs bewirkten im Confirm-Screen keinen sichtbaren Scroll. Einige untere Aktionen wurden direkt per Accessibility ausgelöst. Ihr fachlicher Effekt ist belegt, **vollständige Touch-Erreichbarkeit aller unteren Buttons nicht**. Es wurde kein unbelegter Scroll-Fix eingebaut.

Die Gateway-Analyse ist eine synthetische Fixture, keine Erkennungsgenauigkeit. 502→neue Eingabe→200 belegt den Rückweg, nicht native identische Retry-IDs. Die Retrys sind separat mit lokalen Adaptern geprüft. Die späte Einheit-Rückwahlkorrektur wurde nach Beenden des Simulators automatisiert, nicht erneut nativ geprüft.

## Offene Punkte

- Erststart/Consent unter dem korrigierten isolierten Aufbau erneut prüfen; UK-Einheiten nativ, kleine iPhone-Größe, große Schrift über alle Screens, echte Scroll-/Safe-Area-/Tastaturbedienung der Hauptaktionen. Ein kleiner Gerätetyp ist vorhanden, wurde bei ca. 3,5 GiB Restplatz und Speicherdruck nicht zusätzlich gestartet.
- Kein nativer Release-Konfigurations-Smoke-Test: vorhandener Debug-Unterbau statt neuem lokalem Releasebuild. Keine Distributionssignierung organisiert.
- Echte iPhone-Kamera/Fokus/Fotoqualität sowie reale StoreKit-/RevenueCat-/Webhook-/Serverfreischaltung fehlen. Pro-Varianten sind Controller-/SDK-/Serveradaptertests; native Paywall hier nur unkonfigurierte Vorschau.
- 502→bearbeiten→200 nativ belegt. Vollständiger Flugmodus-/Online-Wiederanlauf und nativer Tageswechsel fehlen; Deadline-/Retry-/Datums-/Quotengrenzen lokal getestet.
- Seitan-Gyros-Karte: 25 min; Zubereitungsschritt: 30 min. Tatsächliche Gesamtzeit nicht belegt; keine scheinexakte Dauer eingesetzt. Vor Inhaltsfreigabe praktisch verifizieren.
- Gewichtshistorie bleibt lokal. Kein historisches Ziel-/Gewichtssync-System. Korrupte Daten werden erhalten/blockiert, nicht automatisch repariert.
- Produktive Migrationen, Datenintegrität, Käuferrechte, Umsatz/Nutzung und mögliche synthetische Cloud-Testdaten des ersten Laufs wurden nicht nachträglich untersucht.

## Unverändert und spätere Veröffentlichung

Name, Logo, Farben, Navigation, Preise, Aboprodukte, Gratisumfang, KI-Anbieter und Modell unverändert. Auth/RLS, Consent/Guardian, serverseitige Pro-Autorität, Quoten und Zeitpuffer nicht gelockert. Neue Telemetrie-Ergebniswerte sind lokale Klassifizierung, kein Live-Trackinglauf und keine erfundenen Ereignisse.

QA-Resolver, SDK-Stubs und localhost-Gateway liegen nur im privaten Wrapperordner. Keine Produktkonfiguration schaltet automatisch darauf um; kein ausgelieferter Pro-Bypass.

Spätere Reihenfolge, mit gesonderter Freigabe:

1. Offene lokale/physische Gates schließen; gegebenenfalls QA-Vorfall gezielt untersuchen. Keine automatische Kundendatenreparatur.
2. Vorbereitete additive `supabase/migrations/20260925142154_atomic_meal_sync.sql` und OFF-Edge-Korrektur vor einem davon abhängigen Mobile-Update kontrolliert veröffentlichen.
3. Vollständige Auth/PostgREST-/RPC-Kette im freigegebenen Umfeld prüfen. Neuer Client bei altem Backend behält lokale Daten; kein stiller Rückfall auf unsicheren Zweischritt. Alte Clients behalten trotz neuer Migration ihre alten Schreibgrenzen.
4. Kompatiblen Mobile-Build mit exakter Buildnummer, Kamera, Konto-/Gerätewechsel, offline/online, Kauf/Abbruch/Restore prüfen.
5. Erst dann Veröffentlichung entscheiden. Revisions-/Löschhistorie bei Rollback nicht pauschal löschen.

Eigene Testserver und eigener QA-Simulator beendet; PostgreSQL vom Harness gestoppt (`native/cleanup.json`). Fremde Prozesse/Geräte unangetastet. Keine Garantie vollständiger Bugfreiheit, besserer Retention oder höherer Umsätze.
