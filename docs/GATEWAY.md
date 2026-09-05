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
| Limit | keins | Analyse-, Nutzer-, Netzwerk- und providerspezifische globale Circuit-Breaker |
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

Die serverseitige Drei-Gratisanalysen-/RevenueCat-Grenze ist am 4. September
2026 **nur lokal implementiert und geprüft**. Migration, neue Secrets,
`revenuecat-webhook` und die aktualisierte `nutrition`-Function wurden bewusst
nicht live ausgerollt. Bis alle Schritte im Abschnitt „RevenueCat-Zugriff
aktivieren“ erledigt und im Sandboxbetrieb belegt sind, ist Production für
einen finalen Release nicht freigegeben.

## Einmalig einrichten

1. Secrets anlegen:

   ```bash
   cp supabase/.env.gateway.example supabase/.env.gateway
   ```

   Werte eintragen, dann hochladen:

   ```bash
   npm run gateway:secrets
   ```

   `NUTRITION_RATE_LIMIT_SALT` muss dabei ein langer, zufälliger und nur
   serverseitiger Wert sein, unabhängig von den Waitlist- und Guardian-Salzen.
   Fehlt er, schlagen externe Suche, Barcode und Analyse bewusst geschlossen
   fehl, statt ein durch Accountrotation umgehbares Limit zu verwenden.

2. Migrationen ausrollen (legt Quota, Cache und das serverseitige
   Entitlement-/Idempotenz-Ledger an):

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
| `POST` | `/v1/entitlement/refresh` | Kauf/Restore serverseitig gegen RevenueCat bestätigen; atomarer 20-s-Cooldown | nein |
| `GET` | `/v1/barcode/{ean}` | Open Food Facts | nein, kostet uns nichts |
| `GET` | `/v1/search?q=...` | Lebensmittelsuche über BLS/USDA | nein, kostet keine KI-Tokens |

Jede Route verlangt neben der gültigen Nutzer-JWT die aktuelle versionierte
Einwilligung im eigenen `profiles`-Datensatz. Das verhindert auch dann eine
Weitergabe, wenn ein veralteter oder manipulierter Client den Bildschirm
umgeht.

## Server-authoritative Gratis- und Pro-Zugriff

AsyncStorage und ein sichtbarer Paywall-Screen sind Komfortfunktionen, keine
Autorisierung. Der gehostete Gateway entscheidet deshalb selbst:

- Die ersten **drei erfolgreich abgeschlossenen** Foto- oder Textanalysen pro
  unveränderter Supabase-User-ID sind gratis. Ungültige Bilder,
  Providerfehler und abgebrochene Reservierungen verbrauchen keinen
  Gratisplatz.
- Danach gilt nur eine aktuell zugangsgebende Apple-App-Store-Subscription.
  Der REST-Abgleich akzeptiert Apple `production` und `sandbox` (TestFlight
  und App Review), prüft aber zusätzlich die erlaubten internen `prod...`-,
  `app...`- und `entl...`-IDs. RevenueCat Test Store/`rc_billing` wird nie als
  Pro akzeptiert.
- `PRO_ANALYSIS_DAILY_LIMIT` begrenzt Pro-Erfolge/aktive Reservierungen pro
  UTC-Tag. `ANALYSIS_DAILY_LIMIT` bleibt unabhängig davon die harte Obergrenze
  für Provider-Versuche und begrenzt auch wiederholte Fehler.
- `GLOBAL_ANALYSIS_DAILY_LIMIT` ist ein atomischer UTC-Tages-Circuit-Breaker
  über alle Nutzer-IDs. Er begrenzt die Sybil-Kosten bei neu angelegten
  anonymen Konten; zusätzlich bleibt ein harter Spend-Cap beim Provider nötig.
- Jede bezahlte Route verlangt eine UUIDv4 `requestId`. Eine Reservierung wird
  atomar erstellt, vor dem Provider als gestartet markiert und nur nach einem
  strukturierten HTTP-200-Ergebnis committed. Retry/Offline-Queue verwenden
  dieselbe UUID. Ein verlorenes erfolgreiches Response kann dadurch exakt
  wiederholt werden, ohne erneut zu zählen oder den Provider aufzurufen.
