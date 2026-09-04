# Analysis gateway

Foto-Scan, Beschreiben und Barcode laufen alle über denselben Gateway. Er hält
die bezahlten Provider-Keys (OpenRouter/OpenAI, USDA). Diese Keys dürfen nie auf
ein Gerät gelangen — eine App im App Store ist für jeden auslesbar.

## Zwei Betriebsarten

| | lokal (Entwicklung) | gehostet (Preview + Produktion) |
|---|---|---|
| Läuft als | `npm run api` auf deinem Mac | Supabase Edge Function `nutrition` |
| Client findet ihn über | `EXPO_PUBLIC_ANALYSIS_API_URL` | Supabase-URL der App |
| Auth | keine | Supabase-JWT plus aktuelle ausdrückliche Analyse-Einwilligung |
| Limit | keins | `ANALYSIS_DAILY_LIMIT` pro Nutzer und Tag |
| Erkennung | GPT-4.1-mini, standardmäßig Bilddetail `high` | GPT-4.1-mini, standardmäßig Bilddetail `high` |

Die App bevorzugt `EXPO_PUBLIC_ANALYSIS_API_URL`, wenn gesetzt. **In Preview- und
Produktionsbuilds muss diese Variable leer sein**, sonst versucht die App, dein
MacBook zu erreichen.

## Live-Status

Die Function ist seit dem 1. September 2026 im EU-Projekt aktiv. Migration und
Secrets sind ausgerollt; `EXPO_PUBLIC_ANALYSIS_API_URL` ist weder in Preview
noch Produktion gesetzt, und beide EAS-Umgebungen enthalten die öffentlichen
Supabase-Clientwerte. Am 2. September wurde zusätzlich live bestätigt: ohne
aktuelle ausdrückliche Einwilligung antwortet der Gateway mit 403; nach der
Einwilligung läuft die Analyse über einen Zero-Data-Retention-Endpunkt von
Microsoft Azure und liefert ein Ergebnis.

## Einmalig einrichten

1. Secrets anlegen:

   ```bash
   cp supabase/.env.gateway.example supabase/.env.gateway
   ```

   Werte eintragen, dann hochladen:

   ```bash
   npm run gateway:secrets
   ```

2. Migration ausrollen (legt `analysis_usage` und `consume_analysis_quota` an):

   ```bash
   npm run db:remote:check   # Dry-Run
   npm run db:remote:push
   ```

3. Function deployen:

   ```bash
   npm run gateway:deploy
   ```

4. In EAS sicherstellen, dass `EXPO_PUBLIC_ANALYSIS_API_URL` in den Environments
   `preview` und `production` **nicht** gesetzt ist.

## Routen

Alle unter `https://<projekt>.supabase.co/functions/v1/nutrition`:

| Methode | Pfad | Zweck | Zählt aufs Limit |
|---|---|---|---|
| `POST` | `/v1/analyze` | Foto (Base64 JPEG) | ja |
| `POST` | `/v1/describe` | Freitextbeschreibung | ja |
| `GET` | `/v1/barcode/{ean}` | Open Food Facts | nein, kostet uns nichts |
| `GET` | `/v1/search?q=...` | Lebensmittelsuche über BLS/USDA | nein, kostet keine KI-Tokens |

Jede Route verlangt neben der gültigen Nutzer-JWT die aktuelle versionierte
Einwilligung im eigenen `profiles`-Datensatz. Das verhindert auch dann eine
Weitergabe, wenn ein veralteter oder manipulierter Client den Bildschirm
umgeht.

## Provider- und Datenschutzgrenze

Produktionsanfragen gehen an OpenRouter in den USA. Die Provider-Auswahl ist
auf Microsoft Azure beschränkt, `allow_fallbacks` ist deaktiviert und
`zdr: true` wird pro Anfrage erzwungen. Datenweitergabe und Speicherung sind in
der Provider-Policy deaktiviert; `store: false` wird zusätzlich am
Responses-Endpunkt gesetzt. Kann OpenRouter keinen passenden
Zero-Data-Retention-Endpunkt liefern, schlägt die Anfrage fehl, statt auf einen
anderen Anbieter auszuweichen. Diese Grenze muss mit der Datenschutzerklärung
und den App-Store-Datenschutzangaben übereinstimmen.

## Warum das Limit existiert

Jeder Foto- und Beschreiben-Aufruf kostet echtes Geld beim Vision-Provider. Ein
öffentlicher Endpunkt ohne Obergrenze ist eine offene Rechnung. Deshalb:

- `verify_jwt = true` weist fehlende Credentials an der Plattformgrenze ab;
  `withSupabase({ auth: 'user' })` plus `auth.getUser()` validiert danach die
  tatsächliche Nutzer-JWT im Handler. Ein Publishable Key allein reicht nicht.
- Der öffentliche `consume_analysis_quota()`-Wrapper läuft mit
  Aufruferrechten. Nur die nicht über die Data API exponierte Implementierung
  in `private` ist `security definer`. Das Limit selbst ist **kein Argument**,
  damit ein Client es nicht hochsetzen kann.
- `analysis_usage` hat RLS ohne Policies und ohne Grants. Niemand außer der
  Datenbankfunktion kommt an die Zähler.
