# Kandro – Masteraudit Produkt, Erfassung, Retention und Abo-Conversion

Stand 04.10.2026. Grundlage: `KANDRO-CLAUDE-MASTERAUDIT.md`. Erstellt in der lokalen Arbeitskopie, keine produktiven Änderungen, Kosten oder Veröffentlichungen durch diesen Auftrag.

## 0. Materialinventar und Belegklassen

| Quelle | Stand | Status |
|---|---|---|
| Repository `/Users/hewaddorani/Developer/Kandro-recovery-20260906` | Branch `audit/app-store-release-gate-20260904`, HEAD `633d688`, 176 uncommittete Einträge | gelesen |
| `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` | bis 04.10. | gelesen |
| `docs/qa/ERFASSUNG-GEMINI-2026-10-01.md` (aktualisiert 04.10.) | TestFlight 1.0.3 (24), `nutrition` 60 | **dokumentiert**, nicht selbst live geprüft |
| Quellmodule Erfassung, Paywall, Zugang, Sync, Reminder, Widgets (`widgets/ios/KandroWidgets.swift`) | aktuelle Arbeitskopie | im Code belegt |
| Lokale Web-Version (Expo-Export ohne Backend, 390×844) | 04.10. | **direkt beobachtet**: Onboarding, Heute, Plan, Verlauf, Profil, Suche, Mengenwahl, Selbst eintragen, Beschreibung, Speichern |
| `npm run verify` (alle Prüfskripte, Expo Doctor, Web-Export) | 04.10., Exit 0 | reproduziert (lokale Adapter, keine echten Dienste) |
| Store-Screenshots `app-store/screenshots/{de-DE,en-US}` | Repo | gesichtet (01, 02) |
| App-Store-Seiten YAZIO und MyFitnessPal (DE), Apple Review Guidelines | abgerufen 04.10.2026 | öffentliche Primärquelle, per Zusammenfassung ausgelesen (Werte vor Verwendung in Marketingtexten selbst nachprüfen) |

Belegklassen wie im Auftrag: **beobachtet**, **reproduziert**, **Code**, **dokumentiert**, **Hypothese**, **offen**.

### Gebündelte Materialanfrage (einmalig)

1. **App Store Connect / RevenueCat Export:** Downloads, Paywall-Impressionen, Trialstarts, erste Zahlungen, Verlängerungen, Erstattungen je Woche seit 16.09.; aktuelle Produkt-IDs, Preise je Storefront, Trial-Konfiguration.
2. **PostHog-Funnel** (nur Opt-in-Population): Onboarding-Schritte, erste gespeicherte Mahlzeit, D1/D7-Rückkehr mit Erfassung.
3. **Crash-/Fehlerdaten** (Xcode Organizer / TestFlight-Feedback) und Supportfälle/Bewertungstexte.
4. **Produktionsstand Backend:** `supabase migration list --linked` und aktive `nutrition`-Version (nur lesend, durch dich ausgeführt oder freigegeben).
5. **Echte Fotos mit gewogenen Mengen** (20–30 Alltagsmahlzeiten) für eine Fotoqualitätsprüfung; Freigabe der Modellkosten.
6. **Geräte-Ergebnisse TestFlight 24** (Upgrade ohne Deinstallation, Kamera, Widget, Kauf/Restore in der Sandbox).

Ohne diese Daten bleiben alle Aussagen zu Conversion, Retention, Fotogenauigkeit und Live-Konfiguration **offen**. Nichts davon wird unten als gemessen dargestellt.

---

## A. Unternehmerisches Urteil

**Was wirklich gut ist (erhalten):**
1. Ehrliche, korrigierbare Schätzung: Zutaten einzeln, Quelle sichtbar, Unsicherheit benannt (Code + beobachtet).
2. Datenintegrität: atomarer Meal-Sync, Tombstones, Kontowechsel-Schutz, Einwilligungs- und Altersgrenzen (Code, durch umfangreiche Prüfskripte reproduziert).
3. Kostenlose Grundroutine (Suche, Barcode, Tagesbilanz, Plan, Verlauf) mit geprüfter BLS-4.0-Datenbasis in DE/EN.
4. „Was passt als Nächstes“ (Plan mit drei Situationen) – eine echte Differenzierung gegenüber reinen Tagebüchern.
5. Ruhiges, konsistentes Designsystem (Ivory/Moos/Pistazie), gute Lesbarkeit (beobachtet).

