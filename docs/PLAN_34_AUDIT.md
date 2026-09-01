# Kandro: Abgleich mit dem 34-Punkte-MVP-Plan

Stand: 1. September 2026

Der Anhang enthält einen unnummerierten Produktkern und 33 nummerierte Abschnitte. Zusammen sind das die vom Projekt so bezeichneten 34 Punkte. Abschnitt 33 endet ausdrücklich mit einem Vier-Tage-Build-Plan; ein Tag 5 ist nicht enthalten.

## Ergebnis

- **26 Punkte vollständig im Produkt oder bewusst als Produktregel umgesetzt**
- **4 Punkte planmäßig spätere Produktarbeit oder Marketingarbeit**
- **4 Punkte teilweise fertig, weil native/veröffentlichungsbezogene Nachweise noch extern fehlen**

„Fertig“ bedeutet hier: im Code vorhanden und durch den lokalen Qualitätsblock prüfbar. Es bedeutet nicht, dass Apple, Rechtstexte oder ein externer Betatest bereits freigegeben sind.

## Punkt-für-Punkt

| Nr. | Planinhalt | Status | Nachweis oder Restarbeit |
|---:|---|---|---|
| 0 | „Snap what you ate. Know what to eat next.“ | Fertig | Der Kernablauf beantwortet Schätzung, Tagesstand und nächsten Zug in einer Sequenz. |
| 1 | Konkretes Produkt / Nutrition Autopilot | Fertig | Scan-Ergebnis, verbleibende Makros und nächster Zug sind miteinander verbunden. |
| 2 | Autopilot statt starrer Meal Planner | Fertig | Der Rest des Tages und die Vorschläge werden nach jeder bestätigten Mahlzeit neu berechnet. |
| 3 | USP „Every meal replans your day“ | Fertig | Als Produktinvariante, Result-Übergang und Plan-Logik umgesetzt. |
| 4 | Keine falsche Genauigkeit | Fertig | Alle Werte sind als Schätzung markiert; Confidence, optionale Zutaten und Portionsunsicherheit bleiben sichtbar. |
| 5 | Zwei-Sekunden-Korrektur | Fertig | Zutaten an/aus, `weniger / passt / mehr` und 10-g-Feinkorrektur wirken vor dem Speichern auf alle Werte. |
| 6 | Genau fünf Hauptbereiche | Fertig | Heute, Plan, zentraler Scan, Verlauf, Du. |
| 7 | Today Screen | Fertig | Tagesring, vier echte Summen, dynamischer nächster Zielbereich und reale Mahlzeitenliste; keine erfundene Frühstücksmahlzeit mehr. |
| 8 | Scanner mit Photo, Describe, Barcode | Fertig | Foto ist primär; Beschreiben nutzt Vision/Text-Strukturierung plus USDA; Barcode nutzt Expo Camera plus Open Food Facts. |
| 9 | Result Screen | Fertig | Foto bzw. ehrlicher Eingabe-Platzhalter, Confidence, Makros, Zutaten, Tagesstand und nächster Zug. Auch der zweite und spätere Scan wird korrekt projiziert. |
| 10 | Plan Screen ohne Chat | Fertig | Genau drei Kontexte und genau drei deterministische, katalogbasierte Vorschläge. |
| 11 | „Save My Day“ später | Später | Die wertfreie Sprache ist schon umgesetzt; die benannte eigenständige spätere Funktion gehört laut Plan nicht in v0.1. |
| 12 | Warm Utility | Fertig | Ruhige, freundliche Oberfläche mit großen Zahlen und wenig Text. |
| 13 | Design-Grundlage | Fertig, bewusst angepasst | Die später freigegebene Kandro-Brand-Sheet-Palette (`#F5F3EE`, `#14150F`, `#BBDC8E`, `#3F5233`) hat Vorrang vor den leicht abweichenden Farben des ersten Textplans. |
| 14 | Systemtypografie | Fertig | Keine fremde Display-Schrift; klare systemnahe Hierarchie. |
| 15 | Einheitliche Komponenten | Fertig, bewusst angepasst | Wiederverwendbare Karten/Buttons/Inputs, keine Gradients oder Glassmorphism. Radien folgen dem später freigegebenen Brand Sheet. |
| 16 | Bottom Navigation | Fertig | Dominanter mittlerer Scan-Button mit dem Kandro-Zeichen. |
| 17 | Microinteractions | Fertig | Haptik, gestufte Analyse, Kalorien-Count-up, Remaining-Count-down, Reveal sowie Reduce Motion. |
| 18 | Onboarding | Fertig | Sechs kurze gebündelte Schritte statt künstlich gestreckter neun; Name, Ziel, Alter, Größe, Gewicht, Aktivität und Vorlieben erzeugen jetzt echte persönliche Ziele und werden gespeichert. Beim Neustart wird es nicht wiederholt. |
| 19 | Wellness, nicht Medizin | Fertig für Beta | Nicht-medizinische Sprache, Sicherheitsgrenzen, explizite Wellness-Einwilligung, Datenschutz- und Bedingungsentwürfe. Rechtliche Endprüfung bleibt Release-Gate. |
| 20 | Technische Ernährungserkennung | Fertig | Multimodales Modell erkennt Lebensmittel/Portionen über den gehosteten Gateway; USDA berechnet Nährwerte; Confidence und Korrektur liegen davor; kein LLM-Kalorienraten. |
| 21 | MVP-Technik | Teilweise | Expo/TypeScript/Router, Supabase/Postgres/Auth, authentifizierter Analyse-Gateway mit privatem Tageslimit, RevenueCat, PostHog, USDA/OFF und Vision sind integriert. Native Sentry fehlt bis zum Development-/TestFlight-Build. Storage ist absichtlich unnötig, weil Fotos nicht gespeichert werden. |
| 22 | Datenschutz bei Fotos | Fertig für Beta | Original wird nach Kompression gelöscht; der Gateway speichert nicht und fordert beim Provider `store: false` plus ZDR an; bestätigte Mahlzeiten speichern kein Foto; höchstens drei fehlgeschlagene komprimierte Scans liegen bis zum manuellen Retry lokal. Finale Anbieter-/Retention-Prüfung bleibt Release-Gate. |
| 23 | Minimales Datenmodell | Fertig | Profile, Tagesziele, Mahlzeiten, Zutaten, Empfehlungen und Feedback sind mit Constraints, Indizes, Least Privilege und Owner-RLS vorhanden. |
| 24 | Nicht in Version 1 | Fertig | Keine der ausgeschlossenen Scope-Erweiterungen wurde eingebaut. |
| 25 | MVP exakt | Fertig bis auf nativen Store-Nachweis | Personalisierung, Foto/Text/Barcode, Korrektur, Makros, Tagesstatus, Autopilot, drei Kontexte, echter lokaler Gewichtsverlauf und Free/Pro-Grenze sind vorhanden. |
| 26 | Monetarisierung | Teilweise | Ein vollständiger Scan ist kostenlos; weitere Scans brauchen ein aktives `kandro_pro`-Entitlement. Jahres-/Monatsangebot und Restore funktionieren im RevenueCat Test Store. €39,99/7 Tage und €9,99 müssen noch als echte App-Store-Produkte angelegt und nativ getestet werden. |
| 27 | Paywall erst nach Aha-Moment | Fertig | Erste Mahlzeit wird nach Bestätigung automatisch gespeichert; Result und drei Optionen erscheinen vor der Paywall. |
| 28 | Ehrliches Paywall Design | Fertig für die konfigurierte Umgebung | Kein Countdown, klare Preise/Verlängerung, Restore und echte Offering-Daten. Trial-Text erscheint nur, wenn das Store-Produkt tatsächlich einen Gratiszeitraum liefert. |
| 29 | TikTok-Hook im Produkt | Fertig als Screenfolge | Pizza/anderes Essen → Schätzung → Rest → nächster Zug → drei Optionen ist im Produkt aufnehmbar. Kampagnenproduktion ist kein App-Code. |
| 30 | TikTok-Slideshow | Marketingarbeit | Konzept im Plan, bewusst kein Bestandteil des MVP-Codes. |
| 31 | „Log → adaptieren“ | Fertig | Tonalität und Berechnung bestrafen nicht; sie leiten zur nächsten sinnvollen Entscheidung. |
| 32 | Späterer Moat | Fundament fertig, Lernen später | Korrekturen, Impressions und Accepted/Rejected-Feedback werden strukturiert gespeichert. Ein lernender Preference Graph ist laut Plan spätere Arbeit. |
| 33 | Vier-Tage-Build-Plan | Teilweise extern blockiert | Tag 1–3 sind im lokalen/Test-Store-Umfang fertig. Tag 4 ist im Code fertig, aber die unten aufgeführten nativen, rechtlichen und Veröffentlichungsnachweise fehlen. |

