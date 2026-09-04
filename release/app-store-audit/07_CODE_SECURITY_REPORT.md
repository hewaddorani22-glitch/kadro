# 07 – Code- und Security-Bericht

Stand: 5. September 2026
Audit-Basis: Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5` plus lokal verifizierte SEC-01-/SEC-02-/SEC-05-/SEC-08-Remediation aus `14_WEB_REMEDIATION_LOG.md`, `14_ENTITLEMENT_REMEDIATION_LOG.md` und den verlinkten Testartefakten
Scope: Expo-Client, lokaler Development-Gateway, Supabase-Konfiguration/Migrationen/Edge Functions, Secrets, Storage, Logging, Netzwerk und geschäftskritische Servergrenzen

## Ergebnis

Status: **FAIL**. Es wurde kein hartkodiertes Produktionssecret in aktuellem Git-Bestand oder Git-Historie gefunden. Auth/RLS und Löschung sind grundsätzlich sauber aufgebaut, und Production-Variablen liegen serverseitig bzw. als zulässige öffentliche Clientwerte in EAS. SEC-01, SEC-02, SEC-05 und SEC-08 wurden im Arbeitsbaum minimalinvasiv behoben und lokal verifiziert. Der abschließende adversariale statische Re-Audit fand keine verbleibenden statischen P0/P1-Codebefunde. Das signierte Build-7-IPA bestand außerdem den statischen Signatur-/Provisioning-/Bundle-Scan: App-Store-Profil, `get-task-allow=false`, ATS ohne beliebige Loads, keine Provider-Secrets und keine operative Development-URL. Die korrigierten Serverpfade sind jedoch noch nicht live:

1. Drei Migrationen, `NUTRITION_RATE_LIMIT_SALT`, `GUARDIAN_RATE_LIMIT_SALT` und sieben RevenueCat-Serversecrets stehen aus. Die technischen Review-Grenzen `nutrition`, `guardian-consent` und `revenuecat-webhook` müssen deployed und live getestet werden; die geänderte `waitlist`-Function muss zusätzlich gemeinsam mit Website/Waitlist ausgerollt werden. Sandbox-, Transfer-, Grenzwert- und direkte Bypass-Tests fehlen. Der derzeit deployte Gateway darf deshalb nicht als server-authoritative oder provider-ratelimited belegt werden.

Hinzu kommen P2-Risiken bei fehlenden Netzwerk-Deadlines und lokal gespeicherten Tokens/fehlgeschlagenen Fotos. Es wurde ausdrücklich nichts deployed und kein Live-Secret gesetzt.

## Finding-Übersicht

| ID | Prio | Typ | Status | Betroffene Grenze |
|---|---:|---|---|---|
| SEC-01 | P1 | PRIVACY/LOGGING | FIXED_VERIFIED | OpenRouter → Edge Function → Supabase Logs |
| SEC-02 | P1 | AUTHORIZATION/BILLING/ABUSE | FIXED_VERIFIED | RevenueCat/Free Allowance → bezahlter Nutrition-Gateway; Live-Gate separat offen |
| SEC-03 | P2 | NETWORK/AVAILABILITY | FAIL | Client- und Server-Fetches ohne Deadline |
| SEC-04 | P2 | DATA_AT_REST/RETENTION | MANUAL_CONFIRMATION_REQUIRED | AsyncStorage, Supabase-Session, lokale Foto-Retry-Queue |
| SEC-05 | P3 | TOKEN_LIFECYCLE | FIXED_VERIFIED | Waitlist Double-Opt-in-/Abmeldetoken; Live-Gate separat offen |
| SEC-06 | P3 | DEVELOPMENT_EXPOSURE | FAIL | lokaler secret-bearing Gateway im LAN |
| SEC-07 | P3 | INPUT/RESOURCE_LIMIT | FAIL | Edge `request.json()` vor eigener Größenprüfung |
| SEC-08 | P1 | AVAILABILITY/ABUSE/PROVIDER_QUOTA | FIXED_VERIFIED | kostenlose USDA-/OFF-Wege und RevenueCat REST; Live-Gate separat offen |

## SEC-01 – Provider-Fehlerbody wird geloggt

- **Priorität/Typ:** P1 HIGH, Privacy/Logging
- **Status:** FIXED_VERIFIED
- **Ursprünglicher Code:** `supabase/functions/nutrition/index.ts` las bei nicht erfolgreicher OpenRouter-Antwort den rohen Body, hängte bis zu 300 Zeichen an die Exception und schrieb diese Exception in die Edge-Logs. Der lokale Gateway bildete dieselbe body-bearing Exception, loggte sie aber nicht.
- **Remediation:** `supabase/functions/nutrition/index.ts` und `server/index.mjs` übernehmen nur noch `provider_HTTPSTATUS`, ohne den Body überhaupt zu lesen. `supabase/functions/_shared/nutrition.mjs` lässt ausschließlich feste Setupcodes bzw. streng formatierte Provider-/Statuscodes zu; jeder andere Error einschließlich einer body-bearing Nachricht kollabiert auf `gateway_unexpected_error` bzw. ein `SyntaxError` auf `provider_response_invalid`. Die Edge Function loggt ausschließlich diesen Code.
- **Regression:** `scripts/validate-privacy-consent.mjs` verbietet `response.text()` in beiden Gateways, erzwingt den Safe-Code-Log-Aufruf und führt den Sanitizer gegen eine synthetische Nachricht mit Mahlzeit-/Authorization-Fragment sowie gegen SyntaxError und regulären HTTP-Status aus.
- **Verifikation:** `npm run validate:privacy` Exit 0; `npm run typecheck` Exit 0; `node --check` für beide Shared/Server-Dateien Exit 0; vollständiges `npm run verify` Exit 0 (alle Validatoren, Expo Doctor 18/18, Webexport).
- **Deployment:** bewusst nicht ausgeführt. Vor Production die Funktion deployen, denselben synthetischen Failure in Staging auslösen und Supabase-Log-Capture prüfen.
- **Restrisiko:** HTTP-Status/Providercode sind operationale Metadaten. Unbekannte Fehlermeldungen werden nicht mehr geloggt. Remote Log-Retention/Zugriff bleiben separat zu dokumentieren.

## SEC-02 – Paywall und Lifetime-Free-Limit sind clientseitig umgehbar

- **Priorität/Typ:** P1 HIGH, Authorization/Billing/Abuse
- **Status:** FIXED_VERIFIED
- **Release-Grenze:** Live-Migration, Secrets, Function-Deploy und Apple-Sandbox-E2E sind separat offen.
- **Code:** `supabase/migrations/20260904185227_server_authoritative_analysis_access.sql`; `supabase/migrations/20260904212500_rate_limit_nutrition_providers.sql`; `supabase/functions/_shared/revenuecat.mjs`; `supabase/functions/revenuecat-webhook/index.ts`; `supabase/functions/nutrition/index.ts`; `src/utils/requestId.ts`; `src/services/{mealAnalysis,serverEntitlement,localRepository}.ts`; `src/context/{AppContext,SubscriptionContext}.tsx`; `scripts/{validate-entitlements,validate-analysis-allowance,validate-provider-rate-limits}.mjs`
- **Remediation:** `analysis_access` und `analysis_requests` sind RLS-geschützt, ohne Clientgrants/-policies. Eine service-role-only RPC serialisiert alle Transaktionen einer User-ID mit einem transaction-scoped Advisory Lock. Sie reserviert höchstens drei gleichzeitig offene/erfolgreiche Lifetime-Free-Analysen, erkennt dieselbe Request-UUID, begrenzt Pro pro UTC-Tag und erlaubt Pro nur mit frischem aktiven Entitlement. Nur ein erfolgreiches strukturiertes Ergebnis erhöht `free_completed`; ungültige/unklare/providerfehlgeschlagene Ergebnisse werden refunded. Der Client zählt dieselbe erfolgreiche AI-Antwort anhand derselben UUID bereits vor dem optionalen Speichern, sodass UI und Server nicht durch Abbruch im Bestätigungsbildschirm auseinanderlaufen. Die getrennte bestehende `analysis_usage`-Quota zählt Provider-Versuche weiter; ein atomarer, nicht nutzerbezogener globaler UTC-Zähler stoppt standardmäßig ab 1.000 Providerstarts pro Tag.
- **Idempotenz:** Foto und Beschreibung senden eine UUIDv4; Offline-Queue/Retries behalten dieselbe ID, alte `scan-<timestamp>`-Queueeinträge werden einmalig migriert. `reserved → started → completed/refunded` ist atomar. Ein erfolgreiches Response wird zur verlustfreien Wiederholung kurz in `result_json` gehalten; der Gateway antwortet bei gleicher ID ohne neuen Provideraufruf. Fotos, Base64, Beschreibung, Prompt und Provider-Rohbody werden dort nie gespeichert.
- **Retention:** Ein globaler stündlicher `pg_cron`-Job leert `result_json` ab 22 Stunden. Die zweistündige Sicherheitsmarge hält die Speicherung auch bei einem verzögerten Stundenlauf unter 24 Stunden. Ergebnisfreie Request-Tombstones werden nach 30 Tagen und Webhook-Event-IDs nach 90 Tagen gelöscht; Accountlöschung cascadiert alles. Dateninventar D-37/D-38 dokumentiert diese neue Verarbeitung.
- **RevenueCat:** Der server-to-server Webhook verlangt einen exakt verglichenen Authorization-Wert **und** RevenueCats `X-RevenueCat-Webhook-Signature` (HMAC-SHA256 über `<unix_seconds>.` plus unveränderte Raw-Body-Bytes, 5-Minuten-Toleranz), bevor UTF-8 dekodiert oder JSON geparst wird. Der REST-v2-Abgleich liest `customers/{uuid}/subscriptions?limit=100` und akzeptiert ausschließlich `store=app_store`, `environment=production|sandbox`, `gives_access=true`, einen zugangsgewährenden Subscription-Status sowie die exakte interne iOS-App-ID, erlaubte Monats-/Jahres-Produkt-IDs und interne Entitlement-ID. RevenueCat Test Store/`rc_billing` fällt damit fail-closed aus. Reguläre Nicht-`APP_STORE`-Webhooks werden ignoriert. TRANSFER besitzt keine `entitlement_ids` und bleibt als store-unabhängiger Reconciliation-Trigger relevant; der Handler prüft deshalb bis zu acht eindeutige UUIDs aus `transferred_from`, `transferred_to`, App User ID, Original-ID und Aliases jeweils gegen den aktuellen REST-Zustand. Dedupliziert wird pro `(event_id,user_id)`; bereits gelöschte Nutzer werden ignoriert. Ein vor dem REST-Aufruf erfasster Observation-Zeitpunkt verhindert, dass ein langsamer älterer Request einen neueren Cachewert überschreibt. Bodylimit 64 KiB; Logs enthalten nur einen festen Fehlercode, nie Payload, UUID, Header oder Signatur.
- **Kauf-/Restore-Aktualität:** Nach erfolgreichem nativen Kauf oder Restore fordert der Client `POST /v1/entitlement/refresh` mit User-JWT an und zeigt Pro erst nach positiver Serverantwort. Eine service-only, atomare 20-Sekunden-Cooldown-RPC pro User verhindert REST-Spam. Damit bleibt ein frischer Kauf nicht bis zum 24-Stunden-Cache oder Webhook verzögert.
- **Stale Policy:** `active`/`trialing` benötigt ein zukünftiges Periodenende. `in_grace_period`/`unknown` ohne zukünftiges Periodenende wird höchstens 15 Minuten aktiv gecacht; die synthetische Ablaufzeit erzwingt danach sofortige REST-Nachprüfung statt eines 24-Stunden-Lockouts. Reguläre bestätigte Zustände sind 24 Stunden frisch. Bei RevenueCat-Ausfall gibt es keine Freigabe für unbekannte/inaktive/abgelaufene Konten; nur ein zuvor bestätigt aktiver, nicht abgelaufener Zustand kann bis höchstens 30 Stunden nach letzter Prüfung die dokumentierte sechs Stunden Grace erhalten. 404/nie vorhandener Customer ist inaktiv.
- **Ehrliche Kaufdarstellung:** Der Gateway begrenzt Pro standardmäßig auf 60 Foto-/Textanalysen pro UTC-Tag. Alle vorherigen „unlimited“-/„unbegrenzt“-Aussagen in Plan, Profil und Paywall wurden durch „bis zu 60 pro Tag“ ersetzt. `validate:entitlements` bindet UI-Copy, Serverdefault und dokumentierte Edge-Konfiguration an denselben Wert; eine spätere Live-Konfigurationsänderung erfordert gleichzeitig neue Store-/App-Copy.
- **Lokale Verifikation:** `npm run validate:entitlements` prüft echte HMAC-Berechnung, Bodymanipulation, falsche Authorization, stale Timestamp, App-/Entitlement-/Produkt-/Store-/Environment-/UUID-Bindung, Test-Store-Ablehnung, TRANSFER-IDs, Millisekunden-Expiry/404, Kauf-/Restore-Refresh, Cooldown sowie statische Ledger-/RLS-/Lock-/Reihenfolge-/Global-Limit-Invarianten. `npm run validate:provider-limits`, `npm run validate:analysis-allowance`, `npm run typecheck` und der vollständige Lauf 26 bestehen. SQL konnte ohne Docker/lokales Postgres nicht ausgeführt werden; der Remote-Dry-Run 23 weist alle drei ausstehenden Migrationen nur aus und nimmt keine Änderung vor.
- **Externe Abhängigkeit:** RevenueCat dokumentiert Webhooks als Pro-Integration; laut aktueller Preisübersicht startet Pro kostenlos bis zur veröffentlichten MTR-Grenze. Im konkreten Account muss die Webhook-/HMAC-Option vor Release sichtbar und aktiviert sein. Quellen: [RevenueCat Webhooks](https://www.revenuecat.com/docs/integrations/webhooks), [REST v2 Customer Subscriptions](https://www.revenuecat.com/docs/api-v2/customer/resources), [Sandbox Testing Access](https://www.revenuecat.com/docs/projects/sandbox-access), [RevenueCat Pricing](https://www.revenuecat.com/pricing).
- **Restrisiko:** Neue anonyme Supabase-Accounts können erneut drei Lifetime-Free-Erfolge erhalten; Accountwechsel lässt sich ohne stärkere Identität nie vollständig verhindern. Als nächste Schichten kommen App Attest/DeviceCheck oder eine verifizierte Identität sowie ein OpenRouter-Hard-Spend-Cap und Billing-Alerts infrage; der globale 1.000/UTC-Tag-Breaker begrenzt nur den Tagesverlust. Webhook/REST/pg_cron/Secrets und direkte Bypass-Tests bleiben live offen. Für die loginlose App muss RevenueCats **Sandbox Testing Access** während App Review auf `Anybody` stehen, weil die Reviewer-UUID unbekannt ist. Apple-Sandbox bleibt dadurch nutzbar; die eigene `store=app_store`-/ID-Allowlist hält RevenueCat Test Store serverseitig ausgeschlossen.

## SEC-08 – Kostenlose Providerwege und RevenueCat REST waren erschöpfbar

- **Priorität/Typ:** P1 HIGH, Availability/Abuse/Provider Quota
- **Status:** FIXED_VERIFIED
- **Release-Grenze:** Die Korrektur ist im lokalen Arbeitsbaum verifiziert; das Live-Gate bleibt offen.
- **Ursache:** Suche und Barcode verbrauchen bewusst kein KI-Kontingent, konnten dadurch aber USDA/Open Food Facts ohne atomare Servergrenze aufrufen. Öffentliche Entitlement-Refreshes und Webhook-TRANSFER-Reconciliation teilten RevenueCats projektweite REST-Kapazität ebenfalls ohne gemeinsamen Circuit Breaker.
- **Remediation:** `20260904212500_rate_limit_nutrition_providers.sql` reserviert unmittelbar vor einem externen Cache-Miss-/REST-Aufruf atomare Slots. USDA Search ist pro Stunde auf User/Netz/global `20/40/100`, USDA Analysis auf `60/120/300` begrenzt. Open Food Facts Search ist pro Minute `2/2/4`, Barcode `3/4/7`. RevenueCat ist projektweit auf 200/min begrenzt; öffentliche Refreshes zusätzlich auf 3/User und 10/Netz/min. Ein Webhook reserviert alle bis zu acht Reconciliation-Aufrufe in einem Schritt, bevor `Promise.all` startet. Abgewiesene Claims verbrauchen keinen Slot.
- **Pseudonymisierung/Minimierung:** Die private, RLS-geschützte Tabelle speichert nur Route, Zähler, Fenster-/Updatezeit sowie `MD5` der zufälligen Supabase-UUID bzw. einen mit geheimem Salt gebildeten Netzwerk-`SHA-256`; Query, Barcode, Foto, Beschreibung, Providerantwort und Kaufpayload werden nie gespeichert. `MD5` wird hier ausdrücklich nur als deterministisches Account-Pseudonym, nicht als Passwort-/Integritätsschutz eingesetzt. Ein stündlicher Purge löscht nach einer Stunde Inaktivität und hält die Aufbewahrung damit unter zwei Stunden.
- **Fail-closed:** Ein öffentlicher Pfad ohne vertrauenswürdig gehashte Source-IP bzw. ohne `NUTRITION_RATE_LIMIT_SALT` erhält keine Providerfreigabe. Der RevenueCat-Helfer verlangt einen Claim-Callback und wartet unmittelbar vor jedem REST-Aufruf darauf; dadurch kann kein Callsite die Reservierung versehentlich überspringen. Der USDA-Claim liegt vor dem nicht refundierbaren globalen KI-Tageszähler, damit Accountrotation nicht billig dessen Kapazität verbraucht.
- **Verifikation:** `validate:provider-limits` prüft Schema/Grants, Lockreihenfolge, alle Limits, Boundary-Headroom, Claim-Pflicht, Reihenfolge und keine Query-/Barcode-Spalten; `validate:entitlements` prüft den RevenueCat-Pfad. Beide und der volle Lauf `evidence/build/26_final_release_verify.log` bestehen.
- **Live-Rest:** Migration, `NUTRITION_RATE_LIMIT_SALT`, Function-Deployments und echte Parallel-/429-/Fenstergrenztests fehlen. Bis dahin bleibt SEC-08 nur lokal `FIXED_VERIFIED` und die Produktionsgrenze insgesamt `FAIL`.

## SEC-03 – Fehlende Fetch-Timeouts/Abort-Grenzen

- **Priorität/Typ:** P2 MEDIUM, Availability/Reliability
- **Status:** FAIL
- **Code:** `src/services/mealAnalysis.ts`; `supabase/functions/nutrition/index.ts`; `supabase/functions/waitlist/index.ts`; `supabase/functions/guardian-consent/index.ts`
- **Beobachtung:** Der zentrale Client-Gateway-Request und fast alle Provideraufrufe besitzen keinen `AbortSignal.timeout`/`AbortController`. Nur einzelne Suchpfade haben lokal begrenzte Wartezeit.
- **Risiko:** Hängende Providerantworten blockieren Kamera-/Analyse-, E-Mail- oder Guardian-Flows bis zum Plattformtimeout. Wiederholen kann doppelte Quota/mehrere E-Mails verursachen; Nutzer sehen einen eingefrorenen Kernflow.
- **Abhilfe:** Pro Abhängigkeit abgestimmte Deadlines; typisierte Timeoutantwort; kontrollierte Retries nur für idempotente Requests bzw. mit Idempotency-Key. Client-UI soll abbrechen/erneut versuchen können.
- **Verifikation:** Netzwerk-Stall, DNS-Hang, 429, 5xx und delayed body simulieren; feste obere Latenz, ein Request/Charge pro ID und verständliche UI nachweisen.

## SEC-04 – Tokens und fehlgeschlagene Fotos in AsyncStorage

- **Priorität/Typ:** P2 MEDIUM, Data at Rest/Retention
- **Status:** MANUAL_CONFIRMATION_REQUIRED
- **Code:** `src/services/supabaseClient.ts`; `src/services/localRepository.ts`; `src/context/AppContext.tsx`
- **Beobachtung:** Supabase persistiert Session inkl. Bearer-/Refresh-Token in AsyncStorage. Profile, Mahlzeiten, Gewichte und Consent liegen ebenfalls dort. Fehlgeschlagene Livefotos werden als Base64 in einer Queue mit maximal drei Einträgen gespeichert; es gibt kein zeitbasiertes TTL und keinen expliziten Backup-Ausschluss. Queue-Löschung erfolgt nach erfolgreichem Retry, expliziter Bereinigung oder Account-Löschung.
- **Einordnung:** iOS App-Sandbox und OS Data Protection gelten weiterhin; es ist deshalb falsch, pauschal „unverschlüsselt auf dem Gerät“ zu behaupten. Im Projekt ist aber keine app-spezifische Keychain-/SecureStore-Sicherung für Refresh-Tokens und keine nachweisliche File-Protection-/Backup-Policy für sensible Retrybilder konfiguriert. Ohne finales Container-/Archivverhalten bleibt der Schutzgrad unbestätigt.
- **Risiko:** Backup/forensischer Gerätezugriff oder kompromittierte Runtime kann länger lebende Tokens, Körperdaten und Fotos exponieren. Retrybilder können ohne erneuten Start bis zur manuellen Aktion bestehen bleiben.
- **Abhilfe:** Refresh-/Sessionsecret in Keychain/SecureStore evaluieren; sensible Bildqueue als geschützte Cachedateien statt JSON/Base64, mit kurzer TTL, Startbereinigung und Backup-Ausschluss. UI über pending Retention informieren; Logout-/Delete-Bereinigung beibehalten.
- **Verifikation:** Physisches iPhone + Backup-/Restore-Test; App-Container nach Offlinefehler, Relaunch, TTL, Retry, Logout und Account-Löschung untersuchen; File Protection und Backup-Flags belegen.

## Niedrige Findings

### SEC-05 – Waitlist-Confirmation war nicht single-use

- **Status:** FIXED_VERIFIED
- **Release-Grenze:** Deployment und echter Mail-/DB-E2E bleiben offen.
- Die lokale Function verwendet zwei unabhängige 192-Bit-Token. Nach Bestätigung wird das Bestätigungstoken rotiert, während der eigene Abmeldetoken bis zur vollständigen Zeilenlöschung gültig bleibt. Ein unbekannter, formal gültiger Abmeldetoken liefert dieselbe Antwort und verrät keine Existenz.
- Die Tokens liegen weiterhin im server-only Datensatz im Klartext, weil sie als Bearer-Linkwerte verglichen werden; RLS, fehlende Client-Grants und vollständige Zeilenlöschung begrenzen die Angriffsfläche. Ein Hash wäre zusätzliche Härtung, aber die ursprüngliche falsche Single-use-Semantik ist geschlossen.
- `npm run validate:waitlist` und der vollständige zweite `npm run verify` bestehen; die neue Migration/Function wurde nicht deployed.

### SEC-06 – Lokaler Gateway ist im gesamten LAN offen

- `server/index.mjs`: Der secret-bearing Developmentserver bindet `0.0.0.0`, erlaubt `Access-Control-Allow-Origin: *`, hat keine Authentifizierung und keine Quota.
- Das ist für einen physischen Expo-Go-Test im WLAN nachvollziehbar und wird nicht als Produktionspfad verwendet. Während er läuft, kann aber jeder LAN-Teilnehmer Providerkosten auslösen und den Health-Status abfragen.
- Empfehlung: kurzlebigen Dev-Token, bindbare explizite Interface-Adresse, IP-Allowlist/Rate-Limit und deutliche Terminalwarnung; nie in öffentlichem WLAN/Tunnel ohne Auth.

### SEC-07 – Body-Limit erst nach JSON-Parsing

- `supabase/functions/nutrition/index.ts` ruft `request.json()` auf und prüft die Base64-Länge anschließend. Die appseitige Grenze von 3.000.000 Zeichen schützt daher nicht vor Parse-/Memory-Kosten eines sehr großen Body; nur ein eventuell vorhandenes Plattformlimit greift vorher.
- Empfehlung: dokumentiertes Supabase-Requestlimit bestätigen, `Content-Length` früh ablehnen und Streaming/harte Gatewaygröße verwenden. Negative Tests knapp über/weit über Limit.

## Positiv geprüfte Kontrollen

| Bereich | Status | Evidenz |
|---|---|---|
| Secrets im aktuellen Git-Bestand | PASS | Secret-Shape-Scan ohne Treffer; `.env`, `.p8`, `.p12`, Provisioning und Gateway-env ignoriert |
| Secrets in Git-Historie | PASS | `git grep` über alle Revisionsobjekte ohne Treffer für geprüfte Key-/Private-Key-Muster |
| iOS-JS-Export | PASS | keine serverseitigen Secret-Variablennamen im ausgelieferten Bundle |
| EAS Production | PASS | Remote-Validator bestätigt Supabase public URL/key, EU PostHog und RevenueCat public iOS key; kein lokaler Analyse-Override. EAS erzeugte daraus Build 7 erfolgreich; native Runtime bleibt separat offen. |
| Signiertes Build-7-IPA | PASS | Statische Archivprüfung: IPA-SHA-256 `c027a4957b148a846c7a5faf434afa60dd1f3aac76c92d29806dd3ac911b6d4e`; arm64; 1.0.0 (7); iOS 15.1; Xcode/SDK 26.0; `codesign --deep --strict` PASS; App-Store-Profil; `get-task-allow=false`; ATS arbitrary loads false; Export-Encryption false. Keine Provider-Secrets/operative Development-URL. 16 Privacy Manifests inventarisiert. Physische Runtime, zusammengefasster Xcode Privacy Report und Apple-Verarbeitung bleiben offen. |
| Push-Entitlement | MANUAL_CONFIRMATION_REQUIRED | Build 7 enthält `aps-environment=production`, obwohl der belegte Produktflow lokale Notifications nutzt. Kein P0/P1, aber Least-Privilege-Entscheidung und physischer Local-Notification-Test bleiben als P2-Gate. |
| Supabase JWT | PASS | `nutrition`/`delete-account` Plattform `verify_jwt=true` und zusätzlich `auth.getUser()` |
| Public Functions | FIXED_VERIFIED | Lokal: Waitlist mit Originliste, IP-Hash-Limit, getrennten Tokens/Löschung; Guardian mit Request-/Status-JWT, 256-Bit-Hash/48h und atomarer Single-use-Transaktion. Live-Gate offen. |
| RLS/Grants | FIXED_VERIFIED | Lokal: Owner-Policies auf Clienttabellen, keine Clientpolicies/-grants auf Quota/Cache/Waitlist/Guardian/Ledger; Providerzähler in `private` mit RLS und nur Service-Role-RPC. Drei neue Migrationen noch nicht remote angewendet. |
| SQL Security Definer | PASS | `search_path=''`, User aus `auth.uid()`, Quota-Wrapper ohne User-/Limitargumente |
| Foto-/Text-/Barcodegrenzen | PASS | JPEG-Type + appseitige min/max Base64, Text 3–500, Barcode 7–14 Ziffern, E-Mail max. 254. Das separate Pre-Parse-Bodylimit-Finding SEC-07 bleibt offen. |
| Providerkonfiguration | FIXED_VERIFIED | Lokal: OpenRouter `store:false`, data collection deny, Azure-only, no fallback, ZDR; Fehlerlogs nur Safe Code; Secrets nur Edge. Deployment offen. |
| Providerkapazität | FIXED_VERIFIED | Lokal: atomare User-/Netz-/Global-Claims für USDA/OFF/RevenueCat; keine Query-/Barcodeinhalte; <2 h Retention. Migration, Salts, Function-Deployment und Live-Grenztests offen. |
| Analytics | PASS | PostHog default opt-out, person profiles never, GeoIP/remote flags/surveys/replay/autocapture aus, Eventallowlist; unter 18 Opt-out |
| Fehlertelemetrie im Client | PASS | `captureOperationalError` ersetzt Message durch Bereich/Operation/Code und übernimmt nur Stackframes |
| Account-Löschung | FAIL | Supabase Auth/FK-Cascade und Kandro-lokale Daten bestehen live; der lokale Arbeitsbaum leert zusätzlich PostHog-Identitätswerte und alle Event-/AI-/Log-Queues (`validate:privacy` Exit 0). Historische PostHog-/RevenueCat-Daten, RevenueCat-Customer-Abmeldung/-Erasure und der native Cleanup-E2E bleiben offen. |
| ATS | PASS | `NSAllowsArbitraryLoads=false`; produktiver lokaler HTTP-Override durch EAS-Validator ausgeschlossen |
| CORS authenticated Functions | PASS | `*` ist keine Authgrenze; Requests erfordern JWT. Kein Secret wird durch CORS geschützt oder exponiert. |
| Remote Code/OTA | PASS | `expo-updates` nicht installiert; generierte Expo.plist setzt Updates disabled |

## Secret- und Konfigurationsprüfung

Gesucht wurden OpenAI/OpenRouter-artige Secret Keys, Supabase Secret-/Service-Role-JWTs, Google-/PostHog-secret-artige Tokens, PEM/OpenSSH Private Keys, versehentliche `.env`/`.p8`/`.p12`/Provisioning-Dateien sowie Debug-/localhost-/TODO-/FIXME-Marker. Die exakten regulären Ausdrücke wurden lokal ausgeführt; Secretwerte werden bewusst nie in diesem Bericht wiedergegeben.

Der einzige Markerfund in produktionsnahen Edgepfaden waren erlaubte Loopback-Origins in Waitlist/Guardian für Website-Tests. `server/index.mjs` ist Development-only. Generische `localhost`-Strings im temporären iOS-Export wurden auf React-Native-Devserver-/Supabase-Librarydefaults zurückgeführt, nicht auf Kandro-Production-Konfiguration.

`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, PostHog-Projekttoken und RevenueCat public SDK key sind definitionsgemäß im Client sichtbar und keine Server-Secrets. OpenRouter/USDA/Resend/Supabase Service Role dürfen nie `EXPO_PUBLIC_` sein; im geprüften Baum sind sie es nicht.