**Was heute am ehesten Vertrauen, Wiederkehr oder Zahlungsbereitschaft zerstört:**
1. **Pro verkauft fast nur „mehr KI-Analysen“** (Code: `paywall.benefit1/2`, `browseHeadline`). Wer Suche und Barcode nutzt, hat keinen Grund zu zahlen; wer Fotos liebt, zahlt für ein Kontingent, nicht für einen anhaltenden Alltagsvorteil. Das ist der zentrale wirtschaftliche Engpass.
2. **Erfassungsreibung im Alltag** (vor den lokalen Änderungen dieses Tages beobachtet): leere Suche ohne „Zuletzt“, doppelte Bestätigung nach Mengenwahl, Beschreibungen scheitern komplett an einer unklaren Menge, ml nur für Milch, „2 Toast“ unaufgelöst. Teilweise heute lokal behoben (siehe B.3), nicht ausgeliefert.
3. **Langer Weg bis zum ersten Nutzen:** 11 Onboarding-Schritte → Einwilligung → Erinnerungen → Zugangsscreen → 5-teilige Tour → erst dann die erste Mahlzeit (beobachtet). Kein Zielgewicht, kein Zieldatum, also kein emotionaler Plan-Moment.
4. **Release-Disziplin:** 176 uncommittete Dateien, Builds nicht aus Git reproduzierbar; lokale Exporte laden unbemerkt Produktionskonfiguration (heute reproduziert, F01).

**Drei Entscheidungen mit Vorrang:**
1. **Erfassungs-Release zuerst ausliefern** (Sofort-Suche, direkt hinzufügen, lokale Beschreibung, Selbst eintragen, tolerante Mengen), bevor Reichweite eingekauft wird. Ohne verlässliche Erfassung verbessert keine Paywall die Verlängerung.
2. **Pro neu definieren als anhaltenden Nutzen** („Kandro passt deinen Plan jede Woche an und erfasst für dich“) statt Kontingent – ohne kostenlose Routine zu verschlechtern (E).
3. **Den Paywall-Test-Umfang verbindlich festlegen** (F02): Der Masterprompt verlangt „nur freiwillig verknüpfte neue Erwachsene“, die lokale Arbeitskopie enthält seit heute auf deinen früheren Wunsch die Öffnung für alle Neuinstallationen. Eine Version muss vor jedem Deploy gestrichen werden.

**Unbekannt:** echte Conversion/Retention, Live-Preise, Fotogenauigkeit, aktueller Produktionsstand der Migrationen, Crashrate.

---

## B. Ist-Zustand und Funnel

### B.1 Versionen und Widersprüche

| Quelle | Aussage | Konflikt |
|---|---|---|
| Nutzerangabe | App veröffentlicht 16.09.2026 | ROADMAP: Build 1.0.0 (16) am 06.09. „Waiting for Review“ – Veröffentlichung nicht im Repo belegt |
| Vorgespräch | 1.0.2 (19) am 26.09. zur Review eingereicht | kein Ergebnis im Repo dokumentiert |
| ERFASSUNG-Bericht 04.10. | TestFlight 1.0.3 (24) intern, `nutrition` 60 | Abschnitt weiter unten im selben Bericht nennt `nutrition` 53/56 als frühere Stände – maßgeblich ist der neueste Abschnitt |
| ERFASSUNG-Bericht | „Öffentlicher Experimentstart AUS“ | konsistent mit Code (`public_enabled default false`) |

→ Welche Version heute im Store ist, ist **offen** (Materialanfrage 1).

### B.2 Abdeckungsmatrix