## Die vier Tage

### Tag 1 – Frontend Flow

Fertig: Onboarding, Heute, Scan, Bestätigung/Result, Plan, Verlauf und Paywall sind vollständig klickbar.

### Tag 2 – echte Meal Intelligence

Fertig: Kamera, lokale Bildkompression, Modell-Erkennung, USDA, Open Food Facts, Beschreibungsfallback, Barcodefallback, Korrektur, Speicherung, Offline-Queue und Aktualisierung des Tagesstands. Der gehostete Gateway wurde live mit abgewiesenen öffentlichen Zugriffen sowie echter Foto-, Text- und Barcodeanalyse geprüft.

### Tag 3 – Autopilot

Fertig: Restwerte, persönliche Ziele/Vorlieben, echte Mahlzeitenhistorie, drei strukturierte kontextbezogene Vorschläge, Supabase Auth/RLS/Sync, RevenueCat Test Store und PostHog EU Opt-in.

Noch nativ: StoreKit-Produkte, Sentry-Crashreporting und zugehörige Tests im Development-/TestFlight-Build.

### Tag 4 – Launch Quality

Im Code fertig:

- deterministische Matrix aus 25 Mahlzeiten plus 5 Qualitäts-/Fehlerfällen;
- No-Internet-Queue, unklare Bilder, mehrere Gerichte und Portionen;
- RevenueCat Test-Kauf/Restore;
- Accessibility-Semantik und Reduce Motion;
- Einwilligung, Datenschutz-/Bedingungsentwürfe und Accountlöschung;
- EAS-Konfiguration, App-Store-Texte und Screenshot-Storyboard;
- responsive Landingpage als privates Deployment.

