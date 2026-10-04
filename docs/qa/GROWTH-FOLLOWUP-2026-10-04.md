# Kandro: Folgeauftrag und Reviewstand vom 04.10.2026

Dieser Bericht führt den ausdrücklich angenommenen Folgeauftrag aus
`Eingefügter Text.txt` fort. Er ersetzt widersprüchliche historische Statusangaben,
ohne frühere Reparaturen, Prüfbelege oder die bestehenden Freigabegrenzen zu
verwerfen. Er ist noch keine Freigabe zur Apple-Einreichung.

Arbeitskopie: `/Users/hewaddorani/Developer/Kandro-recovery-20260906`, Branch
`release/1.0.4`, Ausgangscommit `c412a38a4019c6ff483a0bcb00a4d17df6e9a02c` plus
die erhaltenen und ergänzten uncommitteten Dateien. Die Branchbezeichnung ist
keine ausgelieferte Appversion. Private Nachweise liegen unter
`/Users/hewaddorani/Developer/Kandro-Erfassung-20261001/hardpaywall-testflight/growth-followup-20261004`
(im Folgenden `G`). Geheimnisse, Kundenmahlzeiten und persönliche Fotos gehören
nicht in diesen Bericht oder ins Repository.

## Tatsächlich bereitgestellter Stand

| Bereich | Beobachteter Nachweis | Grenze |
| --- | --- | --- |
| Konservative Kohorte | `G/restore-readback-proof.json`, 04.10.2026 15:02:44 UTC: PASS; Migration `20261004145423_restore_verified_new_adult_paywall`; `publicEnabled=false`, `enforcementEnabled=true`; nur Service-Rolle darf Enrollment ausführen | Kein öffentlicher Neustart, keine neue Testzuteilung; 0 neue Nutzer / 0 Modellaufrufe in diesem Nachweis |
| Einschlussregeln | Verifizierte freiwillige Kontoverknüpfung, bestätigte Volljährigkeit, neue Identität ohne Kontohistorie/Vorabnutzung, positive Trialprüfung und stabile Originalzuordnung geprüft | Anonym, unbekannt, zurückkehrend oder bereits kostenlos genutzt bleibt außerhalb. Eine vollständig neue Identität kann ohne Fingerprinting nicht sicher als dieselbe Person erkannt werden |
| Backend | `G/narrow-deploy-ranking/readback-proof.json`: `nutrition` **63 ACTIVE**, JWT-Prüfung an; 9/9 Gates und 16/16 Quellhashes stimmen mit dem geprüften Paket überein | Enge Pasta-Sortierkorrektur gegenüber Version 62 gezielt einmal bereitgestellt, vier andere Funktionen unverändert. Kein neuer Modellaufruf, kein daraus abgeleiteter Geräte-/Fotoqualitätsnachweis |
| Profil-/QA-Migrationen | `G/narrow-deploy/readback-proof.json`: 12/12 Prüfungen bestanden, Zielprofil `20261004145027` und dauerhafte QA-Quelle `20261004150033` gezielt bereitgestellt | RLS, drei Profilpolicies, 17 Grants und Service-only-Zugriff unverändert; konservative Migration erhalten, öffentlich weiterhin aus; 0 Modellaufrufe, keine Kundenmahlzeiten gelesen |
| Storeartefakt | EAS `3993395e-a87f-4f31-a241-5c3e363577f1`, 1.0.3 (26), FINISHED, Commit `c412a38`; Apple-Build `fbcff537-4d54-4633-8d11-99c292a551b5`, VALID / IN_BETA_TESTING | `G/builds-current.json` und `G/apple-current.json`; keine Behauptung, dass die neueren lokalen Funktionen in Build 26 enthalten sind |
| Jahres-Trial | `G/annual-trial-application.json`: `READBACK_PASS` am 04.10.2026 um 15:17:44 UTC; 175/175 Gebiete, `ONE_WEEK`, `FREE_TRIAL`, eine Periode für das bestehende Jahresprodukt. Vorher kein Jahres-Einführungsangebot | Reguläre Preise und Abogruppe unverändert. Das Angebot gilt für alle Apple-berechtigten Jahreskäufer, nicht nur A/B. Tatsächliche StoreKit-Auslieferung und persönliche Eligibility auf dem Gerät bleiben ungetestet |

Die frühere Öffnung für anonyme Neuinstallationen und der behauptete öffentliche
A/B-Start sind durch die ausdrücklich bestätigte konservative Wiederherstellung
überholt. Bereits vorhandene Rechte werden nicht rückwirkend entzogen;
Zuordnungen werden nicht neu ausgelost. Anonyme Nutzer sind keine Kontrollgruppe.

Die ältere Remote-Migrationshistorie verwendet für `manual_food_source` und
`paywall_open_to_new_installs` andere Versionen als die gleichnamigen lokalen
Dateien; `G/metadata-budget-reconciliation.json` hält dies fest. Diese historischen
Dateien nicht nochmals ausführen und keinen pauschalen `db push` verwenden.