| Pfad | DE | EN | Große Schrift | Kleines iPhone | Gratis | Pro | A | B | Bestand |
|---|---|---|---|---|---|---|---|---|---|
| Onboarding | beobachtet (Web) | offen | offen | offen | beobachtet | – | offen | offen | – |
| Suche → Menge → Speichern | beobachtet (Web, lokal) | Code+Test | offen | offen | beobachtet | offen | offen | offen | offen |
| Beschreibung lokal | beobachtet (Web) | Test | offen | offen | beobachtet | – | – | – | – |
| Beschreibung KI | dokumentiert | dokumentiert | offen | offen | offen | offen | offen | offen | offen |
| Foto | dokumentiert | dokumentiert | offen | offen | offen | offen | offen | offen | offen |
| Barcode | Code | Code | offen | offen | offen | – | – | – | – |
| Kauf/Restore | Code+Tests | Code | dokumentiert (Dynamic Type) | offen | – | offen | offen | offen | offen |
| Widgets | Code | Code | offen | offen | – | – | – | – | – |
| Upgrade ohne Deinstallation | offen | offen | – | – | – | – | – | – | offen |

### B.3 Heute lokal umgesetzt (nicht deployt, nicht gebaut)

| Änderung | Dateien | Beleg |
|---|---|---|
| Sofort-Vorschläge beim Tippen, offline, Alltagsfoods zuerst, Tippfehler/Plural, Synonyme, Server-Katalogranking mit eingebunden | `src/services/foodSuggest.ts`, `scan.tsx` | reproduziert (`validate-instant-logging`, 8 Fälle) + beobachtet |
| „Zuletzt gegessen“ mit letzter Menge im leeren Suchfeld | `foodSuggest.ts`, `scan.tsx` | beobachtet |
| Direkt hinzufügen ohne zweite Bestätigung, Suche bleibt offen, Quittung, „Fertig“ | `AppContext.logFoodDirect`, `scan.tsx` | beobachtet |
| „Selbst eintragen“ für unbekannte Lebensmittel (Quelle `manual`) | `ManualFoodForm.tsx`, Migration `20261004130000` | beobachtet; **Migration nötig vor Sync** |
| Lokale Beschreibung („2 Toast und 300 ml Milch“) ohne KI-Kosten, strenge Rückfalllogik | `src/services/localDescription.ts` | reproduziert + beobachtet |
| Tolerante Mengen in der KI-Beschreibung, Getränke in ml/l, Toast-Aliase | `_shared/description-amounts.mjs`, `bls-reference.mjs`, `bls-search.mjs` | reproduziert; **Gateway-Deploy nötig** |
| Ein-Tipp-Vorschlag für unaufgelöste Zutaten | `confirm.tsx` | Code |
| Mahlzeiten-Erinnerungen zum Antippen | `reminders.ts`, `ReminderPreferences.tsx` | beobachtet |
| Demo-Mahlzeit wird nicht gespeichert | `result.tsx` | Code + Test |
| Paywall-Zuordnung für alle Neuinstallationen | Migration `20261004120000`, `access-setup.tsx` | **im Konflikt mit Masterprompt, siehe F02** |

### B.4 Größter Engpass zwischen Versprechen und erster Mahlzeit

Beobachtet: Bis zur ersten gespeicherten Mahlzeit vergehen mindestens 11 Onboarding-Schritte, 1 Einwilligung, 1 Erinnerungsscreen, 1 Zugangsscreen (bei Experimentteilnahme zusätzlich die Paywall) und eine 5-teilige Tour. Der Store verspricht „Foto. Prüfen. Weiter.“; das erste Foto ist frühestens nach rund 15 Interaktionen möglich. Bei Variante B steht davor zusätzlich die harte Paywall, also **Zahlungsentscheidung vor jedem erlebten Nutzen**. Das ist ein anderer Funnel als A (drei kostenlose Analysen) und darf nicht nur an Trialstarts gemessen werden.

---

## C. Wichtigste Befunde

Schwere: P0 = Sicherheit/Daten/Entscheidung vor Release, P1 = hoher Nutzer-/Geschäftseffekt, P2 = deutlich, P3 = klein.