## Authentifizierungs- und Autorisierungsmatrix

| Operation | Identität | Serverprüfung | RLS/weitere Kontrolle | Urteil |
|---|---|---|---|---|
| Cloudprofil/-targets/-meals | anonymer oder E-Mail-User | JWT durch Data API | `(select auth.uid()) = user_id`; gezielte Grants | PASS |
| Foto/Textanalyse | Supabase User | Plattform JWT + `getUser` + Consent/Alter/Guardian + service-only Access-RPC | 3 Lifetime-Free-Erfolge oder frisches/Grace-geprüftes Pro; User-/Provider-/globales Tageslimit; stabile Request-UUID | FIXED_VERIFIED |
| Suche/Barcode | Supabase User | wie Analyse | kein bezahlter KI-Aufruf; lokal zusätzlich atomare User-/Netz-/Global-Providerlimits; Live-Gate bleibt offen | FIXED_VERIFIED |
| Account löschen | Supabase User | JWT + `getUser`; Admin löscht exakt User-ID | FK-Cascade | PASS |
| Guardian anfordern/status | Supabase User | Bearer + `getUser` im Handler | server-only Requesttabelle | PASS |
| Guardian bestätigen | öffentlicher Link | 256-Bit Random, nur SHA-256 gespeichert, 48h | Notice-Version + Ablauf; atomare Single-use-Korrektur lokal, noch nicht live | FIXED_VERIFIED |
| Waitlist subscribe | öffentlich | Originliste, E-Mail, 3/IP-Hash/Stunde | service-role-only Tabelle, getrennte Token, vollständige Abmeldung | FIXED_VERIFIED |
| RevenueCat-KI-Zugang | Supabase UUID | HMAC+Authorization Webhook und project-scoped Subscription-REST-v2-Fallback | `app_store`, interne App-/Produkt-/Entitlement-ID, Transfer-Dedupe, Kauf-/Restore-Refresh, Freshness/Grace | FIXED_VERIFIED |