Das gezielt bereitgestellte Backendpaket ist in `G/narrow-deploy/manifest.json`
festgehalten: genau Zielprofil- und QA-Quellenmigration plus die geänderte
`bls-reference.mjs` im bestehenden `nutrition`-Gateway. Kombinierter lokaler
Dry-run und datenerhaltender Rückfall: **4/4 Gruppen bestanden**. Metadatenprüfung
meldet neun verbleibende freie iOS-Builds und 0 € erwartete Zusatzkosten; dies ist
keine verbrauchte Buildfreigabe und muss vor einem tatsächlichen Start aktuell
sein. Das Manifest beschreibt die Vorbereitung; die gesonderten oben genannten
Readback-Belege bestätigen die tatsächlich ausgeführte Bereitstellung.
Der danach separat bestätigte Rankingfix wurde ausschließlich als Änderung
von `bls-search.mjs` gegenüber Version 62 in Version 63 bereitgestellt und
vollständig zurückgelesen (`G/narrow-deploy-ranking/readback-proof.json`,
04.10.2026 15:47:28 UTC). Ein anfänglich fehlender lokaler Downloadordner wurde
korrigiert und nur der lesende Download wiederholt; kein zweites Deployment.

## Lokale Umsetzung und gezielte Prüfung

| Änderung | Implementiertes Verhalten | Aktuelle Prüfung / Grenze |
| --- | --- | --- |
| Persönlicher Plan | Sieben Onboarding-Schritte für Erwachsene mit Ab-/Zunahmeziel; optionale Wunschgewicht-/Datumsfelder, vorhandene Einheiten; Minderjährige/Erhalten ohne zusätzliche Zielgewichtsführung; keine Formeländerung | Gezielte Regressionen und unten dokumentierter DE-Browserweg; native DE/EN-Touch-/Wiederstartprüfung offen. Migration `20261004145027_add_optional_personal_goal.sql` remote rückgelesen |
| Trial/Paywall | Jahresvorauswahl nur bei tatsächlichem berechtigtem Sieben-Tage-Angebot; gleiche Produkte für A/B, manuelle Monatswahl bleibt. Abbruchhilfe ohne erneuten Kaufdialog; keine erfundene Trial-/Preis-/Kündigungszusage | `validate-trial-safety.mjs`: 9/9 Gruppen (`G/trial-final.log`), SDK-Grenzen simuliert. Kein echter StoreKit-Kauf daraus |
| Trialaktivierung | Erste Mahlzeit und tatsächliche drei Erfassungstage; Enderinnerung aus echter Ablaufzeit minus zwei Tagen, nur mit vorhandener OS-Erlaubnis. Laufzeitabbruch beendet aktive Rechte nicht vorzeitig; abgelaufene Karte verschwindet über Timer/Foreground-Abgleich | Echte Service-/Komponentenregressionen einschließlich Ablauf und Cleanup; native Benutzung separat offen |
| Pro-Wochenrückblick | Abgeschlossene lokale Siebentagesfenster; fehlende Tage fehlen, keine Nullaufnahme. Proteinvergleich erst bei mindestens drei erfassten Tagen je Fenster, ungerundete Summen und finale Rundung. Aktuelles Ziel ausdrücklich als aktuelles Ziel; Teens ausgeschlossen | `validate-weekly-review.mjs`: 7/7 Gruppen; keine erfundenen historischen Ziele oder Datentage |
| Erfassung | Enge BLS-Referenzen für Nudeln/Parmesan erhalten Zubereitung, Marke und Produktart. „Wie gestern“ nutzt echte gestrige Frühstückseinträge mit korrigierten Mengen und vorhandenen Speicherregeln | `validate-capture-staples-repeat.mjs`; tatsächliche native Such-/Savewege separat dokumentieren. Keine universelle Treffer- oder Fotozusage |
| Optionale RC-Messung | Eigener standardmäßig ausgeschalteter Kontoschalter auf Profil und Paywall. Drei feste Attribute; Widerruf/Retry, serialisierte SDK-Identität, stabile ursprüngliche Gruppe, keine Lebensmittel-/Körperdaten | `validate-revenuecat-experiment.mjs` und `validate-paywall-access.mjs` mit echten Modulen. SDK-Annahme ist kein Nachweis von Serverzustellung |
| RC-Herkunft/Frische | Nur verifizierte Apple-AppTransaction mit passender Bundle-ID und Production-Umgebung; Debug/Simulator/TestFlight/Sandbox/Unknown ausgeschlossen. Erst nach gesonderter Zustimmung; nur Herkunftskategorie an JS. Frische Live-Access-Antwort desselben Kontos erforderlich; Offlinecache darf Zugang bewahren, aber keine Messung erlauben | Sieben echte Swift-Policyzweige und `validate-revenuecat-native-origin.mjs`: exakter Device-StoreKit-Zweig für iOS 15.1 typegeprüft; iOS <16 ausgeschlossen. Keine Ausführung echter Apple-Verifikation bei diesem Compilercheck |
| Dauerhafter QA-Messausschluss | Migration `20261004150033_preserve_paywall_qa_measurement_source.sql`: bestehende QA-Quelle bleibt nach Ablauf erkennbar; nur aktiver QA-Eintrag darf Zugang überschreiben | `G/qa-source-postgres-proof.log`: 5/5 Gruppen, eigene lokale Clone-Datenbank, acht synthetische Fälle; Entitlements/Zuordnungen und funktionale Accessfelder unverändert. Exakte Funktionsdefinition inzwischen remote rückgelesen |

