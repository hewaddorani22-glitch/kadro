# Web-Runtime-Evidenz: Kandro

**Auditdatum:** 4. September 2026

**Zeitzone:** Europe/Berlin

**Repository:** `nutrition-autopilot`

**Branch:** `audit/app-store-release-gate-20260904`

**Commit:** `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5`

**Produktionsdomain:** `https://getkandro.com`

**Änderungsmodus:** ausschließlich lesende Prüfungen; keine Produktionsdaten angelegt, keine E-Mail versendet und keine Website-/App-Quelldatei geändert.

## 1. Erreichbarkeit, Weiterleitungen und TLS

Alle Aufrufe wurden am 4. September 2026 mit `curl` ausgeführt. `ssl_verify_result=0` galt für sämtliche HTTPS-Aufrufe.

| Aufruf | Erststatus | Ziel/Endstatus |
|---|---:|---|
| `http://getkandro.com/` | 301 | `https://getkandro.com/`, 200 |
| `https://www.getkandro.com/` | 301 | `https://getkandro.com/`, 200 |
| `https://getkandro.com/` | 200 | 200 |
| `https://getkandro.com/en/` | 200 | 200 |
| `/privacy` | 301 | `/privacy/`, 200 |
| `/en/privacy` | 301 | `/en/privacy/`, 200 |
| `/terms` | 301 | `/terms/`, 200 |
| `/en/terms` | 301 | `/en/terms/`, 200 |
| `/support` | 301 | `/support/`, 200 |
| `/en/support` | 301 | `/en/support/`, 200 |
| `/confirm` | 301 | `/confirm/`, 200 |
| `/en/confirm` | 301 | `/en/confirm/`, 200 |
| `/impressum` | 301 | `/impressum/`, 200 |
| `/sources` | 301 | `/sources/`, 200 |
| `/en/sources` | 301 | `/en/sources/`, 200 |
| `/guardian-consent` | 301 | `/guardian-consent/`, 200 |
| `/en/guardian-consent` | 301 | `/en/guardian-consent/`, 200 |

Zertifikatprüfung mit OpenSSL:

- Subject/CN: `getkandro.com`
- Issuer: Let's Encrypt `YR2`
- SAN: `getkandro.com`, `www.getkandro.com`
- Gültig: 1. September 2026 bis 30. November 2026 (GMT)

Die live ausgelieferten HTML-, CSS- und JavaScript-Dateien aller 15 Seiten sowie `styles.css`, `waitlist.js`, `confirm.js`, `guardian-consent.js`, `community.js` und `experience.js` waren am Prüfzeitpunkt SHA-256-identisch mit `site/` im geprüften Commit.

## 2. Header

Die Hauptseite wird über GitHub Pages ausgeliefert. Beobachtet wurden unter anderem `Content-Type`, Cache-Header und `Access-Control-Allow-Origin: *`. Nicht beobachtet wurden:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`

Die Supabase-Edge-Function-Antwort enthielt dagegen `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, eine ursprungsabhängige CORS-Antwort und `x-sb-edge-region: eu-central-1`.

## 3. Interne und externe Links

Ein Browser-Crawl erreichte alle 15 HTML-Seiten sowie deren lokalen Assets. Nach Weiterleitungen antworteten alle Ziele mit 200. Es wurden keine kaputten internen Links gefunden.

- Discord-Einladung: `https://discord.gg/D6KCXWtuUd` leitete auf `https://discord.com/invite/D6KCXWtuUd` weiter und antwortete mit 200.
- Der im Impressum verlinkte frühere EU-ODR-Pfad leitete auf eine allgemeine EU-Seite zur Verlagerung des Angebots weiter. Der Link ist technisch erreichbar, die dazugehörige Behauptung ist jedoch inhaltlich veraltet; siehe Finding `WEB-P1-03`.
- Die Supportadresse ist als `mailto:` in DE und EN vorhanden. Eine tatsächliche Zustell- und Antwortprobe wurde wegen des Verbots, externe Nachrichten bzw. Produktionsdaten im Audit anzulegen, nicht ausgelöst.

## 4. Responsive und Accessibility-Grundprüfung

Folgende 15 Seiten wurden in einem echten Browser jeweils mit 390 px und 820 px Breite geprüft:

`/`, `/en/`, `/privacy/`, `/en/privacy/`, `/terms/`, `/en/terms/`, `/support/`, `/en/support/`, `/confirm/`, `/en/confirm/`, `/impressum/`, `/sources/`, `/en/sources/`, `/guardian-consent/`, `/en/guardian-consent/`.

Ergebnisse:

- Jede Seite hatte genau ein `main` und ein `h1`.
- Bilder hatten Alternativtexte; keine leeren Links, namenlosen Buttons oder unbeschrifteten Formulareingaben wurden gefunden.
- Die Startseiten hatten bei 390 px und 820 px keinen horizontalen Überlauf.
- Die deutsche Bedingungsseite hatte bei 390 px einen reproduzierbaren Überlauf von 5 px (`scrollWidth 395`, `clientWidth 390`); bei 820 px nicht.
- DE- und EN-Sprachrouting funktionierten, eine ausdrückliche Auswahl gewann gegenüber Gerätesprache und gespeichertem Wert.
- `prefers-reduced-motion` wird in `site/styles.css` berücksichtigt.

Lighthouse 12.8.2, ausgeführt am 4. September 2026:

| Seite | Accessibility | Best Practices | einziger gefundener Accessibility-Fehler |
|---|---:|---:|---|
| DE-Startseite | 0,96 | 1,00 | `.microcopy`, Kontrast 3,47:1 statt 4,5:1 |
| EN-Startseite | 0,96 | 1,00 | `.microcopy`, Kontrast 3,47:1 statt 4,5:1 |

