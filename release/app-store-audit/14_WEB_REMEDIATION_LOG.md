# 14 – Web-, Privacy- und Legal-Remediation-Log

**Datum:** 4. September 2026
**Status:** `MANUAL_CONFIRMATION_REQUIRED`
**Deployment:** keines
**Hinweis:** Technischer Remediation-Nachweis, keine Rechtsberatung und keine Freigabegarantie.

## 1. Ergebnis

Die lokal behebbaren Findings `WEB-P1-01`, der technische/textliche Teil von `WEB-P1-02`, `WEB-P1-03`, `WEB-P2-01`, `WEB-P2-02` und `WEB-P2-04` sind im Quellstand geschlossen und lokal geprüft. Das Release-Gate bleibt `FAIL`, bis diese Änderungen kontrolliert ausgerollt und live neu getestet sind und die manuellen P1-Nachweise vorliegen.

## 2. Vorher/Nachher

| Finding | Vorher | Lokaler Stand danach | Restgate |
|---|---|---|---|
| WEB-P1-01 Warteliste | Kein Abmeldelink in der Mail; Endpoint behielt die Zeile; keine Abmeldeseite; keine ausführbare Frist | DE/EN-Link in Text und HTML; eigener Token; explizite DE/EN-Seite; vollständige Zeilenlöschung ohne Existenzleck; tägliche 30-Tage-/Launch+6-Monate-Bereinigung | Deployment plus echter DE-/EN-E2E- und DB-Nachweis |
| WEB-P1-02 Provider/Privacy | RevenueCat-, PostHog-, OpenRouter-Metadaten und Wartelistenfelder unvollständig; Guardian-Nulung nicht fail-closed | Gepaarte DE/EN-Offenlegung; Guardian-Adresse nie gespeichert; Altzeilen-Nulung geprüft; atomare Single-use-Bestätigung; abgelaufene Requests bereinigt | Produktive Provider-/DPA-/Retention-Belege, Release-Netzwerk-Capture, App-Privacy-Abgleich |
| WEB-P1-03 ODR | Seit 2025 obsolete Plattform und Link im Impressum | Satz und Link entfernt | Live-Retest; verbliebene Schlichtungsaussage fachlich bestätigen |
| WEB-P2-01 Kontrast | 3,47:1 | 5,20:1; Lighthouse DE/EN ohne Kontrasttreffer | Live-Retest nach Deployment |
| WEB-P2-02 Overflow | DE Terms 395 px bei 390 px Viewport | 320/375/390/430 px ohne horizontalen Überlauf | Live-Retest nach Deployment |
| WEB-P2-04 Accuracy | „nicht geschätzt“ stand neben pauschalem Schätzungsdisclaimer | Referenzwerte als Datenbank-/Durchschnittswerte; Erkennung, Zuordnung, Zubereitung und Portion klar als Schätzungen | Storecopy aus demselben finalen Stand prüfen |

## 3. Warteliste und Löschung

### Mail und Abmeldung

- Bestätigung und Abmeldung verwenden unabhängige 192-Bit-Token.
- Jede derzeit implementierte DE-/EN-Wartelistenmail enthält den sprachpassenden Link sowohl im Plaintext- als auch im HTML-Teil.
- Scheitert der Versand, stellt die Function einen vorherigen Datensatz per Compare-and-swap wieder her oder löscht den von diesem Versuch neu angelegten Datensatz. Ein bestätigter Nutzer verliert dadurch nicht unbemerkt seinen letzten funktionierenden Abmeldelink.
- Die Abmeldeseite löscht nicht beim bloßen Öffnen. Erst der eindeutige Button löst die Anfrage aus; damit führen Mail-Linkscanner nicht unbeabsichtigt zur Löschung.
- Die Function löscht die gesamte Tabellenzeile. Für einen zufälligen gültig formatierten Token meldet sie denselben Erfolg, unabhängig davon, ob eine Zeile existierte.
- Die Migration löscht zuerst alle Zeilen, die der frühere Endpoint bereits als abgemeldet markiert, aber noch aufbewahrt hatte.
- Das Versand-Runbook verlangt denselben Link ausdrücklich für jede spätere Start- oder Folgenachricht.
- Anmeldung und erneuter Versand werden in einer Datenbanktransaktion begrenzt: dieselbe E-Mail höchstens einmal in zehn Minuten, dieselbe IP höchstens dreimal pro Stunde. Die Function schließt ohne gültiges Salt oder vertrauenswürdige Proxy-IP fail-closed.
- Die Rate-Limit-Tabelle enthält ausschließlich getrennt gesalzene E-Mail-/IP-Fingerprints, keine Klartextadresse. Alte Fingerprints werden spätestens nach rund drei Stunden bereinigt.