Details zu Einwilligung, Apple-Prüfung, ausstehender Löschung und Auswahlverzerrung:
[RevenueCat-Messvertrag](../REVENUECAT-EXPERIMENT-MEASUREMENT.md). Die Messkohorte
umfasst ausschließlich freiwillig zustimmende Teilnehmer mit belegbarer Herkunft.
Der vollständige ursprüngliche Servernenner bleibt für Intent-to-treat maßgeblich;
Abbrecher verschwinden daraus nicht. Fehlende Messung ist keine Nullaktivität.
Es gibt keine gemessene Aussage zur Umsatzüberlegenheit oder einen automatischen
Wechsel auf 100 % Hard Paywall.

`npm run typecheck` und die genannten fokussierten Prüfungen sind bestanden.
Der vollständige Verify-Lauf ist nach sämtlichen Funktionskorrekturen und der
letzten DE/EN-Erinnerungsformulierung mit **Exitcode 0** abgeschlossen, am
04.10.2026 um **15:41:38 UTC**; Companion **25/25**, Capture/Staples/Repeat **8/8**,
Trial-Safety **9/9**, Expo Doctor **18/18** und Webexport sind bestanden.
`G/verify-final-after-copy-result.json` hält den Abschluss fest;
Log-SHA-256 `6b2de851a504c93367b45e614db8a6553f51765d70b068fd90443c3f8767dd29`.
Dies ersetzt vorherige Fehler nicht rückwirkend: entdeckte Bedienfehler bleiben
als Befunde im Bericht. Ein früherer
Integrationslauf scheiterte an einem Test-Harness-Dateipfad für die neue
`WeeklyReviewCard.tsx`; dieser Fehler ist korrigiert und bleibt als vorheriger
Fehlnachweis erhalten.

`G/native-build-final-proof.json` bestätigt den vollständigen lokalen Debug-
Simulatorbuild von Host **Kandro** und Extension **KandroWidgets**, Exitcode 0,
einschließlich neuem `ExperimentOriginPolicy`-Helper. Der echte Device-StoreKit-
Zweig wurde zusätzlich separat typegeprüft. Diese Belege sind kein signiertes
Storeartefakt und keine Laufzeitprüfung von Apple-Verifikation oder Kauf.

Die native Bedienprüfung bleibt **NOT_STARTED**. `G/native-ui-blocker.json`
belegt hängenden Simulator-Systemstart vor Kandro, auch auf einem eigenen
Ersatzgerät. Bestehende QA-Daten wurden nicht gelöscht; fremde Simulatoren und
globale Dienste blieben unangetastet. Das belegt weder einen Appcrash noch einen
bestandenen App-Nutzerweg. Die folgenden Browserprüfungen ersetzen diese offene
native/physische Matrix nicht.

## Tatsächlich bediente Browserfälle

Die isolierte Browser-QA verwendet echte React-Produktkomponenten und lokale
Auth-/Access-/Store-Fixtures mit synthetischen Mahlzeiten. Keine Cloudoperation,
kein echter StoreKit-Kauf, keine Push-Systemanfrage und keine KI-Fotoerkennung
werden damit behauptet. Nachweise: `G/web-ui-observations.json`,
`G/web-goal-persisted.png`, `G/web-search-amounts-saved.png` und
`G/web-b-paywall-390.png`; finale EN-Nachtests stehen im selben Beobachtungsbeleg
vom 04.10.2026 um 15:47:58 UTC.

| Bedienfall | Tatsächlich beobachtet |
| --- | --- |
| Erstes DE-Onboarding | Sieben Schritte; ohne ausdrückliche Altersbestätigung bleibt Weiter gesperrt. Körpergewicht `78,5 kg`, Wunschgewicht `70,5 kg`; `2027-02-30` abgelehnt, `2027-02-28` angenommen und im Plan angezeigt |
| Reload und Planeditor | Körpergewicht, Wunschgewicht und Datum erhalten; bestätigtes Alter im nachträglichen Planeditor unveränderbar |
| Gestern-Frühstück | Genau ein Eintrag mit 300 kcal / 12 g Protein hinzugefügt; Wiederholungsaktion danach und nach Reload verschwunden |
| Suchen und Speichern | BLS E401032 ausdrücklich gewählt: 100,5 g Pasta ergeben 147 kcal; M306400 mit 3 g Parmesan ergibt 12 kcal. Zwei neue Einträge mit zusammen 159 kcal; keine externe Suche erforderlich |
| Gespeicherte Menge ändern | Pasta von 100,5 auf 100 g: 147 → 146 kcal; Tagessumme einschließlich Frühstück 459 → 458 kcal. Kein zusätzlicher Eintrag; nach Reload genau ein Eintrag je Lebensmittel |
| A/B-Paywall | B auf 390 px ohne X; Rechtsseite lässt sich öffnen und zurück führt wieder zu B. Freie EN-Paywall mit Close führt nach Heute. Lokale deklarierte Zugänge, kein Beweis tatsächlicher Serverrandomisierung |
| EN-Suche nach Reparatur | `pasta cooked` zeigt einfache eifreie gekochte Pasta mit 146 kcal zuerst; `whole wheat` liefert nur passende Vollkornreferenzen, 130 kcal. Tatsächlich im lokalen Browser bedient; `G/web-pasta-ranking-fixed-en.png` |
| EN-Onboarding nach finalem Sync | Sieben Schritte, ausdrückliche Altersbestätigung, US-Einheit; Wunschziel `155.4 lb` und `2027-02-28` im abschließenden Plan korrekt angezeigt |
| EN-Erinnerung nach Reparatur | Erstsetup erklärt genau eine tägliche Auswahl und markiert nur Dinner. Lunch wählen entfernt Dinner-Markierung; +15 Minuten ändert Lunch von 12:30 auf 12:45 und lässt es allein ausgewählt. Überspringen führt zum Today-Tutorial. `G/web-reminder-single-final-en.png`, `G/web-reminder-replaced-final-en.png`; keine OS-Berechtigungsprüfung im Browser |

