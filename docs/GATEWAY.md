# Analysis gateway

Foto-Scan, Beschreiben und Barcode laufen alle über denselben Gateway. Er hält
die bezahlten Provider-Keys (OpenRouter/OpenAI, USDA). Diese Keys dürfen nie auf
ein Gerät gelangen — eine App im App Store ist für jeden auslesbar.

## Zwei Betriebsarten

| | lokal (Entwicklung) | gehostet (Preview + Produktion) |
|---|---|---|
| Läuft als | `npm run api` auf deinem Mac | Supabase Edge Function `nutrition` |
| Client findet ihn über | `EXPO_PUBLIC_ANALYSIS_API_URL` | Supabase-URL der App |
| Auth | keine | Supabase-JWT, an Plattform- und Handler-Grenze geprüft |
| Limit | keins | `ANALYSIS_DAILY_LIMIT` pro Nutzer und Tag |

Die App bevorzugt `EXPO_PUBLIC_ANALYSIS_API_URL`, wenn gesetzt. **In Preview- und
Produktionsbuilds muss diese Variable leer sein**, sonst versucht die App, dein
MacBook zu erreichen.

## Live-Status

Die Function ist seit dem 1. September 2026 im EU-Projekt aktiv. Migration und
Secrets sind ausgerollt; `EXPO_PUBLIC_ANALYSIS_API_URL` ist weder in Preview
noch Produktion gesetzt, und beide EAS-Umgebungen enthalten die öffentlichen
Supabase-Clientwerte. Der Live-Smoke-Test hat anonyme/öffentliche Zugriffe
abgewiesen und Barcode-, Text- sowie Fotoanalyse erfolgreich ausgeführt.

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

## Fehler nachsehen

Öffne **Supabase Dashboard → Edge Functions → nutrition → Logs**.

Der Gateway loggt nur eine gekürzte Fehlermeldung, nie den Provider-Rohtext und
nie Nutzerinhalte.

## Geteilte Logik

`supabase/functions/_shared/nutrition.mjs` enthält die USDA-Zuordnung und die
Klassifikation. `server/core.mjs` re-exportiert sie nur, damit der lokale
Node-Gateway und die deployte Function nicht auseinanderlaufen können.