- Barcode und Suche bleiben kostenlos. Externe Cache-Misses beanspruchen aber
  unmittelbar vor jedem einzelnen Request ein providerspezifisches Kontingent:
  Open Food Facts hat projektweite Fenster von 4 Such- bzw. 7 Produktabrufen
  pro Minute. Selbst ein doppelter Grenzburst bleibt damit unter den
  veröffentlichten Limits von 10 bzw. 15. USDA-Suche und USDA-Analyse haben
  getrennte Stundenfenster von 100 und 300 Request-Einheiten; selbst der
  mathematische Doppelburst beider Fenster bleibt mit 800 unter dem
  veröffentlichten Limit von 1.000 Requests pro Stunde. Nutzer- und
  gesalzene Netzwerkpseudonyme verhindern Umgehung durch Accountrotation und
  werden spätestens nach zwei Stunden Inaktivität gelöscht. BLS-Lokaltreffer
  beanspruchen kein Providerkontingent.
- RevenueCat-Abgleiche teilen sich projektweit ein atomisches Fenster von 200
  Request-Einheiten pro Minute. Selbst der mathematische Doppelburst von 400
  bleibt unter RevenueCats veröffentlichten 480 Customer-Information-Abfragen
  pro Minute und lässt 80 Einheiten Reserve. Öffentliche Kaufabgleiche haben
  zusätzlich 3 Einheiten pro Account und 10 pro gesalzenem Ausgangsnetzwerk;
  ein Webhook reserviert alle Alias-Abfragen als eine unteilbare Charge.

RevenueCat-Zustand gilt 24 Stunden als frisch. Wenn er älter ist, prüft der
Gateway serverseitig `GET /v2/projects/{project_id}/customers/{user_id}/subscriptions?limit=100`.
Ein Account, der nie als zahlend bestätigt wurde, wird bei einem Ausfall nie
freigeschaltet. Nur zuletzt aktiv und noch nicht abgelaufen bestätigte Kunden
haben eine zusätzliche Grace Period von höchstens sechs Stunden.

### Kurze Speicherung für idempotente Wiederholung

`analysis_requests.result_json` enthält ausschließlich das strukturierte
Nährwertergebnis, niemals Foto/Base64, Beschreibung, Prompt oder
Provider-Rohantwort. Ein stündlicher `pg_cron`-Job entfernt das Feld ab 22
Stunden; die zweistündige Sicherheitsmarge hält die Speicherung auch bei
einem verzögerten Stundenlauf unter 24 Stunden. Danach bleibt nur ein
UUID-/Status-Tombstone 30 Tage, um
sehr späte Doppelausführungen abzuweisen. Verarbeitete Webhook-Event-IDs werden
90 Tage zur Deduplikation gehalten. Alle drei Tabellen haben RLS ohne
Clientpolicy/-grant und werden bei Accountlöschung per FK-Cascade bereinigt.

## RevenueCat-Zugriff aktivieren (manueller Live-Gate)

RevenueCat dokumentiert Webhooks als Pro-Integration. Der aktuelle Pro-Tarif
startet ohne Gebühr bis zur dort genannten MTR-Grenze; Tarif und Verfügbarkeit
müssen im eigenen Dashboard vor dem Rollout bestätigt werden.

1. In RevenueCat einen API-v2-Secret-Key für genau das Kandro-Projekt anlegen,
   nur mit `customer_information:subscriptions:read`.
   Einen zweiten, getrennten Schlüssel nur mit
   `customer_information:customers:read_write` für die Accountlöschung
   anlegen. So kann der Löschpfad Kundendaten entfernen, ohne Kauf- oder
   Projektkonfiguration verändern zu dürfen.
2. Die internen IDs notieren: `proj...` (Projekt), `app...` (Kandro-iOS-App)
   und `entl...` (Entitlement-Ressource) sowie die `prod...`-Ressourcen für
   Monats-/Jahresprodukt. `entl...` ist **nicht** der sichtbare Lookup-Key
   `kandro_pro`; `prod...` ist nicht die Store-Produkt-ID.
3. Unter **Integrations → Webhooks** eine app-spezifische Integration für
   Kandro anlegen. Ziel:
   `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook`.
   Sandbox und Production aktivieren (oder getrennte Integrationen verwenden),
   einen langen zufälligen Authorization-Wert setzen und HMAC Signing
   einschalten. Den nur einmal angezeigten Signing-Secret sicher speichern.