Dabei wurden zwei echte Bedienprobleme entdeckt: Die allgemeine Suche nach
gekochter Pasta priorisierte Eiernudeln vor der einfachen Referenz, und die erste
Erinnerungseinrichtung zeigte zunächst zwei vorausgewählte Termine. Beide sind
lokal eng repariert und im erneuten vollständigen Verify geprüft. Die erste
bewusste Erinnerungsauswahl aktiviert nur den gewählten Termin; bestehende
Erinnerungspräferenzen bleiben erhalten. EN-Such- und Erinnerungsnachtest sind
oben tatsächlich beobachtet; die nachgelagerte Gateway-Bereitstellung des
Rankingfixes ist als Version 63 zurückgelesen. Native OS-Berechtigung, physischer
Touch-/Kaufweg und Fotoqualität bleiben davon getrennt offen.

## Modellbudget und belegbare Fotoqualität

Der aktuelle private Budgetstand vom 04.10.2026 15:07:32 UTC liegt in
`widgets-review/model-budget-current.json` unter dem bestehenden Erfassungsordner:

- Freigabe unverändert höchstens **112 Aufrufe und 10 €**, einschließlich Retries.
- Mindestens **70 bekannte Aufrufe**; höchstens **42 rechnerisch offene Aufrufe**.
  Das ist eine Unter-/Obergrenze aus den zulässigen eigenen Nachweisen, keine
  Behauptung einer vollständigen globalen Anbieterabrechnung.
- **3,50 € reserviert**, **6,50 € unreserviert**. Reservierung ist kein tatsächlicher
  Aufwand; tatsächliche Gesamtkosten/Hosted-Abrechnung sind nicht vollständig
  verfügbar. Vor weiteren bezahlten Aufrufen Nutzung, Preis und Rest erneut
  abgleichen; keine automatischen Wiederholungen oder neue Kostenfreigabe erfinden.
- Diese Folgearbeit verursachte **0 neue Modellaufrufe**. Gemini und KI-Suchhilfe
  bleiben aus; kein neuer Modellwechsel- oder Qualitätsnachweis.

`docs/accuracy-series.csv` enthält derzeit **0 gewogene reale Messfälle**.
Kommentarzeilen sind keine Datensätze. `G/real-photo-measurements.txt` und
`scripts/analyze-accuracy.mjs` dürfen daraus weder eine Genauigkeitsquote noch
einen bestandenen Qualitätsgate ableiten. Selbst erzeugte Fotos, geometrische
Negativbilder und unbekannt gewogene Beispielgerichte prüfen Übertragung,
Bildaufbereitung oder einzelne Klassifikationen; sie ersetzen keine reale
Portions-/Nährwertreferenz.

## Ausführbares Protokoll für 20–30 gewogene reale Mahlzeiten

Zielserie: **24 Mahlzeiten**, vorab festgelegte Fallliste, keine Auswahl nur
gelungener Ergebnisse. Je acht Fälle aus diesen Gruppen:

1. Einfache erkennbare Mahlzeiten mit getrennten Bestandteilen, einschließlich
   Reis/Nudeln/Kartoffeln, Ei/Milchprodukt und Fleisch oder vegetarischer Quelle.
2. Mischgerichte mit belegten Rezeptmengen; darunter gewogenes Öl, Sauce oder
   andere im Foto schwer erkennbare energiereiche Bestandteile.
3. Vier gleiche Gerichte in je zwei tatsächlich unterschiedlich gewogenen
   Portionen. Diese acht Portionen als gepaarte Fälle ausweisen, nicht als acht
   unabhängige Rezeptbeobachtungen. Größen und Bildorientierung vorher festlegen.

Die 24 Fälle über Hoch-/Querformat, hellere/dunklere normale Umgebungen und
unterschiedliche Teller verteilen. Mindestens vier Fotos zeigen relevante
Bestandteile am Bildrand; mindestens zwei einen klaren Vordergrundteller mit
Hintergrundgeschirr. Gleichwertige mehrere Mahlzeiten und Nicht-Essen können als
zusätzliche Negativkontrollen dienen, zählen aber nicht als gewogene Mahlzeiten.
Keine Gesichter/Adressen und keine fremden nicht freigegebenen Fotos verwenden.

Vor dem ersten Aufruf pro Fall erfassen:

- Stabile Fall-ID, Zutaten/Marken/Etikett und Zubereitung; rohe/gegarte Gewichte
  auseinanderhalten. Tara und tatsächlich essbare servierte Masse aufzeichnen.
- Bei Rezepten alle Zutaten sowie Gesamtgewicht und servierten Anteil wiegen.
  Ölaufnahme oder Verdunstung nicht als exakt gemessen behaupten, wenn nur eine
  Schätzung vorliegt. Diese Unsicherheit separat festhalten.