## Datenfluss-/Netzwerkmodell

```text
iPhone
  ├─ AsyncStorage (Profil, Mahlzeiten, Gewichte, Consent, Session)
  ├─ Cache/Queue (temporäres komprimiertes Foto; bei Fehler max. 3 persistent)
  ├─ Supabase Auth/Data/Functions (TLS, public key + User JWT)
  │    ├─ Postgres/RLS, Analyse-Ledger, globaler KI-Kosten-Circuit-Breaker und kurzlebige Provider-Ratenzähler (lokal; noch nicht deployed)
  │    ├─ nutrition → OpenRouter/Azure → BLS/USDA
  │    ├─ nutrition → Open Food Facts
  │    ├─ delete-account
  │    ├─ guardian-consent/waitlist → Resend
  │    └─ revenuecat-webhook → RevenueCat REST v2 (lokal; noch nicht deployed)
  ├─ RevenueCat/StoreKit (nur nativer Build; serverseitiger Refresh lokal ergänzt)
  └─ EU PostHog (nur explizites Adult-Opt-in)
```

Kein Codepfad persistiert bestätigte Originalfotos in Supabase. Strukturierte Mahlzeiten enthalten Titel, Lebensmittel, Mengen, Kalorien/Makros und Zeit/Datum und sind Wellness-/Essensdaten; RLS/Löschung sind entsprechend sicherheitsrelevant.