| ID | Schwere | Gruppe | Szenario / Beleg | Ursache | Auswirkung | Änderung | Abnahme | Abh. |
|---|---|---|---|---|---|---|---|---|
| F01 | P0 | Betrieb | Lokaler Web-Export enthielt `omtmxqzwxvthycyfkggv.supabase.co`; Testbrowser hatte eine Produktionssitzung `sb-…-auth-token` (**reproduziert** 04.10.) | Expo lädt `.env.local` trotz `EXPO_NO_DOTENV=1` | Lokale Tests legen anonyme Produktionskonten an, schreiben Einwilligung/Profil, verfälschen Kennzahlen | Exportskript `npm run export:offline`, das alle `EXPO_PUBLIC_*`-Backendwerte leert und das Bundle per grep prüft; QA nie gegen `.env.local` | Bundle enthält keine Projekt-ID; Prüfskript im Verify | – |
| F02 | P0 | Neue Nutzer, anonyme | Masterprompt: nur freiwillig verknüpfte Erwachsene; Arbeitskopie: alle Neuinstallationen, automatische Zuordnung (**Code**) | Zwei widersprüchliche Eigentümervorgaben | Rechtstexte 1.9, Migration und Code beschreiben die Öffnung | Entscheidung festhalten; bei Masterprompt-Linie: Migration `20261004120000` verwerfen, `access-setup.tsx` und Rechtstexte zurück auf 1.8 | Prüfskript `validate-legal-access-copy` + Beta-24-Test passend zur Entscheidung | Eigentümer |
| F03 | P1 | Alle | Paywall-Nutzen = „weitere Foto- und Textanalysen, bis 60/Tag“ (**Code**, `de.ts` paywall) | Pro als Kontingent definiert | Schwacher Wiederholungsgrund, Kündigung nach Gewöhnung an Suche | Pro als Bündel aus fortlaufendem Nutzen (E.2) | Paywall-Copy-Review, Kohorten-Verlängerung | F07 |
| F04 | P1 | Alle | Leeres Suchfeld, Liste springt beim Tippen, Marken nur nach Return (**beobachtet/Code**, vor heute) | Server-only-Suche mit Debounce | Erfassung dauert, Abbruch | Sofort-Suche + Zuletzt (B.3) | `validate-instant-logging` grün; Web-Ablauf | Build |
| F05 | P1 | Alle | Nach Mengenwahl erneut „Passt das?“ (**beobachtet**, vor heute) | Such-Ergebnis lief durch Foto-Bestätigungsweg | 2 zusätzliche Taps pro Lebensmittel | Direkt hinzufügen (B.3) | Beobachtet: Banane in 3 Taps gespeichert | Build |
| F06 | P1 | Alle | „100 g Reis mit Hähnchen“, „200 ml Öl“ → 422 Fehler, ganze Beschreibung verworfen (**Code**, vor heute) | strikte Mengenbindung | Frust beim Kernversprechen „beschreiben“ | Tolerante Bindung + lokale Beschreibung | Prüfskripte grün; KI-Pfad nach Deploy auf Gerät | Gateway-Deploy |
| F07 | P1 | Neue Nutzer | 11 Schritte + 4 Zwischenscreens vor erster Mahlzeit; kein Zielgewicht/-datum; Alter per Stepper + Bestätigungshaken (**beobachtet**) | Onboarding ist Datenerhebung, kein Wertmoment | Abbruch vor erstem Nutzen; schwacher Plan-Moment vor Paywall | Onboarding 7 Schritte, Zielgewicht + Datum, Tour streichen (D.2) | Zeit bis erste Mahlzeit < 90 s im Test | – |
| F08 | P1 | Betrieb | 176 uncommittete Dateien, Build nicht aus Git rekonstruierbar (**reproduziert** `git status`) | Arbeit ohne Commits | Regressionen nicht rückverfolgbar, Review-Risiko | Release-Branch mit Commits je Paket, Tag pro Store-Build | Jeder Build hat Commit-Hash im Bericht | – |
| F09 | P2 | Alle | Demo-Mahlzeit wurde als echte Mahlzeit gespeichert (**Code**) | Ergebnis speichert beim Öffnen | Falsche Tagesbilanz | behoben (B.3) | Test grün | Build |
| F10 | P2 | Neue Nutzer | Store-Screenshot 1: „Muskeln aufbauen. Leaner werden.“ (**gesichtet**); Onboarding-Standard ist „Gewicht reduzieren“ | Positionierung uneinheitlich | Erwartungslücke zur Hauptzielgruppe | Screenshot 1 auf Hauptnutzen „In Sekunden erfasst, dein Tag passt sich an“ | Store-Listing-Review | Marketing (deins) |
| F11 | P2 | Alle | Badge „Hohe Sicherheit“ auf KI-Ergebnis (Screenshot 02) | Modelllabel ohne Kalibrierung | Scheinpräzision (Auftrag 6.3) | „Gut erkennbar“ / „Bitte prüfen“ statt Sicherheitsstufe | Copy-Review | – |
| F12 | P2 | Alle | Verlauf: Protein-Wochenbalken, viel Erklärtext, keine Kalorienwoche, kein Ziel (**beobachtet**); Gewicht nur lokal (dokumentiert) | Verlauf als Datenansicht | Kein Fortschrittsgefühl, kein Grund für Woche 2–4 | Verlauf neu (D.5) | Nutzerstudie, D7 | – |
| F13 | P2 | B-Nutzer | Harte Paywall vor jeder Erfassung ohne erlebte Mahlzeit (**Code**) | Testdesign | Hohe Abbruchrate; Trialstarts ohne Gewohnheit | B-Variante: eine kostenlose Mahlzeit vor der harten Paywall prüfen (eigener späterer Test) | Vorher definierter Test | F02 |
| F14 | P2 | Pro-Kandidaten | Rechtliche KI-Route für Nutzer ab 14 (Google/Vertex-Bedingungen) laut Bericht ungeklärt (**dokumentiert**) | Anbieterbedingungen | Modellwechsel blockiert | Keine neue Route ohne schriftliche Klärung | – | Recht |
| F15 | P3 | Alle | Widget: Proteinlabel als fester Text `"g Protein"`, Konfigurationsnamen Englisch im Swift-Code (**Code**) | Lokalisierung über Strings-Dateien unvollständig? | Gemischte Sprache im Widget (Hypothese) | In `de.lproj` prüfen/ergänzen | Widget-Galerie DE zeigt Deutsch | Build |
| F16 | P3 | Alle | Sync-Karte „Änderungen auf diesem Gerät gespeichert“ erscheint auch ohne Cloudkonfiguration (beobachtet, nur Dev) | Status ohne Konfigurationsprüfung | Nur Entwicklung | `isSupabaseConfigured` prüfen | – | – |
| F17 | P3 | Alle | Lokale Vorschläge kennen keine Marken (Milka, Nutella) (**reproduziert**) | Absicht: keine erfundene Markenidentität | Marken erst nach Pause per Netz | Bleibt so; Anzeige „Marken werden gesucht…“ | – | – |