- Erwartete kcal/Protein/Fett aus bekannten Etiketten oder überprüften passenden
  Datenbankreferenzen berechnen. Nährwerte sind Referenzwerte, kein Labormesswert;
  Modellantworten dürfen die Referenz nicht liefern.
- Unverändertes Originalfoto und einen separaten vorbereiteten Uploadvergleich
  privat sichern. Fallliste, Referenzquelle und Build-/Backend-/Anbieterstand
  vor der Auswertung festhalten. Keine Lebensmittelbilder ins Repository kopieren.

Pro Mahlzeit zunächst genau einen Baseline-Fotoaufruf im eingefrorenen Kandidaten
ausführen. 24 Aufrufe passen nur nach bestätigtem tatsächlichen Rest in die
rechnerische Obergrenze von 42; ein Eurodeckel bleibt zusätzlich verbindlich.
Beschreibungstests, Negativkontrollen und Retests verbrauchen eigene Aufrufe und
werden nicht still dazugerechnet. Bei unbekannten Kosten oder fehlenden eigenen
realen Bildern bleibt dieser Schritt offen; das blockiert lokale Reparaturen nicht.

Vor jeder Korrektur Rohantwort, sichtbare Zutaten/Mengen, unaufgelöste Referenzen,
Warnungen, Ablehnung und Fehler notieren. Danach Nutzerkorrektur sowie genau
einmal Speichern, Bearbeiten und Kaltstart prüfen; korrigierte Ergebnisse nicht
als Baseline-Genauigkeit zählen. Jeden Fehler, Abbruch und Retry beim ursprünglichen
Fall behalten. Reparierte Fälle separat nachtesten statt den ersten Versuch zu
ersetzen. Nach Optimierung eine vorher zurückgehaltene Teilmenge einmal prüfen;
eine kleine Serie liefert weiterhin keine universelle Fehlerfreiheitszusage.

CSV mit vorhandenen Spalten ausfüllen (`matched`: `hit`, `wrong` oder `miss`);
fehlende Werte leer lassen, echte Nullwerte als `0`. Der vorhandene einfache
CSV-Leser erwartet Dezimalpunkte und keine Kommas in Textfeldern; detaillierte
Notizen privat separat ablegen. `node scripts/analyze-accuracy.mjs` berichtet
Trefferabdeckung sowie Gewichts-/kcal-/Protein-/Fettfehler mit tatsächlichen
Nennern und vorhandenen Werten. Unbekannte/fehlende Fälle dürfen nicht aus einer
scheinbar perfekten Erkennungsquote fallen. Bei dieser kleinen Serie zusätzlich
jeden relevanten Ausreißer und die Öl-/Mischgerichtgruppe einzeln bewerten.

Abnahme trennt Bildvollständigkeit, Identität, Referenz/Zubereitung, Portionsfehler,
Nährwertfehler und korrigierbaren Nutzerweg. Ein technisch unbeschnittener Upload
ist kein Portionsnachweis. Bedeutende unerklärte Fehler bleiben als offene
Produktgrenze sichtbar; vor der Serie keine unbelegte Erfolgsquote versprechen.

## Vorbereitete TestFlight-Texte für den nächsten Kandidaten

Diese Texte sind lokal vorbereitet und noch nicht veröffentlicht. Version,
Buildnummer, Apple-Build-ID und IPA-Hash werden erst nach dem konkret
freigegebenen zusätzlichen Build eingesetzt. Aktuell ist **1.0.3 (26)** intern
verfügbar; seine Installation liefert die neuen lokalen Funktionen noch nicht.
Ein Gerätebericht muss stets die tatsächlich installierte Nummer enthalten.

### What to Test — Deutsch

Bitte die ausdrücklich genannte Testversion als **Update** installieren, ohne
Kandro zu löschen oder auszulagern. Zuvor die geeignete Sicherung bestätigen und
vorhandene Tagesdaten/Einstellungen zum Vergleich festhalten. Normales Konto,
Alter und Abos nicht ändern, um die Hard Paywall zu erzwingen.

1. Bestehende Mahlzeiten/Einstellungen nach Update und Kaltstart vergleichen.
   Bei freiwilligem Planbearbeiten Wunschgewicht/-datum ändern, speichern und
   erneut öffnen; ein unmögliches Datum muss abgelehnt werden. Keine Änderung
   der Kalorienformel allein durch das Wunschdatum erwarten.
2. Unter Suchen gewöhnliche gekochte Nudeln und Parmesan wählen, eine genaue
   Grammmenge hinzufügen, einmal ändern und neu starten. Jeder Save soll genau
   einen Eintrag erzeugen; Mengenänderung soll den vorhandenen Eintrag ändern.
   „Wie gestern“ nur bei tatsächlich vorhandenem gestrigem Frühstück prüfen.
3. Beschreiben in DE/EN sowie ein eigenes freigegebenes Essensfoto und Barcode
   prüfen: Zutaten, Mengen, Zubereitung, fehlende Referenzen und Warnungen vor
   dem Speichern kontrollieren. Foto vollständig bis zu seinen Rändern anzeigen;
   Beschreibung ändern, Abbrechen, Korrektur und Kaltstart prüfen. Nährwerte sind
   Schätzungen; unbekannte Mengen dürfen nicht als gewogen dargestellt werden.
