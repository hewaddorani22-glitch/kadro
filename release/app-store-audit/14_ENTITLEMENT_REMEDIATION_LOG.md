# 14 – SEC-02 Entitlement-Remediation-Log

**Stand:** 4. September 2026
**Scope:** lokale Implementierung, statische/deterministische Verifikation
**Live-Änderungen:** keine; keine Migration, Function, RevenueCat-Einstellung oder Secret wurde deployed/geändert

## Ergebnis

Der direkte Gateway-Bypass des Client-Paywalls ist im lokalen Code geschlossen.
`POST /v1/analyze` und `POST /v1/describe` benötigen nun eine stabile UUID und
eine serverseitig atomar reservierte Berechtigung. Genau drei erfolgreiche
Lifetime-Free-Analysen sind ohne Abo möglich; danach nur ein serverseitig
bestätigtes `kandro_pro`-Entitlement mit bis zu 60 Foto-/Textanalysen pro
UTC-Tag. Barcode und Suche bleiben außerhalb des Ledgers kostenlos.

Status: **`MANUAL_CONFIRMATION_REQUIRED`**. Die lokale technische Korrektur ist verifiziert; die Live-Konfiguration und der physische Apple-Sandbox-Test bleiben erforderlich. Dies ist
noch kein Production-Beleg und kein Submission-Go.

## Implementierte Grenze

### Datenbank und Transaktionen

Migration `20260904185227_server_authoritative_analysis_access.sql` legt an:

- `analysis_access`: Lifetime-Free-Erfolge und gecachter RevenueCat-Status je
  Supabase-UUID;
- `analysis_requests`: UUID, `reserved|started|completed|refunded`,
  `free|pro`, Tages-/Statuszeitpunkte und kurzlebiges Ergebnis für Replay;
- `revenuecat_webhook_events`: Event-ID/-Typ/-Umgebung/-Zeit nur zur
  Deduplikation pro Event und betroffener User-ID;
- `analysis_global_usage`: atomarer serviceweiter UTC-Tages-Circuit-Breaker.

Alle Tabellen haben RLS ohne Clientpolicy und ohne `anon`-/`authenticated`-
Grant. Öffentliche invoker-rights RPC-Wrapper sind ausschließlich für
`service_role` ausführbar; die definer-rights Implementierung liegt in
`private` mit leerem `search_path`.

Jede Transition einer User-ID nimmt denselben transaction-scoped Advisory
Lock. Deshalb können parallele Requests zusammen nie mehr als drei offene plus
erfolgreiche Free-Reservierungen erzeugen. External Calls liegen außerhalb der
kurzen SQL-Transaktionen.

### Reservieren, Commit und Refund

1. Ungültige Payloads werden vor dem Ledger abgewiesen.
2. `reserve_analysis_access` liefert Replay, In-Progress, Free, Pro,
   Subscription-Required, Verification-Required oder Daily-Limit.
3. Die unabhängige bestehende `consume_analysis_quota` zählt anschließend
   jeden Provider-Versuch als Kosten-Circuit-Breaker.
4. Unmittelbar vor OpenRouter wechselt der Request auf `started`.
5. Nur ein erfolgreich strukturiertes HTTP-200-Ergebnis committet. Nur dann
   wird ein Free-Erfolg genau einmal gezählt.
6. Ungültiges/unklares Ergebnis, Quota-Fehler und Providerexception refunden
   die Access-Reservierung. Die Provider-Versuchsquota wird absichtlich nicht
   zurückgebucht.
7. Eine verlorene erfolgreiche HTTP-Antwort wird bei derselben Request-UUID
   aus Supabase wiedergegeben, ohne Provider- oder Zählerwiederholung.

Der Client zählt denselben UUID-Erfolg unmittelbar vor Anzeige des
Bestätigungsbildschirms, nicht erst beim Speichern der Mahlzeit. Abbruch auf
dem Bestätigungsbildschirm lässt Client und Server deshalb nicht
auseinanderlaufen; Replay derselben UUID bleibt lokal und serverseitig
idempotent.

Nach 15 Minuten werden verwaiste `reserved`/`started`-Zeilen freigegeben. Ein
Providererfolg mit fehlgeschlagenem Commit wird dagegen nicht sofort refunded,
damit ein DB-Ausfall keine unbegrenzte Kostenschleife erzeugt.

### RevenueCat

Die neue Function `revenuecat-webhook` läuft absichtlich ohne Supabase-JWT,
weil RevenueCat der serverseitige Caller ist. Ihre tatsächliche Authgrenze ist:

- exakt verglichener konfigurierter `Authorization`-Wert;
- `X-RevenueCat-Webhook-Signature` als HMAC-SHA256 über
  `<unix_seconds>.<raw_json_body>`;
- fünf Minuten Timestamp-Toleranz;
- maximal 64 KiB Body, HMAC-Verifikation **vor** JSON-Parsing;
- exakte interne Kandro-`app...`-ID;
- Nicht-TRANSFER-Ereignis muss Lookup-Key `kandro_pro` betreffen; TRANSFER hat
  laut RevenueCat keine `entitlement_ids` und wird separat erkannt;
- alle gültigen Supabase-UUIDs aus `transferred_from`, `transferred_to`,
  `app_user_id`, `original_app_user_id` und Aliases werden einzeln gegen den
  aktuellen REST-v2-Status geprüft;
- nur zugangsgebende Apple-App-Store-Subscriptions in Apple Sandbox oder
  Production mit exakt erlaubten internen `prod...`-, `app...`- und
  `entl...`-IDs gelten. RevenueCat Test Store/`rc_billing` gilt nie als Pro;
- Event-ID/User-ID-Dedupe. Da jedes neue Event den aktuellen REST-Zustand übernimmt
  und SQL den vor dem REST-Aufruf erfassten Observation-Zeitpunkt gegen den
  letzten Cachewert prüft, kann ein langsamer älterer Request keinen neueren
  Zustand überschreiben. Verspätete/out-of-order Renewal-/Refund-/Expiration-
  Events konvergieren.

Der Nutrition-Gateway nutzt dieselbe REST-v2-Nachprüfung, wenn Cachezustand
älter als 24 Stunden ist. Ein HTTP 404 (Customer existiert nie) ist sicher
„inaktiv“. Bei Provider-Ausfall gibt es keine Grace für unbekannte/inaktive
Konten; nur zuletzt aktiv, nicht abgelaufen und maximal 30 Stunden alt erhält
bis zu sechs Stunden Grace.

Nach einem SDK-erfolgreichen Kauf oder Restore ruft der Client zusätzlich den
authentifizierten `POST /v1/entitlement/refresh` auf und zeigt Pro erst nach
positiver Serverantwort. Weil StoreKit und RevenueCat kurz auseinanderlaufen
können, ist dieser positive Pfad auf drei Probes begrenzt: sofort, kurz für
einen eintreffenden Webhook und zuletzt sicher nach dem serverseitigen
20-Sekunden-Cooldown. Timeout oder zwei zunächst inaktive Antworten gewähren
keinen lokalen Zugang; nach dem finalen Fehlschlag bleibt „Käufe
wiederherstellen“ als sichtbarer, erneut serverseitig geprüfter Retry. Der
atomare Cooldown je Supabase-UUID verhindert RC-v2-Spam; innerhalb des
Cooldowns wird nur der bereits bestätigte Cachewert geliefert. Expo Go/Test
Store simuliert damit lediglich Kauf-UI und schaltet Hosted Pro nicht frei.
TestFlight/App Review nutzt Apple Sandbox.

Nach dem bestehenden Per-User-Versuchslimit zählt
`GLOBAL_ANALYSIS_DAILY_LIMIT` jeden tatsächlich bevorstehenden Provideraufruf
atomar über alle Konten. Bei Erreichen oder DB-Fehler wird fail-closed vor
OpenRouter abgebrochen und die Access-Reservierung refunded.

### Retention und Logging

- `result_json` enthält strukturierte Nährwertdaten und ist deshalb D-37 im
  Datenschutzinventar. Nie gespeichert werden Foto/Base64, Beschreibung,
  Prompt, Provider-Rohbody oder Webhook-Rohbody.
- Ein globaler stündlicher `pg_cron`-Job leert Resultate ab 22 Stunden. Die
  zweistündige Sicherheitsmarge hält die Speicherung auch bei einem
  verzögerten Stundenlauf unter 24 Stunden.
- Ergebnisfreie Request-Tombstones: 30 Tage; Webhook-Event-ID-Metadaten: 90
  Tage; Access-Zähler/-Status: bis Accountlöschung. Alle Userzeilen cascaden
  bei `auth.users`-Löschung.
- Gateway und Webhook loggen ausschließlich feste Fehlercodes. Kein Body,
  Prompt, Ergebnis, User-ID, Authorization-Header oder Signature-Header wird
  protokolliert.