Bereits früher behobene Befunde (nur Regression geprüft, grün im Verify): Portion-Faktor-Grenze (Migration `20260926221131`), automatische Freigabe im Store-Config (`automaticRelease: false`), Versionsnummern konsistent 1.0.3.

---

## D. Fünf ausformulierte Verbesserungen

### D.1 Sofort-Erfassung (heute lokal umgesetzt – ausliefern)
- **Ablauf alt:** Suche öffnen → tippen → 350 ms warten → Server → Treffer → Menge → „Passt das?“ → Ergebnis → zurück.
- **Ablauf neu:** Suche öffnen → „Zuletzt gegessen“ sofort sichtbar → Tippen zeigt ab 2 Zeichen lokale Treffer ohne Netz → Menge (typische Portion vorausgewählt) → „Hinzufügen“ → Quittung „✓ Banane roh · 120 g · 95 kcal“, Suche bleibt offen → „Fertig“.
- **Leer/Fehler:** offline zeigt lokale Treffer ohne Fehlermeldung; keine Treffer → „„X“ selbst eintragen“. Netzfehler nur, wenn auch lokal nichts passt.
- **Invarianten:** lokale Werte sind exakt die BLS-Werte des Gateways; Marken werden nie lokal erfunden; eigene Einträge tragen die Quelle „Eigene Angabe“.
- **Tests:** `validate-instant-logging.mjs`, `validate-beta24-feedback.mjs`.