4. Mitteilungen im Onboarding bewusst überspringen/ablehnen oder einschalten:
   keine Systemfrage vor eigener Entscheidung, kein Absturz und keine zweite
   unbeabsichtigte Auswahl. Bestehende Erinnerungszeiten müssen erhalten bleiben.
   Homescreen-/Sperrbildschirm-Widgets und ihre Erfassungslinks prüfen.
5. Mit den getrennt bereitgestellten eigenen QA-Konten A und B testen:
   A darf die Paywall schließen und seinen bisherigen freien Umfang nutzen;
   B hat vor neuer Erfassung kein X. In B müssen Recht, Konto, Wiederherstellen
   und Einwilligungswiderruf erreichbar bleiben. Apples Kaufdialog abbrechen:
   zurück zur gleichen Paywall, kein automatischer Wiederholungsdialog.
6. Einen Apple-Sandbox-Trial nur bewusst selbst starten. Tatsächliches Angebot,
   sieben kostenlose Tage bei Berechtigung, hervorgehobenen Folgegesamtpreis,
   Restore und Ablauf prüfen; niemals einen echten bezahlten Kauf zum Test
   auslösen. Enderinnerung benötigt bereits erlaubte Mitteilungen und nutzt die
   tatsächliche Triallaufzeit. Die zusätzliche RC-Messzustimmung bleibt freiwillig
   und aus; TestFlight-/QA-Nutzung darf keine öffentliche Messkohorte erzeugen.

Bitte je Fehler Buildnummer, Sprache, genaue Eingabe/Schritte, erwartetes und
tatsächliches Verhalten nennen. Screenshots ohne Geheimnisse beifügen. Keine
API-Schlüssel, Passwörter, 2FA-Codes oder fremde Lebensmittelbilder versenden.

### What to Test — English

Install the specified test build as an **update**. Do not delete or offload
Kandro. Confirm an appropriate backup first and compare your existing daily
entries and settings afterwards. Keep your normal account, age and subscriptions
unchanged; separate QA accounts are provided for the two paywall variants.

1. Check existing entries/settings after the update and a cold restart. Edit
   an optional target weight/date, reopen the plan and check that an impossible
   date is rejected. The requested date does not change the nutrition formula.
2. Search for plain cooked pasta and Parmesan, add exact gram amounts, edit one
   saved amount and restart. Each save should add one entry; editing must update
   it. Test “Like yesterday” only when a real previous-day breakfast exists.
3. Check description entry in English/German, one authorized meal photo and a
   barcode. Review ingredients, amounts, preparation, missing references and
   warnings before saving. The entire photo must remain visible. Check returning
   to the description, cancelling, correcting and restarting. Nutrition remains
   an estimate; unknown amounts must not be presented as measured weights.
4. Deliberately skip, deny or enable onboarding reminders. No system prompt
   should appear before your choice, no crash should follow, and only the
   selected first reminder should be chosen. Existing reminder times must stay.
   Check Home Screen/Lock Screen widgets and their capture links.
5. In QA variant A, dismissing the paywall returns to the existing free scope.
   Variant B has no close button before new capture. Legal pages, account,
   restore and consent withdrawal remain reachable. Cancelling Apple's purchase
   sheet returns calmly to the same paywall without another automatic purchase.
6. Start an Apple sandbox trial only through your own deliberate action. Check
   actual eligibility, seven free days when offered, the full renewal price,
   restore and expiry. Do not make a real paid purchase for testing. Trial-end
   reminders require existing notification permission and use the actual expiry.
   Separate RevenueCat measurement consent is optional and off by default;
   TestFlight/QA sessions must not enter public experiment measurement.

Report the build number, language, exact input/steps and expected versus actual
result. Keep screenshots free of passwords, API keys, verification codes and
other people's photos.

## Vorbereitete App Review Notes und Freigabecheck

Die folgenden englischen Notes sind lokal vorbereitet. Vor Einreichung werden
das tatsächlich geprüfte finale Binary und die schon vorhandenen eigenen
QA-Zugangsdaten im privaten Apple-Reviewbereich eingetragen und auf Funktion/
Ablauf geprüft. Keine Zugangsdaten in diesem Repository, keine Erkennung von
Apple-Geräten und keine abweichende Fake-App für die Prüfung.