### Aufbewahrung

- Unbestätigte Einträge: höchstens 30 Tage.
- Bestätigte Einträge: spätestens sechs Monate nach dem tatsächlichen öffentlichen App-Start.
- Die Migration setzt kein erfundenes Startdatum. `private.waitlist_release_state.launched_at` startet als `NULL`.
- Ein täglicher Supabase-Cron-Job erzwingt die Fristen.

Beim tatsächlichen öffentlichen Start muss die verantwortliche Person einmalig ausführen und protokollieren:

```sql
update private.waitlist_release_state
set launched_at = now(), updated_at = now()
where singleton = true and launched_at is null;
```

## 4. Guardian-Consent

- Die Guardian-E-Mail wird nur als Argument an Resend übergeben und nicht in Kandro gespeichert.
- Beim Rollout werden von einer älteren Function eventuell noch vorhandene Guardian-Adressen unmittelbar genullt; die Bestätigungstransaktion akzeptiert ausschließlich Requests, deren Adressfeld `NULL` ist.
- Der öffentliche Endpoint weist einen deklarierten Request-Body über 4 KiB vor dem JSON-Parsing mit HTTP 413 ab.
- Die nachgelagerte Nullung bleibt als Schutz für historische Deployments bestehen. Ihr Ergebnis wird geprüft; bei Fehler wird der Request gelöscht und die Freischaltung verweigert.
- Die Bestätigung ist jetzt tatsächlich single-use: Eine Security-Definer-Funktion sperrt die passende, nicht abgelaufene Anfrage, schreibt Zeitpunkt und Notice-Version ins geschützte Profil und löscht Anfrage/Token-Hash atomar.
- Ist das Profil kein 14-/15-jähriges Profil, bleibt es gesperrt.
- Nach Erfolg existiert der Request nicht mehr; Replay liefert `invalid_token`.
- Abgelaufene offene Requests werden täglich gelöscht.
- Versandversuche werden atomar auf Nutzer-, Guardian-E-Mail- und IP-Ebene begrenzt. Nur gesalzene Fingerprints werden kurzzeitig gespeichert; die Function sendet ohne separates Guardian-Salt nicht.
- Ein fehlgeschlagener älterer Versand kann durch Compare-and-swap keinen neueren Token löschen. Anfrage- und Profilsperren verwenden bei Versand und Bestätigung dieselbe Reihenfolge, damit kein Deadlock zwischen Resend und Bestätigung entsteht.
- Die Altersgrenzen sind auch bei direkten Data-API-Updates geschützt: Ein bekanntes Profil kann weder die Guardian-Schwelle 16 noch die Analytics-Schwelle 18 in eine Richtung clientseitig überschreiten. Eine echte Altersfortschreibung oder Korrektur benötigt einen vertrauenswürdigen Service-/Supportpfad, der Einwilligung und Analyticszustand gemeinsam anpasst.

## 5. DE-/EN-Datenkarte

Beide Apptexte und die daraus generierten Webseiten nennen jetzt deckungsgleich:

- RevenueCat: Supabase-UUID als Custom App User ID; Produkt-, Kauf-, Abo- und Entitlementstatus; Wiederherstellungs-/Zuordnungszweck; keine Mahlzeiten, Körper- oder Ernährungsdaten.
- PostHog: optionale pseudonyme, lokal persistierte Distinct-/Geräte-ID; allowlist-basierte Produktinteraktionen; bereinigte Fehler; App-/OS-/SDK-Felder; Ausschalten stoppt nur künftige Events; unter 18 deaktiviert.
- OpenRouter/Azure: Prompt-/Antwortinhalt unter der konfigurierten ZDR-Strecke ohne Fallback; `store:false`; getrennte inhaltsfreie Request-Metadaten wie Zeitpunkt, Modell, Tokenanzahl und Latenz unter Anbieter-Retention; außerdem die von OpenRouter dokumentierte vorübergehende anonyme Prompt-Kategorisierung durch ein ZDR-Modell.
- Warteliste: E-Mail, Sprache, optionale `ref`-Kampagnenquelle, Zeitpunkte, getrennte Token, gesalzener IP-Hash und lokale Sprachpräferenz.
- Löschung: Accountlöschung erfasst nicht automatisch bereits gesendete PostHog-Events oder von Apple/RevenueCat aus Abrechnungs-/Wiederherstellungsgründen geführte Kaufhistorie.

## 6. UI-/Copy-Fixes