## Lokale Verifikation

`scripts/validate-entitlements.mjs` führt ohne Secrets/Netzwerk deterministisch
aus:

- valide HMAC, manipulierten Body, falsche Authorization und >5-Minuten-
  Timestamp;
- falsche App, irrelevantes/malformed Entitlement-Event und Multi-UUID-Aliases;
- normaler Webhook und TRANSFER über beide Seiten, inklusive originaler ID und
  Aliases;
- bounded Kauf-/Restore-Bestätigung mit der Folge inaktiv, inaktiv, aktiv; die
  letzte Probe liegt nach dem 20-Sekunden-Refresh-Cooldown;
- Apple Production **und** Apple Sandbox aktiv, RevenueCat Test Store,
  fremde App/Produkt/Entitlement und abgelaufener Zeitraum inaktiv;
- statische Invarianten für RLS/Grants, Advisory Lock, 3er-Grenze, Pro-
  Tageslimit, Freshness/Grace, Replay/Commit/Refund, globalen Retention-Cron,
  Handler-Reihenfolge, atomaren globalen Circuit-Breaker, Refresh-Cooldown,
  Serverbestätigung vor Pro-UI sowie stabile Client-/Queue-UUID.
- Serverdefault, Edge-Env-Vorlage und englische/deutsche Kauf-Copy nennen
  konsistent 60 Analysen pro Tag und enthalten kein „unlimited“/„unbegrenzt“.

Ausgeführt am 4. September und im finalen Gesamtlauf am 5. September 2026:

- `npm run validate:entitlements`, `validate:allowance`,
  `validate:subscription`, `validate:supabase`, `validate:analysis-language`,
  `validate:privacy` und `validate:state-integrity`: Exit 0;
- `npm run typecheck`: Exit 0;
- `npm run verify`, einschließlich Expo Doctor und Web-Export: Exit 0;
- TypeScript-/Deno-kompatible Quellprüfung der sicherheitsrelevanten Edge-
  Entrypoints sowie `node --check` der MJS-Validatoren einschließlich
  Provider-Ratenlimits: Exit 0;
- finaler Lauf `npm run db:remote:check`: Exit 0 und `dryRun:true`; exakt
  `20260904184701_add_waitlist_retention.sql`,
  `20260904185227_server_authoritative_analysis_access.sql` und
  `20260904212500_rate_limit_nutrition_providers.sql` würden angewendet. Der
  Dry-run nahm keine Remoteänderung vor; siehe
  `evidence/network/23_final_supabase_dry_run.log`.

Eine echte SQL-Ausführung war lokal mangels Docker/Postgres nicht möglich; der
Remote-Dry-run parst die neue Migration ebenfalls nicht vollständig. Deshalb
ersetzt keine lokale grüne Prüfung den Staginglauf.

## Zwingende manuelle Live-Gates

Diese Reihenfolge beibehalten und keine Secretwerte in Tickets/Logs kopieren:

1. Im RevenueCat-Account bestätigen, dass der aktuelle **Pro**-Tarif aktiv ist
   und Webhooks einschließlich HMAC angeboten werden. RevenueCat dokumentiert
   Webhooks als Pro-Integration; die aktuelle Preisübersicht nennt einen
   kostenlosen Start bis zur dort veröffentlichten MTR-Grenze.
2. Einen RevenueCat API-v2-Key nur mit
   `customer_information:subscriptions:read` für das Kandro-Projekt erzeugen.
3. Interne IDs gegen das Dashboard/API prüfen: Projekt `proj...`, iOS-App
   `app...`, Entitlement-Ressource `entl...` und die erlaubten iOS-
   Produktressourcen `prod...`; der sichtbare Lookup-Key bleibt exakt
   `kandro_pro`.
4. App-spezifischen Webhook auf
   `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/revenuecat-webhook`
   konfigurieren. Sandbox und Production (oder getrennte Integrationen),
   langen zufälligen Authorization-Wert und HMAC Signing aktivieren. Den nur
   einmal angezeigten Signing-Secret sicher ablegen.
5. Die beiden Rate-Limit-Salts `NUTRITION_RATE_LIMIT_SALT` und
   `GUARDIAN_RATE_LIMIT_SALT` sowie sieben server-only RevenueCat-Secrets aus
   `supabase/.env.gateway.example` setzen:
   `REVENUECAT_PROJECT_ID`, `REVENUECAT_APP_ID`,
   `REVENUECAT_ENTITLEMENT_RESOURCE_ID`,
   `REVENUECAT_IOS_PRODUCT_RESOURCE_IDS`, `REVENUECAT_SECRET_API_KEY`,
   `REVENUECAT_WEBHOOK_AUTHORIZATION`,
   `REVENUECAT_WEBHOOK_SIGNATURE_SECRET`. Niemals `EXPO_PUBLIC_`.