> Kandro estimates meal nutrition from user-entered descriptions, meal photos
> or selected food references. Users review and correct ingredients and amounts
> before saving. Nutrition is an estimate; the app does not provide medical
> diagnosis or guarantee photo accuracy. Photos and AI processing follow the
> separate in-app consent flow. The proposed Gemini and AI-search features remain
> disabled in this candidate.
>
> The app contains two versions of the same subscription access screen. The
> dedicated QA A account opens the soft paywall: closing it returns to the
> existing free features and any remaining shared introductory analyses. The
> dedicated QA B account opens the hard paywall before new regular capture, with
> no close-to-free action. Both use the same Store products and renewal prices.
> Account access, legal pages, consent withdrawal/deletion, subscription
> management, restore and previously saved records remain reachable. Cancelling
> Apple's purchase sheet returns to the same paywall and never repeats purchase
> automatically. Active verified subscription rights take precedence in both.
>
> The public experiment is disabled before the separately approved public
> release. Future public enrollment is limited to verified, voluntarily linked
> new adults with no previous account/use history and positive eligibility for
> the configured seven-day trial. Anonymous, existing, returning, underage and
> unclear identities retain the existing free scope. Assignment is stored once
> on the server and does not reroll on login, restore or subscription changes.
> The two disclosed QA accounts select the real variants without fabricating
> Apple purchase rights and are excluded from public measurement.
>
> Monthly and annual introductory offers are seven days only for users Apple
> considers eligible. Ineligible or unavailable offers must not show a free-trial
> promise. The full renewal price comes from StoreKit; the app rechecks the offer
> before purchase. An annual default is used only when its actual eligible
> seven-day offer is returned. Trial reminders use the confirmed expiration and
> require existing notification permission. Short sandbox trial times may leave
> no valid two-days-before reminder to schedule.
>
> Optional RevenueCat experiment measurement has its own default-off consent,
> available in the profile and on the paywall. It adds only fixed experiment,
> original variant and consent-version attributes to the existing subscription
> customer; it does not export meals, photos, text or body data. After consent,
> Apple's verified AppTransaction may check installation origin. QA, sandbox,
> TestFlight and unknown origins do not enable export. This filter never grants
> or removes app access. Consent can be withdrawn independently of purchase.
>
> Widgets use the existing local App Group snapshot and approved capture links.
> Lock Screen widgets do not expose nutrition totals. Reminder permission is
> optional and requested only following an explicit user decision. Optional
> target weight/date are user wishes and do not introduce new nutrition formulas.

Vor Freigabe zwingend ergänzen/prüfen:

- Finale Version/Buildnummer, EAS-ID, Apple-Build-ID, signierter IPA-Hash und
  Quellmanifest; Host/Extension, App Group, Privacy-Manifeste und fehlende QA-Reste.
- Tatsächliche physische Upgrade-, Capture-, Widget-, Benachrichtigungs- und
  StoreKit-/Restorefälle; Fehlfälle mit Gegenprobe statt pauschalem „alles geprüft“.
- Aktuelle Review-Anmeldung beider erlaubten QA-Konten, notwendige Verbindung,
  funktionsfähige Rechts-/Supportlinks und übereinstimmende Privacy-/IAP-Metadaten.
- Abschließendes Backend-/Store-/Kostenreadback passend zu genau diesem Binary.
  API-Angebotskonfiguration ersetzt keine geladene Geräte-StoreKit-Antwort.

Die drei eng bekannten eigenen QA-Konten wurden nur lesend auf weitere Nutzung
geprüft (`G/qa-cleanup/cleanup-plan.json`). Die beiden A/B-Konten werden noch für
Review-/Gerätetests gebraucht; das dritte ist noch im anderen Simulator aktiv.
Deshalb **keine Löschung**. Die Zustimmung zu einem späteren Aufräumen erlaubt
weder eine breite Kontensuche noch das Unterbrechen des anderen Clients.

Sechs Website-Seiten sind lokal aktualisiert: DE/EN Datenschutz, Bedingungen und
Quellen. In dieser Folgearbeit ist noch keine davon veröffentlicht. Die ältere
ausdrückliche 0-€-Freigabe nennt nur die vier Rechtstexte; zwei Sources-Seiten
werden daraus nicht stillschweigend mitveröffentlicht.

## Bestehende Autorisierung und nächste Gates

Der aktuelle Nutzerauftrag übernimmt die konkreten Verbesserungen des Handoffs;
dessen Empfehlungen und frühere Erfolgsaussagen sind keine Nachweise. Der
bindende Auftrag `KANDRO-CODEX-HARDPAYWALL-WIDGETS-TESTFLIGHT.txt`, insbesondere
Abschnitte 2, 5 und 10–12, und spätere ausdrückliche Nutzerentscheidungen bleiben
maßgeblich. Die konservative Wiederherstellung wurde zusätzlich ausdrücklich
bestätigt und ist oben bereits als ausgeführt belegt.

- Bereits gedeckt: lokale Umsetzung und unabhängige Tests; enges Lesen eigener
  Verwaltungsmetadaten; notwendige geprüfte additive Erfassungs-/Experiment-
  Backendänderungen am bestätigten Projekt; vorhandene kostenlose Signierungs-
  korrekturen ohne Zertifikatswiderruf; bestehender begrenzter KI-Testzweck.
- Der angenommene neue Auftrag nennt den Sieben-Tage-Jahres-Trial ausdrücklich.
  Die oben erfolgreich rückgelesene Konfiguration erhält Produkt, Abogruppe und
  reguläre Preise; Auswirkungen auf alle Apple-berechtigten Jahreskäufer sind benannt.
  Kein konkurrierendes Angebot überschreiben und keine neue Rabattvariante
  aus der bloßen Win-back-Beispielidee ableiten. Preis, Dauer, Berechtigung und
  Umfang eines solchen Angebots sind noch nicht entschieden.
- Die optionalen Profilfelder wurden als enges geprüftes Backendpaket
  bereitgestellt; die aktualisierten Website-Rechtstexte sind weiterhin lokal.
  Die frühere Websitefreigabe betraf vier bestimmte Rechtstexte für 0 € und ist
  keine pauschale Erlaubnis für andere Websiteveröffentlichungen.
- Ein weiterer Storebuild benötigt nach Abschnitt 11 die konkrete zusätzliche
  Freigabe für das eingefrorene Binary. Vorher vollständiges lokales Gate,
  Quellmanifest und nötige Backend-/Rechtsvoraussetzungen abschließen. Danach
  frische 0-€-/Signierungsprüfung, genau ein Build, tatsächliche IPA-Prüfung und
  genau ein interner Upload. Kein automatischer Retry oder Auto-Submit.