- Ungültige Payloads werden vor dem Zählen abgewiesen.
- Fotos werden bei > 3 MB Base64 abgewiesen.

## Deutsche BLS-Referenzen

Vor USDA prüft der Gateway 64 häufige deutsche Komplettgerichte aus dem
Bundeslebensmittelschlüssel 4.0. GPT-4.1-mini darf nur den kontrollierten
`referenceKey` auswählen und die Portion schätzen; Kalorien und Makros werden
deterministisch aus dem BLS-Datensatz skaliert. So wird beispielsweise ein
passender Döner, eine Pizza Margherita oder Linsensuppe nicht in zufällige
USDA-Einzelzutaten zerlegt.

Die Momentaufnahme stammt vom Max Rubner-Institut, BLS 4.0 (2025), CC BY 4.0,
DOI `10.25826/Data20251217-134202-0`. Details und Testgrenzen stehen in
`docs/ACCURACY.md`.

## Zweisprachige Lebensmittelsuche

Die kostenlose Suchroute verwendet zusätzlich die vollständige geprüfte
BLS-4.0-Momentaufnahme mit 7.140 Lebensmitteln und zubereiteten Gerichten. Jeder
Eintrag trägt denselben Quellcode, deutsche und englische Originalbezeichnung
sowie fünf Nährwerte pro 100 g. Dadurch erscheinen deutsche Suchergebnisse
nicht mehr mit rohen englischen USDA-Namen, und typische deutsche,
amerikanische, britische, türkische und asiatische Gerichte werden ohne
KI-Aufruf und meist ohne Netzwerk-Rundreise gefunden.

Die 64 plate-level Referenzen bleiben als Teilmenge erhalten, weil sie zusätzlich
eine geprüfte typische Portion besitzen. Bei allen anderen Treffern fragt die
App ausdrücklich nach Gramm. Das vollständige Workbook wird nicht eingecheckt;
`scripts/build-bls-search-catalog.py` erzeugt aus dem offiziellen Download die
kompakte, gehashte Laufzeitdatei. Open Food Facts bleibt der Fallback für
Markenprodukte, USDA der englische Fallback für Einträge außerhalb des BLS.
Bei einer deutschen Produktsuche werden Einträge ohne deutschen Titel
ausgelassen, statt einen englischen Namen in die Liste zu mischen. Beim
Barcode bleibt der beste vorhandene Titel sichtbar, damit das konkret
gescannte Produkt identifizierbar ist.

## USDA-Cache

Pro Zutat geht eine USDA-Anfrage, bis zu zwölf pro Scan. api.data.gov begrenzt
das **pro API-Key**, nicht pro Nutzer — die Lebensmitteldatenbank ist damit der
erste Engpass unter Last, nicht das Vision-Modell.

`usda_food_cache` speichert die Nährwerte je normalisiertem und mit der
Matcher-Version versehenem Suchbegriff. Ein neuer Ranking-Algorithmus liest
damit keine alten Entscheidungen weiter. Nur eindeutige Treffer mit genügend
Abstand zum zweitbesten Kandidaten werden geteilt; mehrdeutige Ergebnisse
bleiben auf den aktuellen Prüfschritt begrenzt.

- Eindeutige Treffer laufen nach 90 Tagen ab.
- Zusätzlich hält jede warme Function-Instanz bis zu 500 Begriffe im Speicher.
- Die Tabelle enthält **keine Nutzerdaten** — nur englische Gattungsbegriffe wie
  `grilled chicken breast`, die das Modell erzeugt.
- RLS ohne Policies, keine Grants: nur die Service-Rolle der Function kommt
  heran. Wäre die Tabelle beschreibbar, könnte ein Nutzer falsche Nährwerte für
  alle anderen hinterlegen.

### Warum die Trefferauswahl zählt

`chooseFood` sortierte früher nur nach USDA-Datentyp. Für „broccoli" gibt es
keinen Foundation-Eintrag, also gewann der erste Survey-Treffer:
**„Fried broccoli" mit 223 kcal/100 g**, während „Broccoli, raw" mit 39 zwei
Zeilen darunter stand. Mit Cache wäre dieser Fehler 90 Tage lang an alle
ausgeliefert worden.

Jetzt zählen Wortabdeckung, zusätzliche Lebensmittelbegriffe, Zubereitung und
Abstand zum zweitbesten Kandidaten; der Datentyp ist nur noch ein Teil des
Rankings. Widersprüchliche Zubereitungen wie „fried“ erhalten eine starke
Strafe. `npm run validate:cache` pinnt diese Fälle fest.

## Fehler nachsehen

Öffne **Supabase Dashboard → Edge Functions → nutrition → Logs**.

Der Gateway loggt nur eine gekürzte Fehlermeldung, nie den Provider-Rohtext und
nie Nutzerinhalte.

## Geteilte Logik

`supabase/functions/_shared/detection.mjs`, `bls-reference.mjs` und
`nutrition.mjs` enthalten Modellschema/Prompt, BLS-Zuordnung und USDA-Mapping.
`server/core.mjs` re-exportiert sie nur, damit der lokale Node-Gateway und die
deployte Function nicht auseinanderlaufen können.