## Supabase-/Datenbankprüfung

- 17 Migrationen lokal; der finale Remote-Dry-Run weist genau drei ausstehende Migrationen aus: Wartelisten-Retention, serverautoritatives Analyse-Entitlement und Provider-Ratenlimits. Die frühere 14-Migrationen-Basis bestand den Remote DB Lint auf Level `warning` mit Exit 0.
- Clienttabellen haben RLS, Owner-Policies und gezielte Grants; `anon` ist entzogen.
- `analysis_usage`, `analysis_access`, `analysis_requests`, `analysis_global_usage`, `revenuecat_webhook_events`, `usda_food_cache`, `waitlist`, `guardian_consent_requests`: lokal RLS, keine Clientpolicy, Tabellenrechte entzogen; `private.nutrition_provider_rate_limits` zusätzlich nicht exponiert, mit RLS und nur Service-Role-Zugriff. Neue Tabellen/Funktionen sind noch nicht remote angewendet.
- Guardian-Spalten sind per Trigger gegen `authenticated` Insert/Update geschützt; nur Function/Admin setzt sie.
- `private` ist nicht in der Data-API-Schemaliste. Die private Quota-Funktion hat keine Parameter und nutzt nur `auth.uid()`; direkter Execute/Usage für `authenticated` ist für den invoker-rights Public Wrapper nötig und eröffnet keine fremde Userwahl.
- `config.toml` erlaubt auf Templateebene DB-Netze `0.0.0.0/0`/`::/0`; die tatsächliche Remote Management-Plane wurde damit nicht nachgewiesen. Data API bleibt RLS-geschützt. Remote Network Restrictions im Dashboard separat bestätigen.