- Bestehendes Nutzerkonto/Abos/Daten erhalten. Physischer Test als Upgrade ohne
  Deinstallation/Offloading nach geeigneter Sicherung. A/B mit identifizierten
  eigenen QA-Konten, Sandbox-Kauf bewusst durch den Eigentümer. Historische
  Handoff-Ratschläge zum Löschen der App oder pauschalen Aufräumen überschreiben
  diesen Schutz nicht; keine breite Kontenlöschung.
- Vor Review fehlen weiterhin tatsächliche Gerätepflichtfälle, konsistente
  Metadaten/Privacy-/Trialangaben und ein genau benanntes finales Artefakt. Erst
  `REVIEW FREIGEBEN: X (Y)` erlaubt dessen einmalige Einreichung. Ein allgemeines
  „Ja“ zu einer anderen Arbeit ist keine Reviewfreigabe. Kundenveröffentlichung
  bleibt manuell und gesondert bestätigt; der öffentliche A/B-Schalter bleibt
  bis dahin aus. Keine automatische Vollumstellung nach einer Wartefrist.

Die lokalen und gezielt freigegebenen Backendarbeiten sind damit für den
anschließenden Quellfreeze dokumentiert. Offen bleiben das konkret abgegrenzte
Websitepaket, die zusätzliche Buildfreigabe, das tatsächliche neue Storeartefakt
und die physischen/native Pflichtfälle. Win-back bleibt ohne entschiedene
Rabattbedingungen aus. Es gibt noch keine Aufforderung zur Reviewfreigabe;
Build 26 ist kein Ersatznachweis für die neuen lokalen Funktionen.


## Endgültiger Quellkandidat und Abschlussprüfung

Der tatsächliche EAS-Uploadkontext wurde lokal mit `build:inspect --stage archive`
erstellt, ohne Cloudbuild oder Upload: `G/store-upload-reviewed`, **391 Dateien**,
alle einschließlich uncommitteter Quellen bytegleich zur Arbeitskopie; zusätzlich
unabhängig nachgelesen. Kanonischer Dateimanifest-SHA-256:
`241e916f9fbabd80b5f85acf1ca8127e25fd8cdec98f43d60c9e1c9c4050c2e4`.
Archiv-SHA-256: `d5781f36e57e2b0ae31eac875124ded0fd3146fec9e2e6dcc970b9fe25a2e9a8`.
Zusammenfassung: `G/final-source-candidate.json`; vollständiges Manifest:
`G/store-upload-reviewed-manifest.json`. Kein Git-Commit oder Push ausgeführt.

Beim abschließenden Paketabgleich wurde genau der veraltete Aboabsatz in
`store.config.json` in DE/EN korrigiert: der eingerichtete Jahres-Trial bleibt
an tatsächlich vorhandenes Angebot und persönliche Apple-Berechtigung gebunden;
der volle Folgejahrespreis wird einmal jährlich berechnet. Alle übrigen Felder
und Absätze blieben unverändert. Keine Veröffentlichung der Storetexte und keine
weitere Preis-/Angebotsmutation. Regression rot→grün und Produktionskonfigurations-
prüfung bestanden (`G/store-metadata-fix-proof.json`).

Danach nochmals vollständiges **`npm run verify`, Exit 0**, Expo Doctor 18/18
und Webexport: `G/verify-final-store-metadata-result.json`, Log-SHA-256
`6f698d7fbc462d99e88b350b28e2615d0cf2591fa3622120bd02f415af452265`.
Die vorherigen Produkt-/Browser-/Compilerbelege gelten weiter, da der letzte
Schritt ausschließlich Storemetadaten und deren Regression geändert hat.

Frisch zurückgelesen: EAS **6/15 iOS-Builds genutzt, neun frei, 0 Zusatzkosten**,
Remote-Buildnummer **26**; beide bestehenden Host-/Widgetprofile ACTIVE, gültig
bis 04.09.2027. Build26 weiterhin VALID/IN_BETA_TESTING in der korrekten internen
Gruppe für den eindeutig bestehenden Tester. Nachweise: `G/eas-usage-final.json`,
`G/eas-version-final.json`, `G/narrow-deploy/apple-build26-signing.json`.
Ein nächster Build wäre voraussichtlich **1.0.3 (27)**; die Nummer wird erst beim
freigegebenen Start aktuell geprüft und vergeben. Es wurde keiner gestartet.

Konkret noch freizugeben sind genau **ein zusätzlicher Storebuild und ein interner
Upload dieses Kandidaten ausschließlich bei 0 EUR Zusatzkosten**, ohne Auto-Submit,
sowie bei gewünschtem Websiteabgleich ausschließlich diese sechs vorhandenen
Seiten: `/privacy/`, `/terms/`, `/sources/`, `/en/privacy/`, `/en/terms/`,
`/en/sources/`. Der zusätzliche Build dient auch den offenen echten Gerätetests;
nativer Simulatorstart, Pushdialog, StoreKit-/Restorelauf und reale gewogene
Fotoqualität wurden nicht als bestanden ausgegeben. Einverständnis mit dem
Build ersetzt weder den Eigentümertest noch die spätere exakte Reviewfreigabe.