### D.2 Onboarding mit Wertmoment (nicht umgesetzt)
- **Neu, 7 Schritte:** Ziel → Zielgewicht (nur bei Ab-/Zunehmen) → Geschlecht → Geburtsjahr (Zahlenfeld, keine Bestätigungscheckbox) → Größe/Gewicht auf einem Screen → Aktivität → Plan.
- **Plan-Screen:** „Dein Plan: 1.750 kcal und 140 g Protein am Tag. Bei diesem Tempo erreichst du 72 kg etwa im Februar.“ Darunter klein: „Schätzung, keine Garantie.“ Rechtliche Hinweise in ein „Wie wird das berechnet?“-Detail.
- **Danach direkt:** „Trag jetzt dein erstes Essen ein“ (Suche/Foto) statt 5-teiliger Tour. Erinnerungsfrage erst **nach** der ersten gespeicherten Mahlzeit („Soll ich dich morgen ans Mittagessen erinnern?“).
- **Invarianten:** Minderjährigenlogik (kein Tempo-Schritt, kein Ziel-Offset), Einwilligung vor jeder Verarbeitung bleiben unverändert. Zieldatum bei Jugendlichen nicht anzeigen.
- **Abnahme:** Median Zeit bis erste gespeicherte Mahlzeit im moderierten Test < 90 s; keine Einwilligung übersprungen.

### D.3 Pro mit anhaltendem Nutzen (Spezifikation, E.2)

### D.4 Rückkehrschleife Tag 0–30 (teilweise umgesetzt)
- **Tag 0:** erste Mahlzeit, Erinnerung zur nächsten Mahlzeit anbieten.
- **Tag 1:** Erinnerung öffnet Kamera bzw. „Zuletzt gegessen“; „Wie gestern“ pro Mahlzeit-Slot auf Heute (fehlt noch: ein Tipp kopiert das gestrige Frühstück).
- **Tag 3:** Bewertungsanfrage frühestens nach 5 Mahlzeiten an 3 Tagen und 72 h (bestehend, Hypothese).
- **Tag 7:** Wochenrückblick (Kalorienschnitt, Protein-Tage im Ziel, Gewichtstrend) als Pro-Kern.
- **Tag 30:** Planvorschlag „Ziel anpassen?“ auf Basis Gewichtstrend (Pro).
- **Invarianten:** keine Schuld-Texte, keine Serienpflicht, keine Belohnung extremer Defizite.

### D.5 Verlauf als Fortschritt (nicht umgesetzt)
- Oben: Gewichtstrend (geglätteter 7-Tage-Durchschnitt) mit Ziellinie und geschätztem Datum.
- Mitte: Kalorien und Protein der Woche als Balken gegen Ziel; Tage ohne Einträge grau „nicht erfasst“, **nicht** 0 kcal.
- Unten: „Diese Woche: 5 von 7 Tagen erfasst“. Erklärtexte in ein Info-Detail.
- **Abnahme:** fehlende Tage nie als 0 dargestellt; Zielwechsel ändert vergangene Wochen nicht unbemerkt.

---

## E. Design- und Abo-Spezifikation

### E.1 Prioritätsansichten
1. **Suche** (umgesetzt): Quittung oben, „Zuletzt gegessen“ als Liste mit letzter Menge, „Selbst eintragen“ als letzte Zeile.
2. **Heute:** zentraler Knopf als „+“ mit Menü (Foto / Suchen / Beschreiben / Barcode / Zuletzt) statt Logo; Karte „Dein nächster Zug“ in Klartext „Mittagessen: etwa 500 kcal“.
3. **Onboarding-Plan** (D.2). 4. **Verlauf** (D.5). 5. **Paywall** (E.2).

### E.2 Wertversprechen und Paywall

**Was Kandro heute verkauft:** Kontingent an KI-Analysen. **Was Kandro verkaufen sollte:** „Kandro rechnet deinen Tag und deine Woche für dich und passt den Plan an.“

**Pro (Vorschlag, neue Funktionen, Bestehendes bleibt gratis):**
1. Foto & Beschreiben ohne festes Kontingent (fair-use bleibt serverseitig).
2. Wochenrückblick mit Plananpassung (neu, D.4).
3. Mahlzeiten-Vorlagen und „Wie gestern“ für ganze Tage (neu).