## Befehlsnachweis

| Befehl/Tool | Exit | Ergebnis |
|---|---:|---|
| `rg` Secret-Shape-Scan, Tree ohne `.git/node_modules/release` | 1 | 0 Treffer; Exit 1 = keine Matches |
| `git grep` Secret-Shape über alle Revisionsobjekte | 1 | 0 Treffer; Exit 1 = keine Matches |
| `rg` Debug/TODO/FIXME/localhost | 0 | Treffer klassifiziert: Devserver, Test-Origins, Validatoren/Dokumentation; kein Production-Clientoverride |
| `npx expo export --platform ios` + Bundle-Secret-Namensscan | 0 / 1 | Export erfolgreich; 0 Matches, Exit 1 = keine Matches |
| `npm run typecheck` | 0 | TypeScript bestanden |
| `npm run validate:privacy` | 0 | vorhandene Privacy-/Consent-Invarianten bestanden |
| `npm run validate:subscription` | 0 | Client-Billing-Invarianten; deckt SEC-02 serverseitig nicht ab |
| `npm run validate:entitlements` | 0 | HMAC/Authorization/Event-/REST-Parser sowie statische Ledger-, RLS-, Retention-, Reihenfolge- und Client-ID-Invarianten bestanden |
| `npm run validate:provider-limits` | 0 | Providerlimits, atomare Lock-/Claim-Reihenfolge, Retention, Minimierung und alle Callsite-Gates bestanden |
| `npm run validate:state-integrity` | 0 | Client-Persistenz/Idempotenz bestanden |
| `npm run validate:supabase` | 0 | statische Auth/RLS/Schema-Regeln bestanden |
| `npm run db:remote:check` | 0 | Finaler Dry-run mit `dryRun:true` weist genau drei ausstehende Migrationen aus; kein Push; `evidence/network/23_final_supabase_dry_run.log` |
| `supabase db lint --linked --level warning` | 0 | frühere 14-Migrationen-Basis ohne Remote-Lintmeldung; drei neue Migrationen noch nicht live gelintet |
| `supabase functions list` | 0 | vier alte Funktionen/JWT-Modi live; neue `revenuecat-webhook` fehlt live |
| `supabase secrets list` | 0 | nur Namen ausgewertet; `NUTRITION_RATE_LIMIT_SALT`, `GUARDIAN_RATE_LIMIT_SALT` und sieben RevenueCat-Serversecrets zuletzt fehlend, Werte nie ausgegeben |
| `npm audit --omit=dev --json` | 1 | 26 Dependencyknoten, siehe DEP-01 |
| `npm run verify` nach dem finalen lokalen Remediationstand | 0 | alle Validatoren, Typecheck, Expo Doctor 18/18 und Webexport bestanden; `evidence/build/26_final_release_verify.log` |
| EAS Production Build | 0 | signiertes Store-IPA Kandro 1.0.0 (7), Bundle `com.hewaddorani.kandro`, SDK 54, Fingerprint `e410ce56a5e09e470cff837903cbbb433924a639`; nicht installiert/TestFlight/ASC/submitted; `evidence/build/27_eas_release_archive.log` |
| Build-7-Metadaten | 0 | Build-ID/Fingerprint/IPA-SHA-256 und unveränderliche Archivdaten; `evidence/build/28_eas_build7_summary.json` |
| Build-7-IPA-Inspektion | 0 | Signatur, Provisioning, Entitlements, ATS, Export-Encryption und 16 Privacy Manifests statisch geprüft; `evidence/build/29_build7_archive_inspection.txt` |
| Build-7-Bundle-Scan | 0 | keine Provider-Secrets und keine operative Development-URL; `evidence/build/30_build7_bundle_scan.txt` |
| Build-7-Xcode-Logauszug | 0 | Xcode-/SDK-/Archiv-Metadaten; kein zusammengefasster Privacy Report; `evidence/build/31_build7_xcode_log_extract.txt` |