- `.microcopy` ist von `#818378` auf `#64675d` geändert.
- Rechtstextseiten brechen sehr lange Wörter/Adressen responsiv um.
- Der obsolete EU-ODR-Hinweis ist entfernt.
- BLS-Copy behauptet nicht mehr, Referenzwerte seien absolut „nicht geschätzt“: Sie werden nicht durch KI erzeugt, sind aber Datenbank-/Durchschnittswerte; Zuordnung und Portion bleiben Schätzungen.
- Beim Widerruf der optionalen Analyse leert die App zusätzlich PostHogs persistierte Event-, AI-, Capture- und Log-Warteschlangen sowie die lokale Distinct-ID. Bereits beim Anbieter eingegangene historische Events bleiben ein separates Retention-/Löschgate.

## 7. Geänderte Dateien dieses Remediation-Pakets

- `supabase/functions/waitlist/index.ts`
- `supabase/functions/guardian-consent/index.ts`
- `supabase/migrations/20260904184701_add_waitlist_retention.sql`
- `site/unsubscribe/index.html`
- `site/en/unsubscribe/index.html`
- `site/unsubscribe.js`
- `site/styles.css`
- `site/impressum/index.html`
- `site/README.md`
- `src/i18n/legal.de.ts`
- `src/i18n/legal.en.ts`
- generiert: `site/privacy/index.html`, `site/en/privacy/index.html`, `site/terms/index.html`, `site/en/terms/index.html`, `site/sources/index.html`, `site/en/sources/index.html`
- `scripts/validate-waitlist.mjs`
- `scripts/validate-privacy-consent.mjs`
- `scripts/validate-site.mjs`
- `src/services/telemetry.ts`
- `.easignore`
- `release/app-store-audit/10_LANDINGPAGE_PRIVACY_LEGAL_REPORT.md`
- `release/app-store-audit/evidence/web/02_WEB_REMEDIATION_EVIDENCE.md`
- `release/app-store-audit/14_WEB_REMEDIATION_LOG.md`

## 8. Tests

Bestanden:

```text
npm run site:legal
npm run validate:privacy
npm run validate:waitlist
npm run validate:site
npm run validate:language-routing
npm run validate:site-images
npm run typecheck
npm run verify  # Exit 0; alle Projektvalidatoren, Expo Doctor 18/18 und Web-Export
npm run db:remote:check  # Exit 0, dryRun:true, kein Push
npx esbuild supabase/functions/guardian-consent/index.ts … --outfile=/dev/null
npx esbuild supabase/functions/waitlist/index.ts … --outfile=/dev/null
git diff --check
```

Browser-/Lighthouse-Ergebnisse und Artefakte stehen in `release/app-store-audit/evidence/web/02_WEB_REMEDIATION_EVIDENCE.md`.

## 9. Verbleibende manuelle/Live-Schritte

1. Migrationen und Functions in kontrollierter Reihenfolge per Dry-run prüfen, dann nach eigener Freigabe ausrollen; Website erst danach veröffentlichen, damit Policy und Verhalten nicht auseinanderlaufen.
2. Mit kontrollierten DE- und EN-Adressen den kompletten Flow testen: Anmeldung, lokalisierte Bestätigung, Bestätigung, Abmeldung, anschließender Nachweis, dass keine DB-Zeile mehr existiert.
3. Beim tatsächlichen öffentlichen App-Start `launched_at` einmalig setzen und protokollieren; vorher `NULL` lassen.
4. Jede separat gebaute Launch-/Folgenmail muss den gespeicherten sprachpassenden Abmeldetoken verwenden.
5. Produktive DPA-, Transfer-, ZDR- und Retention-Einstellungen aller Provider verantwortet dokumentieren.
6. Release-Build mit Analytics aus/an, Foto-/Textanalyse, Kauf und Restore per Netzwerk-Capture gegen die finalen Texte prüfen.
7. App Store Connect Privacy Details aus derselben finalen Datenkarte ausfüllen und mit dem Archiv abgleichen.
8. Internationale 14+-/Guardian-Länder- und Storefrontmatrix rechtlich prüfen oder Distribution entsprechend begrenzen.
9. Supportadresse extern auf Zustellung, Spam, Reply und tragfähige Antwortzeit prüfen.
10. Hosting mit konfigurierbaren CSP-, HSTS-, `X-Content-Type-Options`-, `Referrer-Policy`- und `Permissions-Policy`-Headern wählen oder dieses offene P2 vor Einreichung bewusst lösen.
11. Nach Deployment Live-Crawl, mobile Viewports, Lighthouse und sämtliche Legal-/Waitlist-Validatoren erneut ausführen.