**Paywall-Copy (Trial-Variante):**
- DE: **„Dein Plan, jede Woche besser.“** · „Fotos und Beschreibungen ohne Limit“ · „Wochenrückblick, der dein Ziel anpasst“ · „Ganze Mahlzeiten mit einem Tipp wiederholen“ · Preiszeile aus StoreKit: „7 Tage kostenlos, danach {Jahrespreis} pro Jahr ({Monatsäquivalent}/Monat)“ · CTA „7 Tage kostenlos testen“ · Nebenwege „Wiederherstellen“, „Bedingungen“, „Datenschutz“, bei A „Später“.
- EN: **“Your plan, better every week.”** · “Unlimited photo and text logging” · “Weekly review that adjusts your target” · “Repeat whole meals in one tap” · “7 days free, then {annual price} per year ({monthly}/month)” · CTA “Start 7-day free trial”.
- Jahrespreis immer als Gesamtbetrag zuerst; keine erfundenen Rabatte, keine Testimonials. Preise ausschließlich aus StoreKit (heute korrekt per RevenueCat geladen; Vorschauwerte 49,99 € / 7,99 € im Code sind nur Fallback-Text).

**Direkt zahlen vs. Trial:** Ohne Basisdaten keine Vorab-Entscheidung. Reihenfolge: (1) laufender Soft- vs. Hard-Test mit gleichem Trial bis zur Reife (mind. 2 volle Abrechnungszyklen nach Trialende, zugewiesene Nutzer als Nenner). (2) Danach getrennt: Trial vs. Sofortzahlung mit **anderem Produkt** (ohne Einführungsangebot), gleichem Preis, gleicher Paywallhärte. Hauptkennzahl: Nettoerlös nach Erstattungen pro zugewiesenem Nutzer nach 60 Tagen.

### E.3 Widgets
Klein: verbleibende kcal groß, Protein darunter, Fortschrittsring; Tipp öffnet Suche mit „Zuletzt“. Mittel: links Werte, rechts vier Aktionsflächen (Foto, Suche, Beschreiben, Barcode) – im Code vorhanden. Lock Screen nur Einstiege, keine Werte (vorhanden, `privacySensitive`). Offen: Lokalisierung (F15), Text-Fit bei großen Zahlen auf Gerät.

---

## F. Wettbewerbs- und Messkarte

### F.1 Öffentliche Angaben (App Store DE, abgerufen 04.10.2026)

| | YAZIO | MyFitnessPal | Kandro |
|---|---|---|---|
| Bewertung (Anzahl) | 4,6 (≈444 Tsd.) | 4,5 (≈80 Tsd.) | offen |
| Foto-Erfassung | beworben | nicht als Kernfeature gelistet | vorhanden (Pro nach 3 gratis) |
| Barcode | vorhanden | laut Listing Premium | **kostenlos** |
| Datenbank | „riesig“ | „über 20,5 Mio.“ | 7.140 BLS + USDA + Open Food Facts |
| Jahrespreise im Listing | mehrere Stufen bis 83,90 € | 49,99 € bzw. 87,99 € | offen (StoreKit) |

Kein Aufgabenvergleich (Ei, Marke, gemischtes Essen) mit den Wettbewerbern durchgeführt → **nicht bekannt**, kein Sieg und keine Niederlage.

**Realistische Differenzierungsfelder:** (1) kostenloser Barcode und kostenlose Suche, (2) „Was passt als Nächstes“, (3) ehrliche korrigierbare Schätzung mit Quellen, (4) schnelle offline Alltagserfassung (neu), (5) DE-Referenzdaten (BLS).

### F.2 Messkarte

| Kennzahl | Definition | Quelle | Status |
|---|---|---|---|
| Zeit bis erste Mahlzeit | Onboarding-Start → erste gespeicherte Mahlzeit, Median | PostHog (Opt-in) | offen |
| Erfolgsrate je Weg | gespeichert / gestartet je Foto/Text/Suche/Barcode | PostHog | offen |
| Top-1/Top-3 Suche | feste Liste 40 Alltagsbegriffe DE/EN | `validate-instant-logging` | Top-1 für 17+12 Pflichtfälle reproduziert |
| D1/D7/D30 | Tage mit ≥ 1 gespeicherter Mahlzeit / Installationskohorte | PostHog + Server-Meals | offen |
| Paywall gesehen → Trial → erste Zahlung → Verlängerung | getrennt, zugewiesene Nutzer als Nenner | RevenueCat | offen |
| **Hauptkennzahl** | Nettoerlös nach Erstattungen und KI-Kosten pro Installation, Tag 60 | RevenueCat + Provider | offen |
| Qualitätsgrenze | Crashfreie Sitzungen ≥ 99,5 %, Sync-Fehler < 1 % der Speichervorgänge | Organizer, Server | offen |

