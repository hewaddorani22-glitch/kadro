# getkandro.com

Statische Website. Kein Build, keine Abhängigkeiten: die Dateien sind das
Deployment.

**Live:** https://hewaddorani22-glitch.github.io/kadro/
**Live:** https://getkandro.com

Jeder Push auf `main`, der `site/` berührt, deployt automatisch über
`.github/workflows/pages.yml`. Nichts manuell hochladen.

## Warum es die Seite geben muss

App Store Connect verlangt zwei öffentlich erreichbare URLs als Pflichtfelder,
und die App verweist im Datenschutz und in den Bedingungen darauf:

| Seite | Zweck |
|---|---|
| `/privacy` | Privacy Policy URL in App Store Connect, Pflichtfeld |
| `/support` | Support URL in App Store Connect, Pflichtfeld, muss echten Kontakt enthalten |
| `/terms` | EULA-Verweis auf der Paywall |
| `/impressum` | § 5 DDG, Pflicht für gewerbliche Anbieter in Deutschland |

## Die Rechtstexte nicht von Hand bearbeiten

`/privacy`, `/terms`, `/sources` und ihre englischen Gegenstücke unter `/en/`
werden aus den Wörterbüchern der App erzeugt:

```
src/i18n/legal.de.ts  →  site/privacy|terms|sources/index.html
src/i18n/legal.en.ts  →  site/en/privacy|terms|sources/index.html
```

Text ändern heißt: die `.ts`-Datei ändern und `npm run site:legal` laufen
lassen. `npm run verify` bricht ab, wenn die HTML-Dateien nicht mehr zur App
passen: lokal und in der CI.

Die Anbieterangaben kommen aus `EXPO_PUBLIC_LEGAL_*`. Sie stehen deshalb auch
im CI-Workflow: nach § 5 DDG sind sie ohnehin öffentlich und stehen im
Impressum, und ohne sie könnten die Seiten nicht erzeugt werden.

Vorher stand hier „ändere beide von Hand". Das hat nicht funktioniert: die
Website sprach von „Account-ID", die App von „Supabase-IDs", und § 4 hatte in
beiden eine andere Überschrift. Genau so eine Abweichung fällt im Review auf.

## Zweisprachigkeit

Deutsch liegt in der Wurzel, Englisch unter `/en/`. Jede übersetzte Seite trägt
`canonical` plus `hreflang` für `de`, `en` und `x-default` (Standard ist die
deutsche Seite). `npm run validate:site` prüft, dass jeder interne Link
auflöst und die Sprachpaare aufeinander zeigen.

Das Impressum bleibt bewusst nur auf Deutsch: § 5 DDG ist deutsches Recht und
die Pflichtangaben sind an die deutschen Begriffe gebunden.

## Live-Domain prüfen

DNS, GitHub Pages und HTTPS sind für `getkandro.com` eingerichtet. Nach einem
Deployment müssen die öffentlichen Review-URLs weiterhin geprüft werden:

```bash
curl -sI https://getkandro.com/privacy | head -1
```

Muss `HTTP/2 200` liefern. Dasselbe gilt für `/support`, `/terms`, `/sources`
und die englischen Seiten unter `/en/`, bevor die URLs in App Store Connect
eingetragen werden.

## Warteliste vor dem Start

Anmeldungen laufen über die Edge Function `waitlist` und landen in der Tabelle
`public.waitlist` bei Supabase in der EU. Kein E-Mail-Dienstleister hält die
Liste: nur den Versand.

**Damit das Formular überhaupt erscheint**, brauchen die Function-Secrets im
Supabase-Dashboard (Edge Functions → waitlist → Secrets) drei Werte:

| Secret | Woher |
|---|---|
| `RESEND_API_KEY` | resend.com, kostenlos: 3.000 Mails/Monat, 100/Tag. Vorher `getkandro.com` dort verifizieren (drei DNS-Einträge). |
| `WAITLIST_FROM` | Die verifizierte Absenderadresse, z. B. `Kandro <hallo@getkandro.com>` |
| `WAITLIST_IP_SALT` | Beliebige lange Zufallszeichenkette |

Solange sie fehlen, antwortet `/status` mit `accepting: false`, das Formular
bleibt unsichtbar und nur der Discord-Button steht da. Das ist Absicht: eine
Adresse, der man keine Bestätigung schicken kann, darf man auch nicht sammeln.

Der öffentliche Endpunkt begrenzt Anmeldeversuche atomisch auf eine Nachricht
je E-Mail-Adresse in zehn Minuten und drei Versuche je Netzwerk in einer
Stunde. Die dafür getrennt gespeicherten gesalzenen Hashwerte werden durch
einen stündlichen Job spätestens nach drei Stunden gelöscht. Eine bereits
bestätigte Adresse erhält bei erneuter Eingabe keine weitere Bestätigungsmail;
die Antwort bleibt absichtlich identisch, damit das Formular keine Adressen
verrät. Fehlt der IP-Header oder das Salt, wird fail-closed nichts versendet.

Der Discord-Invite steht in `site/community.js`. Solange er leer ist, bleibt
auch dieser Button verborgen.

## Elternzustimmungs-E-Mails

Die Edge Function `guardian-consent` nutzt ebenfalls `RESEND_API_KEY` und,
solange `GUARDIAN_CONSENT_FROM` nicht gesetzt ist, `WAITLIST_FROM`. Production
braucht zusätzlich ein unabhängiges `GUARDIAN_RATE_LIMIT_SALT`. Die Function
erlaubt atomisch eine Zustellung je App-Account in zehn Minuten, höchstens drei
je Elternadresse in einer Stunde und zehn je Ausgangsnetzwerk in einer Stunde.
Gespeichert werden dafür nur getrennt gesalzene Fingerprints; ein stündlicher
Job löscht sie spätestens nach drei Stunden. Fehlen Mail-Konfiguration, Salt
oder eine vertrauenswürdige Proxy-Adresse, wird vor der Token-Erzeugung nichts
versendet.

### Die Liste beim Start abrufen

```sql
select email, language, unsubscribe_token, confirmed_at
from public.waitlist
where confirmed_at is not null
order by confirmed_at;
```

Nur bestätigte Adressen anschreiben. Unbestätigte sind nach § 7 UWG kein
gültiges Einverständnis, und genau dafür gibt es die beiden Zeitstempel.
Abmeldungen löschen den vollständigen Datensatz sofort; deshalb gibt es in der
Versandabfrage keinen dauerhaften Abmelde- oder Sperrdatensatz.

**Jede** Start- oder Folgenachricht muss den zur gespeicherten Sprache
passenden persönlichen Abmeldelink enthalten:

```text
de: https://getkandro.com/unsubscribe/?t=<unsubscribe_token>
en: https://getkandro.com/en/unsubscribe/?t=<unsubscribe_token>
```

### Tatsächlichen Start für die Aufbewahrungsfrist festhalten

Die Migration erfindet kein Startdatum. Sobald die App tatsächlich öffentlich
gestartet ist, muss die verantwortliche Person diesen Zeitpunkt genau einmal
setzen:

```sql
update private.waitlist_release_state
set launched_at = now(), updated_at = now()
where singleton = true and launched_at is null;
```

Der tägliche Datenbankjob löscht unbestätigte Einträge nach 30 Tagen und alle
verbleibenden bestätigten Einträge spätestens sechs Monate nach diesem
tatsächlichen Startzeitpunkt.