## Release-Gate nach Remediation

1. SEC-01-Remediation nach Deployment in Staging mit künstlichem PII-/Meal-Errorbody gegen echte Supabase-Log-Capture bestätigen.
2. Alle drei Migrationen anwenden, beide Rate-Limit-Salts und sieben RevenueCat-Serversecrets setzen. `nutrition`, `guardian-consent` und `revenuecat-webhook` deployen/live testen; `waitlist` zusammen mit Website/Waitlist releasen. Danach direkte Bypass-, Provider-Grenzwert-/Parallel-, 3-von-3-, Kauf/Restore/Ablauf/Refund-, Transfer-, Doppelrequest/-webhook-, 1.000er-Circuit-Breaker-, Retention- und Account-Churn-Tests dokumentieren. Für den loginlosen App-Review-Flow RevenueCat Sandbox Testing Access auf `Anybody` setzen und belegen; RevenueCat Test Store muss durch den eigenen Serverabgleich trotzdem gesperrt bleiben.
3. SEC-03 Deadlines für Analyse und Consent-/Mailpfade ergänzen; Stalltests bestehen.
4. SEC-04 auf physischem iPhone/Backup verifizieren und Retention/Keychain-Entscheidung dokumentieren.
5. Die statische Build-7-Prüfung auf Signatur, Provisioning, Secrets, Releaseendpunkte, Entitlements, ATS, Privacy Manifests und Debug-/Devbestandteile ist bestanden. Offen bleiben der zusammengefasste Xcode Privacy Report, Apples Verarbeitung/SDK-Signaturprüfung, die Auflösung der RevenueCat-Manifestabweichung (`Linked=false` trotz UUID-App-User-ID), Data-Protection-/Backupverhalten und die Least-Privilege-Entscheidung zu `aps-environment=production`. Danach exakt diesen oder einen neu verifizierten Submission-Build auf einem physischen iPhone installieren und alle nativen Flows testen. Build 7 wurde noch nicht zu TestFlight/ASC hochgeladen.
6. Beide früher offengelegten bzw. gehandhabten Provider-Credentials vorsorglich rotieren und die alten widerrufen: OpenRouter und USDA FoodData Central. Kein Wert gehört in Audit-Artefakte, Chatprotokolle oder Clientkonfiguration.