Die Rohberichte liegen in `lighthouse-home-de.json` und `lighthouse-home-en.json`.

## 5. Netzwerk, Tracker, Cookies und Formulare

### Startseitenaufruf

Beim vollständigen Aufruf der DE- und EN-Startseite beobachtete Ressourcen:

- dieselbe Domain: HTML, `styles.css`, Bildassets, `community.js`, `waitlist.js`, `experience.js`, `icon.svg`
- Supabase: `GET /functions/v1/waitlist/status`

Es wurden keine Analytics-, Werbe- oder sonstigen Tracker-Anfragen beobachtet. Nach dem Laden enthielt der Browser keine Cookies. Im `localStorage` lag nur `kandro-lang=de` beziehungsweise `kandro-lang=en`. Die Supabase-Infrastruktur sendete zwar einen Cloudflare-Bot-Management-`Set-Cookie`-Header auf der fremden `.supabase.co`-Domain, der Cross-Origin-`fetch` ohne Credentials speicherte ihn im geprüften Browser nicht.

Das ist ein technischer Laufzeitbefund und keine abschließende rechtliche Aussage zur Consent-Pflicht.

### Wartelistenformular

- `GET .../waitlist/status` antwortete live mit 200 und `{"accepting":true}`.
- Die Formulare oben und unten waren auf DE und EN sichtbar und aktiv.
- Eine abgefangene, nicht an die Produktion übertragene Formularanfrage bewies die sprachrichtige Payload:
  - DE: `language: "de"`, E-Mail, `source` aus `?ref=`
  - EN: `language: "en"`, E-Mail, `source` aus `?ref=`
- Eine sichere Live-Anfrage mit syntaktisch ungültiger E-Mail antwortete mit 400/`invalid_email` und schrieb keinen Datensatz.
- Ein Preflight mit fremdem Origin erhielt weiterhin `Access-Control-Allow-Origin: https://getkandro.com`; ein Browser gibt die Antwort daher nicht an den fremden Ursprung frei.
- Ein ungültiges Bestätigungstoken antwortete mit 400. Die DE-Bestätigungsseite zeigte danach einen lokalisierten, verständlichen Fehlerzustand.
- Ein ungültiges Guardian-Token zeigte auch auf EN einen lokalisierten Fehlerzustand.
- Kein echter Eintrag, kein Bestätigungslink, keine Abmeldung und keine Launch-Mail wurden im Audit erzeugt. Der vollständige E-Mail-Rundlauf bleibt daher manuell zu bestätigen.

### Backend-Schutz aus dem Quellcode

- `public.waitlist` hat RLS ohne öffentliche Policies und `REVOKE ALL` für `anon` und `authenticated`.
- Nur die Edge Function greift mit der Service-Rolle zu.
- Double-Opt-in, einheitliche Antwort gegen E-Mail-Enumeration, E-Mail-Normalisierung, Rate Limit und gesalzener IP-Hash sind implementiert.
- Widerspruch: Der öffentliche Text verspricht einen Abmeldelink und Löschung, während die aktuell vorhandene Bestätigungsmail keinen Abmeldelink enthält und `/unsubscribe` nur Statusfelder ändert. Siehe `WEB-P1-01`.

## 6. Ausgeführte statische Website-Validatoren

| Befehl | Exit | Ergebnis |
|---|---:|---|
| `npm run validate:site` | 0 | 15 Seiten, Links, Canonicals, Hreflang und App-Store-URLs bestanden; Webtexte entsprechen den App-Legaltexten |
| `npm run validate:site-images` | 0 | 10 Landingpage-Bilder: reale und deklarierte Maße sowie Telefonformat bestanden |
| `npm run validate:waitlist` | 0 | RLS/Service-Rolle, Double-Opt-in und vorhandene Policy-Begriffe bestanden |
| `npm run validate:language-routing` | 0 | Gerätesprache, gespeicherte und ausdrückliche Auswahl sowie Schleifenfreiheit bestanden |

Wichtig: `validate:waitlist` prüft derzeit nicht, ob der angekündigte Abmeldelink wirklich in jeder Mail vorhanden ist, ob der Datensatz gelöscht wird oder ob die Sechs-Monats-Frist technisch umgesetzt ist.

## 7. Account-Löschung

Der Webtext verweist korrekt auf den in der App vorhandenen Weg `Du → Account und Daten löschen`. Quellcodepfad und Löschsequenz wurden abgeglichen. Zusätzlich liegt unabhängige Live-Evidenz unter `../network/03_account_deletion_live.log`: temporärer Supabase-Account, Profil-Cascade und Refresh-Token-Widerruf bestanden, Exit-Code 0. Die App weist korrekt darauf hin, dass ein Apple-Abo separat gekündigt werden muss.

## 8. Screenshots

- `home-de-mobile-top.png`: DE-Hero, 390 px
- `home-de-mobile-full-after-scroll.png`: DE-Gesamtseite nach ausgelösten Reveal-Animationen
- `home-de-mobile-footer.png`: DE-Footer/CTA
- `home-en-ipad-top-820x1180.png`: EN-Hero, 820 px
- `privacy-de-mobile.png`: DE-Datenschutz
- `terms-de-mobile-overflow.png`: reproduzierbarer 5-px-Überlauf
- `impressum-de-mobile.png`: Impressum
- `confirm-de-invalid.png`: ungültiges Bestätigungstoken, DE
- `guardian-en-invalid.png`: ungültiges Guardian-Token, EN

`home-de-mobile-390x844.png` wurde vor dem Scrollen als Full-Page-Aufnahme erzeugt; deshalb waren noch nicht eingeblendete `reveal`-Bereiche transparent. Für die visuelle Bewertung ist die spätere Datei `home-de-mobile-full-after-scroll.png` maßgeblich.