6. `GLOBAL_ANALYSIS_DAILY_LIMIT` aus dem verantwortbaren Tagesbudget setzen;
   im OpenRouter-Dashboard zusätzlich einen harten monatlichen Spend-Cap und
   Warnschwellen aktivieren.
7. Unter RevenueCat Sandbox Testing Access für den loginlosen App-Review-Flow
   bewusst `Anybody` verwenden. Ein Reviewer bekommt eine neue anonyme
   Supabase-UUID, die nicht vorab allowlistbar ist; `Allowed App User IDs only`
   würde daher auch einen echten Apple-Sandbox-Kauf blockieren. Die
   serverseitige Prüfung auf `store=app_store` und exakte interne App-, Produkt-
   und Entitlement-IDs bleibt die Sicherheitsgrenze und sperrt RevenueCat Test
   Store/`rc_billing` auch bei `Anybody`. Eine UUID-Allowlist erst verwenden,
   wenn ein stabiler Reviewer-Account/UUID-Flow existiert.
8. Erst exakt alle drei oben genannten Migrationen anwenden, danach
   `nutrition`, `guardian-consent` und `revenuecat-webhook` gemeinsam aus
   demselben Commit deployen. `revenuecat-webhook` muss live
   `verify_jwt=false`, `nutrition` `verify_jwt=true` zeigen. Die geänderte
   `waitlist`-Function wird separat, aber atomar mit der neuen Website und den
   Abmeldeseiten veröffentlicht und getestet.
9. Sandbox/TestFlight plus direkte HTTP-Negativtests dokumentieren:
   - genau drei erfolgreiche Free-Analysen, vierte `402`;
   - ungültige/unklare/providerfehlgeschlagene Anfrage verbraucht keinen Free-
     Erfolg, erhöht aber nach Providerkontakt die Versuchsquota;
   - gleiche Request-ID seriell und parallel: genau ein Providererfolg/Commit;
   - Kauf und Restore erlauben; Ablauf, Refund und falsches Entitlement sperren;
   - RevenueCat Test Store bleibt gesperrt; Apple Sandbox/Production bestehen;
   - normaler, doppelter, out-of-order und TRANSFER-Webhook über beide UUID-
     Seiten konvergiert;
   - fehlende/falsche/stale HMAC sowie falsche App/UUID werden abgewiesen;
   - RevenueCat-Ausfall: nie-zahlend gesperrt, gültig zuletzt-zahlend nur in
     dokumentierter Grace;
   - nach Retention-Lauf kein `result_json` >=24 h; Tombstone/Event-Purge und
     Account-Cascade belegt;
   - Supabase-Logs enthalten keine Payload/UUID/Secrets.
10. Datenschutzerklärung und App Store Connect mit D-37/D-38 abgleichen, bevor
   der neue Serverpfad live für Submission genutzt wird.

## Restrisiken

- Eine neue anonyme Supabase-UUID erhält erneut drei Gratiserfolge. Das lässt
  sich ohne stärkere Identität nicht vollständig verhindern. Der globale
  Circuit-Breaker und Provider-Spend-Cap begrenzen den Schaden; App Attest /
  DeviceCheck oder verifizierte Identität bleiben die langfristige Lösung.
- Der Client zeigt weiterhin einen lokalen Restzähler für sofortiges UX. Der
  Server ist autoritativ; bei Reinstall/abweichendem Zustand antwortet er mit
  Paywall bzw. Limit.
- RevenueCat- und Apple-Aufbewahrung/Accountlöschung bleiben eigenständige
  offene Datenschutz-Gates.
- Ein finales Submission-Archiv, Netzwerk-Capture und App-Store-Sandboxbeleg
  fehlen weiterhin.

## Quellen

- [RevenueCat: Webhooks, Authorization, HMAC und Retry](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat: Event Types and Fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)
- [RevenueCat API v2: Customer Subscriptions](https://www.revenuecat.com/docs/api-v2/customer/resources)
- [RevenueCat: Sandbox Testing Access](https://www.revenuecat.com/docs/projects/sandbox-access)
- [RevenueCat Pricing](https://www.revenuecat.com/pricing)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
