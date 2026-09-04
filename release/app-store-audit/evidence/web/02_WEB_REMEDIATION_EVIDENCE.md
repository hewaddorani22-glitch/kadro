# Web-/Privacy-Remediation: lokale Evidenz

> **Historischer Zwischenstand vom 4. September 2026:** Die unten genannte Zahl
> von zwei ausstehenden Migrationen war für diesen Lauf korrekt. Sie ist durch
> den finalen Dry-Run in
> `evidence/network/23_final_supabase_dry_run.log`
> überholt; dort sind exakt drei ausstehende Migrationen belegt.

**Datum:** 4. September 2026
**Stand:** nicht committed, nicht deployt
**Geltungsbereich:** lokaler Arbeitsbaum; keine Aussage über das weiterhin öffentlich erreichbare Live-System

## Automatisierte Prüfungen

| Befehl | Ergebnis |
|---|---|
| `npm run site:legal` | Exit 0; DE-/EN-Privacy-Seiten aus den App-Wörterbüchern neu erzeugt |
| `npm run validate:privacy` | Exit 0; Guardian-Fail-Closed, atomare Tokenkonsumierung, Provider-Offenlegung und Minderjährigen-Gates geprüft |
| `npm run validate:waitlist` | Exit 0; getrennte Token, Mail-Abmeldelink, vollständige Löschung, Antwort ohne Existenzleck, Fristen und Cron geprüft |
| `npm run validate:site` | Exit 0; 17 Seiten, Links, Canonicals, Hreflang und Legal-Parität geprüft |
| `npm run validate:language-routing` | Exit 0 |
| `npm run validate:site-images` | Exit 0; 10 Landingpage-Screenshots |
| `npm run typecheck` | Exit 0 |
| `npm run verify` | Exit 0; gesamter Projektprüflauf bestanden, einschließlich aller Validatoren, Expo Doctor 18/18 und produktionsnahem Web-Export |
| `npm run db:remote:check` | Exit 0; `dryRun:true`; würde ausschließlich die zwei ausstehenden Migrationen `20260904184701` und `20260904185227` anwenden; kein Push |
| `npx esbuild …guardian-consent…` und `…waitlist…` mit `--outfile=/dev/null` | Exit 0; beide Edge-Function-Einstiegspunkte syntaktisch gebündelt, kein Artefakt geschrieben |
| `git diff --check` | Exit 0 |

## Lokaler Browsernachweis

Ein lokaler statischer Server wurde nur für den Test verwendet und danach beendet.

- DE- und EN-Abmeldeseite bei 390 px: sichtbare, eindeutige Bestätigung; kein horizontaler Überlauf; sprachpassende Texte.
- Sprachwechsel DE ↔ EN bewahrt einen syntaktisch gültigen 48-Hex-Abmeldetoken.
- Fehlender/ungültiger Token: Formular verborgen, lokalisierte Fehlermeldung, kein Netzwerkaufruf.
- Deutsche Bedingungen bei 320, 375, 390 und 430 px: `scrollWidth === clientWidth`.
- Hero-Microcopy bei 390 px: berechnete Farbe `rgb(100, 103, 93)` (`#64675d`).

Screenshots:

- `release/app-store-audit/evidence/web/unsubscribe-de-local-390.png`
- `release/app-store-audit/evidence/web/unsubscribe-en-local-390.png`

## Lighthouse-Nachweis

Lighthouse 12.8.2 wurde gegen die lokale DE- und EN-Startseite ausgeführt.

| Variante | Accessibility | Best Practices | `color-contrast`-Treffer |
|---|---:|---:|---:|
| DE | 1,00 | 1,00 | 0 |
| EN | 1,00 | 1,00 | 0 |

Artefakte:

- `release/app-store-audit/evidence/web/lighthouse-home-de-after.json`
- `release/app-store-audit/evidence/web/lighthouse-home-en-after.json`

## Datenbank-/Edge-Function-Grenzen im Quellstand

- Abmeldung löscht die vollständige `public.waitlist`-Zeile anhand eines eigenen zufälligen Tokens.
- Ein von Resend abgewiesener Versand wird kompensiert: Vorwerte werden nur dann wiederhergestellt, wenn beide von diesem Versuch gesetzten Token noch aktuell sind; bei einem ersten Versuch wird genau diese neue Zeile entfernt.
- Beim Ausrollen entfernt die Migration auch historische Zeilen, die der frühere Endpoint nur als abgemeldet markiert hatte.
- Ein unbekannter, aber syntaktisch gültiger Abmeldetoken erhält dieselbe 200-Antwort wie ein vorhandener Token.
- `private.purge_waitlist()` löscht unbestätigte Zeilen nach 30 Tagen. Für bestätigte Zeilen beginnt die Sechsmonatsfrist erst nach einem tatsächlich vom Verantwortlichen gesetzten `launched_at`; der Migrationsstand ist bewusst `NULL`.
- Guardian-Bestätigung ruft `public.consume_guardian_consent` ausschließlich mit Service-Rolle auf. Die private Funktion sperrt die Anfrage, aktualisiert das geschützte Profil und löscht die Anfrage samt Token-Hash in einer Transaktion.
- Der erfolgreiche Guardian-Pfad löscht sofort; ein täglicher `pg_cron`-Job entfernt abgelaufene, nicht bestätigte Anfragen.
- Das zusätzliche Nullungs-Update für historische Guardian-Zeilen wird geprüft. Bei Fehler wird die Anfrage gelöscht und nicht freigeschaltet.
- Die Migration nullt eventuell noch vorhandene Adressen aus älteren Versionen; die atomare Bestätigungsfunktion akzeptiert nur Requests, deren `guardian_email` bereits `NULL` ist.
- Ein deklarierter Guardian-Request-Body über 4 KiB wird vor dem JSON-Parsing abgewiesen.

Der verknüpfte Supabase-Dry-run war erfolgreich und hat keine Änderung vorgenommen. Er meldet beide erwarteten ausstehenden Migrationen. Die Migration wurde in diesem Remediation-Lauf nicht gegen die Live-Datenbank ausgeführt; SQL-Anwendung, Cron-Lauf und echte Zeilenlöschung sind daher bewusst noch kein Live-Nachweis.

## Primärquellen für die präzisierten Providertexte

- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase pg_cron-Installation/Rollen: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/cron/install.mdx
- OpenRouter Data Collection: https://openrouter.ai/docs/guides/privacy/data-collection
- OpenRouter Zero Data Retention: https://openrouter.ai/docs/guides/features/zdr
- RevenueCat Custom App User IDs: https://www.revenuecat.com/docs/customers/identifying-customers
- PostHog Identify/Distinct IDs: https://posthog.com/docs/product-analytics/identify

## Nicht als bestanden gewertet

- Kein Deployment und kein Produktionsdatenbank-Schreibtest.
- Kein echter DE-/EN-Mail-Rundlauf mit kontrollierten Adressen.
- Keine manuelle Bestätigung der produktiven DPA-, Transfer- und Retention-Einstellungen der Anbieter.
- Kein Abgleich der finalen App-Privacy-Antworten in App Store Connect.
- Keine internationale rechtliche Freigabe des 14+-/Guardian-Modells.
- Keine externe Send/Receive/Reply-Prüfung der Supportadresse.
- Fehlende Browser-Sicherheitsheader auf dem aktuellen GitHub-Pages-Hosting bleiben offen.