Vor einer externen Beta zwingend offen:

1. mindestens 30 echte iPhone-Mahlzeiten manuell gegen Zutaten und Portionen prüfen;
2. VoiceOver, Dynamic Type, Kontrast, Kamera-Berechtigung und Offline-Retry auf einem physischen iPhone prüfen;
3. Freigabe der bereits bezahlten Apple-Developer-Mitgliedschaft, App-Store-Connect-Zugang, echte Abo-Produkte und nativer StoreKit-Test;
4. nach Apples Identitätsprüfung: signierter Build, echte App-Store-Screenshots und TestFlight-Upload; Expo/EAS ist bereits als `@hewad/kandro` verknüpft;
5. rechtliche Anbieter-/Verantwortlichen-Daten, Kontaktkanal, Aufbewahrungsfristen und finale Prüfung;
6. Sentry nativ mit DSN, Source Maps und Test-Crash aktivieren;
7. Landingpage erst nach fertigen Rechtsangaben öffentlich schalten.

## Bekannte Toolchain-Hinweise

`npm audit --omit=dev` meldet aktuell 25 Paket-Hinweise (9 hoch, 16 mittel) im Expo-/Metro-/Router-Abhängigkeitsbaum, insbesondere `image-size`, `postcss`, `query-string` und `uuid`. Der von npm vorgeschlagene vollständige Fix würde Expo 57 installieren. Das ist für diesen Branch kein sicherer Patch, weil Kandro absichtlich auf Expo SDK 54 und die aktuelle Expo-Go-Kompatibilität festgelegt ist. Deshalb wurde **kein** `npm audit fix --force` ausgeführt. Die Hinweise müssen beim nächsten isolierten Expo-SDK-Upgrade erneut geprüft werden; bis dahin dürfen nur vertrauenswürdige lokale Build-Assets verarbeitet werden.

## Verifikation dieses Abgleichs

- TypeScript ohne Fehler
- 30 deterministische Mahlzeiten-/Bildqualitätsfälle
- 200 geprüfte Katalogmahlzeiten, 90 deterministische Empfehlungssätze
- sieben RLS-geschützte Supabase-Tabellen und ID-erhaltendes Account-Linking
- RevenueCat Offering/Entitlement/Kauf/Abbruch/Restore-Grenzen
- Expo Doctor: 18/18
- Expo Web Export
- Expo iOS Bundle Export
- visueller Browser-Smoke-Test für dynamisches Onboarding, Einwilligung, Foto/Beschreiben/Barcode und reale Progress-Zustände
- live in der Cloud: öffentliche Zugriffe → 401; Textanalyse → zwei strukturierte USDA-Zutaten; Fotoanalyse → drei Zutaten; Barcode → Open Food Facts; Kontingenttabelle → 403