4. Diese acht Werte aus `supabase/.env.gateway.example` als Supabase Edge
   Secrets setzen: `REVENUECAT_PROJECT_ID`, `REVENUECAT_APP_ID`,
   `REVENUECAT_ENTITLEMENT_RESOURCE_ID`,
   `REVENUECAT_IOS_PRODUCT_RESOURCE_IDS`, `REVENUECAT_SECRET_API_KEY`,
   `REVENUECAT_ERASURE_API_KEY`,
   `REVENUECAT_WEBHOOK_AUTHORIZATION`,
   `REVENUECAT_WEBHOOK_SIGNATURE_SECRET`. Keiner davon ist `EXPO_PUBLIC_`.
5. Dry-run und Migration ausführen, danach die Functions deployen:

   ```bash
   npm run db:remote:check
   npm run db:remote:push
   npm run gateway:secrets
   npm run gateway:deploy
   npx supabase functions deploy revenuecat-webhook --no-verify-jwt
   npx supabase functions deploy delete-account
   ```

6. Unter RevenueCat **Project Settings → General → Sandbox Testing Access**
   für den loginlosen App-Review-Flow bewusst `Anybody` verwenden. Ein Apple-
   Reviewer erhält eine neue anonyme Supabase-UUID, die nicht vorab allowlistbar
   ist; `Allowed App User IDs only` würde deshalb auch einen echten Apple-
   Sandbox-Kauf blockieren. Die Sicherheitsgrenze bleibt die serverseitige
   Prüfung auf `store=app_store` sowie die exakten internen App-, Produkt- und
   Entitlement-IDs. RevenueCat Test Store/`rc_billing` bleibt dadurch auch bei
   `Anybody` gesperrt. Eine UUID-Allowlist ist erst mit einem stabilen,
   dokumentierten Reviewer-Account sinnvoll.
7. Vor Production im Apple-Sandbox/TestFlight-Betrieb belegen: drei
   Gratiserfolge, vierter Aufruf gesperrt; Kauf/Restore aktiv; Ablauf/Refund
   gesperrt; gleicher Request und gleicher Webhook doppelt zählen nur einmal;
   manipulierte/veraltete HMAC wird abgewiesen; Logs enthalten weder Payload,
   User-ID, Authorization noch Signatur.

RevenueCat Test Store in Expo Go simuliert nur Kauf-/Fehler-/Abbruch-UI. Er
schaltet den gehosteten Pro-Gateway absichtlich nicht frei. Das vollständige
IAP-E2E läuft über TestFlight/Apple Sandbox; alternativ braucht Entwicklung ein
separates Supabase- und RevenueCat-Projekt, niemals gelockerte Production-Regeln.

Zusätzlich im OpenRouter-Dashboard einen harten monatlichen Spend-Cap und
frühzeitige Kostenwarnungen setzen. Der Datenbank-Circuit-Breaker schützt gegen
Anwendungsverkehr, ersetzt aber keinen anbieterseitigen Rechnungsdeckel.

## Guardian-Consent aktivieren (manueller Live-Gate)

Die öffentliche Bestätigungs-URL kann kein Supabase-JWT verlangen; deshalb ist
`guardian-consent` in `supabase/config.toml` bewusst mit `verify_jwt=false`
konfiguriert. Request und Status prüfen das anonyme User-JWT im Handler, Links
verwenden ein einmaliges Token, und das atomare Datenbank-Ledger begrenzt
Versuche je User, Netzwerk und E-Mail.

1. `RESEND_API_KEY` und einen verifizierten Absender als
   `GUARDIAN_CONSENT_FROM` setzen. Fehlt der optionale spezielle Absender,
   verwendet die Function `WAITLIST_FROM`.
2. `GUARDIAN_RATE_LIMIT_SALT` als langen zufälligen, nur serverseitigen Wert
   setzen. Er muss unabhängig von `WAITLIST_IP_SALT` sein und darf nie in Git,
   ein Ticket oder Client-Env gelangen.
3. Nach der dazugehörigen Migration deployen:

   ```bash
   npx supabase functions deploy guardian-consent --no-verify-jwt
   ```

4. Live belegen: authentifizierter Request und Status, generische Antwort bei
   wiederholter/paralleler Anfrage, falsches/abgelaufenes/bereits verbrauchtes
   Token, DE- und EN-Mail/Bestätigungsseite sowie eine anschließende erlaubte
   Analyse für 14- bis 15-Jährige. Supabase-/Resend-Logs dürfen weder Adresse,
   Token, JWT noch Wellnessdaten enthalten.

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