---

## G. Priorisierter Plan

**Kleinstes nächstes Qualitätsrelease (1.0.4 „Erfassung“), 3–5 Arbeitstage:**
F02-Entscheidung → Commits in Paketen → Migrationen `20261001140808`, `20261004130000` (+ ggf. `20261004120000`) und `nutrition`-Gateway deployen (Freigabe) → ein Store-Build → TestFlight-Gerätetest (Suche, direkt hinzufügen, Beschreibung lokal + KI, Selbst eintragen, Erinnerungen, Upgrade) → Review.

**7 Tage:** F01-Exportschutz, „Wie gestern“ auf Heute, „+“-Menü, Widget-Lokalisierung.
**30 Tage:** Onboarding 7 Schritte mit Zielgewicht (D.2), Verlauf (D.5), Wochenrückblick als erster Pro-Kern, neue Paywall-Copy.
**90 Tage:** Testplan Trial vs. Sofortzahlung, gewogene Fotoreihe, Apple Health (nur Gewicht lesen) prüfen.

**Vorerst ausdrücklich NICHT bauen:** KI-Chat, Social Feed/Community, 7-Tage-Speisepläne, Wasser-Gamification/Serienzwang, Modellwechsel ohne Vergleichstest und Rechtsklärung, Android-Port, eigene Crowdsourcing-Datenbank.

---

## H. Entwicklerübergabe: Release 1.0.4 „Erfassung“

**Ziel:** Jede Alltagsmahlzeit in ≤ 3 Taps erfassbar, auch offline; nichts scheitert ohne Ausweg.

**Umfang:** B.3 ohne F02-Teil (sofern Eigentümer bei Masterprompt-Linie bleibt).

**Abnahmekriterien:**
1. `npm run verify` grün (inkl. `validate-instant-logging`, `validate-beta24-feedback`).
2. Gerät (TestFlight): „haf“ → Haferflocken an Position 1 ohne Netz; Banane in 3 Taps gespeichert; „3l Milch und 2 Toast“ ohne Fragezeichen; „Omas Zupfkuchen“ selbst eingetragen und nach Neustart vorhanden; Cloud-Sync des eigenen Eintrags nach Migration.
3. Upgrade von TestFlight 24 ohne Deinstallation: bestehende Mahlzeiten und Erinnerungseinstellung unverändert.
4. Kein Export/Build enthält Produktionsschlüssel, die nicht über EAS kommen.

**Kompatibilität:** Ältere Clients kennen `manual` nicht: Migration ist additiv (nur erweiterter Check). Lokale Beschreibungen sind `origin: plan` (kostenlos) – Server-Kontingent unverändert.

**Kosten:** 1 EAS-Build (lt. Bericht 11 von 15 frei), 0 KI-Kosten für lokale Pfade; KI-Gerätetest ca. 5–10 Aufrufe (Cent-Bereich) nach Freigabe.

---

## Empfehlung

**Als Nächstes:** Entscheide F02 (Paywall-Testumfang) und gib Release 1.0.4 „Erfassung“ frei. Warum zuerst: Ohne schnelle, verlässliche Erfassung gibt es keine Gewohnheit, und ohne Gewohnheit verlängert niemand ein Abo – egal wie die Paywall aussieht. **Woran du die Verbesserung erkennst:** steigender Anteil Installationen mit gespeicherter Mahlzeit an Tag 1 und Tag 7 sowie sinkende Abbrüche zwischen Suche und Speichern; danach (30–60 Tage) Nettoerlös pro Installation.

**Eigentümerhandlungen (gebündelt):** F02 entscheiden · Materialanfrage 1–6 · Freigabe Migrationen + Gateway + ein Build · Produktions-Testkonten vom 04.10. (anonyme Konten aus lokalen Web-Tests) prüfen und ggf. löschen lassen.
