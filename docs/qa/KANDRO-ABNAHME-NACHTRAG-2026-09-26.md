# Kandro – gezielter Abnahme-Nachtrag, 26.09.2026

**Ergebnis: zusätzliche lokale Nachweise erbracht; keine Veröffentlichungsfreigabe.** Der endgültige isolierte Release-Kandidat kompiliert und startet ohne Metro bis zum sichtbaren frischen Onboarding. Die weiteren Bedienfälle bleiben wegen der CUA-Eingabestörung blockiert. Es gab in dieser Nachrunde keinen Produktionszugriff und keine Fernbereinigung.

Zusätzlich belegt sind 14 gezielte Bestandsdaten-/Backend-Vertragsprüfungen, die Herkunft und Berechnung der bereits vorhandenen 48 Rezeptänderungen sowie genauere historische Dienstkontakte des ersten QA-Laufs. Der volle Verify-Lauf nach den vier kleinen Textkorrekturen besteht. Der vollständige Auth-/PostgREST-Integrationstest und der heutige Cloudzustand des QA-Vorfalls bleiben ungeklärt.

## Kandidat und Änderungen dieser Nachrunde

Arbeitskopie `/Users/hewaddorani/Developer/Kandro-recovery-20260906`, Branch `audit/app-store-release-gate-20260904`, HEAD `633d688e6a6247a6e1cc66f85788c157b6e12863`, mit den bereits vorhandenen uncommitteten Release-A-/Stabilisierungsänderungen. HEAD allein bezeichnet nicht den getesteten Kandidaten. Das neue Ausgangsmanifest enthält **240 aktuelle Quelldateien** und den Quellsatzhash `b79d12694e7fe1ebf9a903c04770cfd44828f008394bafaa12f516a3b19d8a58` (`baseline/manifest.json`). Die vorherigen 24 Stabilisierungsdateien stimmten zum Nachrundenstart mit dem alten Abschlussmanifest überein.

Gegen dieses neue Ausgangsmanifest sind genau vier Produktdateien geändert:

| Dateien | Konkreter Befund und minimale Korrektur |
|---|---|
| `src/data/mealCatalog.de.json`, `mealCatalog.en.json` | Seitan-Gyros-Karte nannte 25 Minuten, obwohl ein Zubereitungsschritt allein 30 Minuten verlangt. Jetzt „Mind. 30 Min.“ / „At least 30 min“. Eine gemessene exakte Gesamtzeit wird nicht erfunden; die Zubereitungsschritte bleiben unverändert. |
| `src/i18n/de.ts`, `en.ts` | Rezept-Quellenhinweis ergänzte bisher die tatsächlich verwendete BLS-Quelle nicht. Jetzt BLS 4.0 neben USDA FoodData Central und Open Food Facts ausdrücklich genannt. |

Nährwerte, Zutatenmengen und gespeicherte Mahlzeiten wurden in dieser Nachrunde nicht neu berechnet. Die 48 Nährwertänderungen sind bestehende Release-A-Arbeit. Kein neues Produktmerkmal, Datenbanksystem, Gewichtssync, Preis-/Gratisumfangswechsel oder Anbieterwechsel. Vorhandene Arbeitsstände, iCloud-Original und Chatarchiv bleiben erhalten; kein Reset/Clean/Stash/Commit/Push.

Endgültiger Quellsatz: `final-source-manifest.json`, SHA-256 `4ec8afc923921c664e06111e4cc13015d8d83786019daea10b29cadce7b29543`; geordneter Pfad/Hash-Satz `6fee1026a3a0347c1fc535cb2cf72cdf9c2aceee05a2809ad560d4230aa937d6`. Alle 240 Dateien stimmten nach dem nativen Nachtest weiter damit überein. Zusätzlich werden neue Abnahmeberichte geschrieben; sie sind Dokumentation, keine weiteren Produktkorrekturen.

`acceptance-changes.patch` enthält ausschließlich diese vier Textänderungen gegen die neue, bereits reparierte schmutzige Baseline. `acceptance-delta-manifest.json` verbindet Ausgangsarchiv, Vorher-/Nachherdateien, finales Manifest und Patch per SHA-256. Der private komplette Ausgangsquellstand bleibt lokal und wird nicht exportiert. Beide Deltas dienen der Prüfung, **nicht** einer erneuten automatischen Anwendung.

## Zusätzlich geprüfte Ergebnisse

| Status | Prüfung | Nachweis und Grenze |
|---|---|---|
| PASS | Vollständiges `npm run verify` nach den vier Textänderungen | 26.09., 02:07:00–02:07:36 MESZ, Exit 0; `verify-result.json`, `verify.log`. Bereinigte Umgebung, kein Dotenv/Providerkey, npm offline. Dies belegt keine native Releaseausführung. |
| PASS | Bestandsformat → aktuelle Speicherung, 14 Gruppen | 02:06:20–02:06:21 MESZ, Exit 0; `reviews/backend/command-result.json`, `upgrade-contract-results.json`. Tatsächliche alte Writer aus der Vor-Release-A-Sicherung erzeugen synthetischen Bestand; aktuelle Module lesen denselben Speicher ohne Reset. |
| PASS | Profil/Mahlzeiten/Gewichte/Einheiten/Consent | Profil samt Bearbeitungszeit, UK-Einheiten, zwei Gewichte, korrigierte Mahlzeit mit entfernter Zutat, Dezimalmengen und Referenzen erhalten. Passende Zustimmung bleibt gültig, ältere Version nicht. Keine native Upgrade- oder physische Speicherprüfung. |
| PASS | Pending/Löschung/Kontentrennung | Stabile Analyse-ID und Payload über Modulneustart, einmalige lokale Zählung/Entfernung; alter String-Tombstone migriert einmalig und verdeckt alten Tagebuchrest. Kontowechselmarker blockiert Hydration; aktueller Adoptionscallback trennt A/B einschließlich Consent, Queue und lokalen Gewichten. Keine echte Analyse oder serverseitige Quotenbuchung. |
| PASS | Neue Clientverträge/fehlende Backendteile | Echte Serializer/Mapper erhalten Metadaten; fehlende neue RPC und Spalten melden Fehler und erhalten lokale Daten/Pending/Löschmarker. Wiederholung behält Mutation-ID. Kein stiller Rückfall auf Tabellen-Upserts. Synthetische RPC-/Sitzungsadapter. |
| PASS | Rezeptvergleich | `reviews/recipes/execution-result.json`, Exit 0, 67 alte/aktuelle Rezept- und beide Katalogsummen unabhängig nachgerechnet; 48 Änderungen, 19 unveränderte Summen, 85 Zutaten, 0 Gramm-/Portionsänderungen. Aktuelle BLS-Werte stimmen mit dem unveränderten lokalen Snapshot überein. |
| PASS | Nachprüfung der vier Textänderungen | `reviews/recipes/after-copy-check.json`: genau der Seitan-Zeittext je Katalog, Quellenhinweis je Sprache; Rezeptschritte und Nährwerte weiterhin Release-A-identisch. Quellprüfung, noch keine native Textabnahme. |
| PASS | Alte Delta-Baseline/Exportprüfung | `package-support/old-delta-baseline.json`: 71 Hunks/24 Dateien ausschließlich im Speicher aus exakter historischer schmutziger Baseline rekonstruiert, alle damaligen Nachherhashes passen. Bekannte private QA-/Credentialreferenzen und Tokenmuster im vollständigen Patch: 0 Treffer im definierten Prüfumfang. |
| BLOCKIERT | Echte lokale Auth→JWT→PostgREST→RPC→DB-Integration | PostgreSQL/Supabase CLI vorhanden, Docker/Podman/PostgREST/GoTrue und entsprechender laufender Stack fehlen; kein Download/Start. `reviews/backend/local-stack-inventory.json`. |
| BLOCKIERT | Heutiger externer QA-Testbestand | Keine neue externe Abfrage freigegeben oder ausgeführt. Historische lokale Antworten sind kein heutiger Cloudstatus. |
| NICHT IM UMFANG | Echte KI-/Kauftransaktionen, Produktion, Cloudbuild, Upload, Deployment und Remote-Migration | Keine Freigabe durch diese Abnahme; nur getrennte spätere Schritte vorbereiten. |

Die Bestandsdatenprüfung ist ausdrücklich eine **Datenformat-/Migrationsprüfung**, kein nachgewiesenes App-Store-Update-in-place. Der alte Referenzstand stammt aus der tatsächlichen lokalen Vor-Release-A-Sicherung; eine Zuordnung zum exakt veröffentlichten Build-18-Binary ist damit nicht bewiesen. Alle geladenen Module und der Harness sind gehasht; 14 Gruppen sind keine 14 neuen Produktfehler.

Die historischen zwölf PostgreSQL-Gruppen bleiben ein echter SQL-/Rollen-/Transaktionsnachweis mit synthetischem `auth.uid()` und `SET LOCAL ROLE`, ohne Authserver, JWT-Signaturprüfung oder PostgREST. Diese Nachrunde hat sie nicht in einen vollständigen Supabase-PASS umgedeutet.

Der tatsächliche alte Client sendet weiterhin Parent-Upsert und Zutaten-Upsert getrennt. Die additive Migration erhält alte Grants, ergänzt Defaults/nullable Metadaten und erfasst Revisionen/Löschmarker. **Sie ersetzt keine alte Clientimplementierung:** alte Zweischritt-Schreibvorgänge bleiben nicht atomar, entfernte Zutaten werden vom alten Upsert nicht bereinigt und neue Referenzmetadaten nicht übertragen. Neuer Client auf altem Backend behält Daten lokal; funktionierende Cloud-Synchronisierung wird für diese Kombination nicht behauptet.

## QA-Vorfall: genauer lokal belegt, Cloudfolgen weiterhin offen

Der erste alte Lauf zählt weiterhin nicht als sauber isolierte Abnahme. Die neue Rekonstruktion stützt sich ausschließlich auf erhaltene lokale Logs und den Cache des eigenen QA-Simulators. Öffentliche Referenz ist **QA-IDENTITY-1**; genaue Identitäten, Sitzungs-/Requestwerte und lokale Containerpfade bleiben privat und werden nicht exportiert.

- **RevenueCat:** neun beobachtete HTTP-Anfragestarts und neun Antworten. Der Subscriber-GET mit 201 und CustomerInfo-Metadaten belegen historische Kundeninitialisierung, keinen Kauf. Erhaltene Antwort enthält keine Subscriptions/Entitlements/Non-Subscriptions; im Log kein Kaufstart. Keine vollständige OS-Paketaufzeichnung.
- **Supabase:** erhaltene anonyme Signup-Antwort HTTP 200 mit User/Sitzung. Spätere HTTP-200-Antworten geben ein passendes synthetisches Profil und ein Tagesziel zurück. Dieser damalige Serverbestand ist belegt; direkte Erfolgsantworten aller vorausgehenden Consent-/Profil-/Ziel-Upserts und deren vollständige Reihenfolge sind nicht erhalten.
- **Mahlzeitenschreiben/Löschmarkerlookup:** `mutate_meal_v2` und `deleted_meal_ids` lieferten im erhaltenen Cache 404/PGRST202. Keine erfolgreiche Mahlzeitenschreibbestätigung für den beobachteten Aufruf. Das beweist nicht, dass niemals ein anderer Schreibpfad erfolgreich war.
- **Unbekannt:** heutiger Bestand, vollständige Serverwirkung von Initialisierung/Entitlement-Refresh sowie nicht im Cache erhaltene Aufrufe. Weder Kundenschaden noch vollständige Entwarnung werden daraus abgeleitet.

Belegtes Supabase-Antwortfenster: 25.09., 23:13:45–23:16:10 UTC. Eine eng begrenzte spätere Nur-Lese-Prüfung ausschließlich für QA-IDENTITY-1, exakt zugeordnetes Zielprojekt und 23:00–23:22 UTC ist privat vorbereitet, nicht ausgeführt. Kein Login/Refresh des QA-Tokens, kein SDK-Lookup mit möglicher Neuanlage, keine Suche nach allen anonymen/Tageskonten und keine automatische Löschung. Bericht: `reviews/incident/QA-VORFALL-LOKALE-REKONSTRUKTION.md` und beide bereinigten JSON-Auszüge.

Die bekannte Ursache bleibt Expo-Entwicklungs-Dotenv über `require.context`; `EXPO_NO_DOTENV` allein reichte nicht. Native SDKs umgehen JS-fetch-Sperren. Frühere Guard-/Bundle-/Logbelege gelten nur für ihren damaligen Umfang, nicht automatisch für den jetzigen Releasebundle. Null AsyncStorage-Sitzungsschlüssel beweist zudem nicht die Entfernung aller historischen nativen HTTP-Cacheartefakte; Originale wurden bewusst erhalten.

## Native Release- und Bedienabnahme am endgültigen Stand

**Lokaler Release-Kompilier- und Erststartnachweis PASS; vollständige Bedienabnahme BLOCKIERT.** Detaillierte Zuordnung: `native/acceptance-results.json`, tatsächliche Interaktionen: `native/interaction-log.md`.

- Installiertes Xcode/Pods/Expo benutzt; kein Cloudbuild, keine Signierungsänderung am Apple-Konto, kein Download neuer SDKs. `xcodebuild -workspace ios/Kandro.xcworkspace -scheme Kandro -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' … CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build`.
- Erster lokaler Release-Build 02:06:38–02:23:36 MESZ, Exit 0. Nach einer privaten QA-Adapterkorrektur erneut vollständig über Xcode gebaut, Exit 0; exakte Zeiten/Befehle in `release-build-result.json` und `release-rebuild-result.json`. Native Binärdatei unverändert, JS-Bundle neu geprüft.
- Eigenes frisches **iPhone SE 3. Generation, iOS 26.5**, nativ installiert **1.0.0 (1)**. Diese geerbte lokale native Versionsnummer ist kein neuer Store-/TestFlight-Build und keine Aussage über den veröffentlichten Stand.
- Endgültiges eingebettetes Hermes-Bundle SHA-256 **`b7fe71714e3397d4b8db6fe2c7244a031ad10d611e9cce109066c01faf5668e0`**; Source Map `9bc072a28f1b2901b5cfc31f7f1b3cea640646f8e2096aad8cc9b22346757a08`; native ausführbare Datei `f74ae10c7512520172e7e68d54c3bcd8333717e54bb967d7dbc398f198d40941`. Installierte Bundlekopie stimmt bytegenau mit dem geprüften Artefakt überein.
- `embedded-bundle-check.json`: 1.341 tatsächliche Map-Module; acht QA-Grenzen vorhanden, keine echten Purchases-/PostHog-JS-Module, kein echter Supabase-Client und kein Dotenv-Modul; echte App-/Subscription-Contexts vorhanden. Dekodierter Hermes-Stringbestand und Vergleich mit bekannten lokalen Konfigurationsschlüsseln ohne Credentialtreffer. Die privaten SDK-Fixtures importieren kein natives Purchases-Modul. Native Bibliotheken bleiben gelinkt; das allein aktiviert keine Produktkonfiguration.
- Kein Listener auf Metro-Port 8081 beim Start/Nachtest. Nur eigener lokaler Fixture-Gateway auf 127.0.0.1:8788. App bleibt nach korrigiertem Start am Leben; kein fataler JS-Fehler im erfassten stderr. CUA-Screenshot zeigt **Schritt 1 von 11**, drei Zieloptionen und sichtbares „Weiter“. Dies belegt das erste Bild, **nicht** abgeschlossene Einrichtung/Consent.
- Im neu erzeugten nativen HTTP-Cache war ausschließlich der lokale `/qa/control`-Kontakt beobachtbar. Kein OS-Paketmitschnitt; aus Cache-/Loglücken wird keine universelle Netzwerkgarantie abgeleitet. Die wesentliche Isolation beruht auf Modulauflösung, fehlender echter Konfiguration, Stubgrenzen und Loopback-Gateway ohne Redirect/Proxy.
- Produkt-/QA-Trennung zusätzlich statisch geprüft: 116 Produkt-/Konfigurationsdateien, 14 Prüfpunkte, keine privaten Adapter-, Dummy-Key-, Testangebots- oder 8788-Verweise im Produktcode/neuen Diff. Die QA-Auflösung wird ausschließlich außerhalb des Repositorys per Umgebungsvariable gewählt. Dieser QA-Release ist **kein produktiv konfiguriertes Storebinary**; dessen endgültiger Build muss später separat geprüft werden.
- Ressourcen: vor Beginn etwa 13 GiB frei. Der lokale Zwei-Architektur-Build und Auslagerung drückten den freien Speicher vorübergehend auf etwa 3,4 GiB. Ausschließlich den eigenen QA-Simulator während des Builds angehalten; danach wieder über 6 GiB frei. Keine fremden Dateien/Prozesse oder Simulatoren bereinigt, keine Runtime/Container nachgeladen.

| Status | Native Prüffrage | Tatsächlicher Nachweis / verbleibende Lücke |
|---|---|---|
| PASS, begrenzt | Release-Konfiguration und eingebetteter Start ohne Metro | Build Exit 0, tatsächliche Bundle-/Installationshashes, erstes Onboarding-Bild und stabiler Prozess. |
| PASS, begrenzt | Kleines eigenes Gerät, sauberer Anfangszustand | SE3, frisches Onboarding Schritt 1. Kein alter kontaminierter Simulator benutzt. Standardtextgröße im Screenshot. |
| BLOCKIERT | Onboarding vollständig und Consent | Kein erfolgreicher sichtbarer Tipp auf Weiter; Consent noch nicht erreicht. |
| BLOCKIERT | Große Schrift, Softwaretastatur, Weiter/Bestätigen/Speichern/Zurück/Restore | CUA liefert teils Bilder, aber Koordinatentipps `noWindowsAvailable`; weitere AX-/Raise-Versuche `timeoutReached`. Keine Gesten als erfolgreich ausgegeben und keinen spekulativen Scroll-Fix gebaut. |
| BLOCKIERT | UK und schneller metrisch→US→metrisch-Wechsel mit Neustart | Zusätzliche native Folge noch nicht durchlaufen. Automatisierte Bestandsformat-/Raceprüfungen sind getrennte Modulnachweise. |
| BLOCKIERT | Lokaler Netzverlust/Wiederkehr und lokaler App-Tageswechsel | Isolierte Steuerung vorbereitet, nicht als nativer Ablauf ausgeführt. Kein Mac-Zeitwechsel. |
| BLOCKIERT | Sichtbare Pro-Pending-/Fehler-/Restore-Matrix | Lokale SDK-/Server-Fixtures vorhanden; keine sichtbaren Restore-/Pending-Aktionen nachgewiesen. Keine echte Transaktion. |
| BLOCKIERT | Neue Seitan-Kartenzeit/Quellenhinweis nativ in DE/EN | Code-/Summen-/Delta-Prüfung bestanden, native Rezept-/Kartenansicht nicht erreicht. Kleiner Inhaltsrestpunkt, kein Beleg für eine fehlerhafte Darstellung. |
| BLOCKIERT | Echtes natives Update eines passenden bisherigen Produktbinaries | Keine verifizierte passende alte native Referenz verfügbar. Das alte lokale QA-Debugbinary ist kein sicherer veröffentlichter Vorherstand. Die 14 Altformatgruppen bleiben Format-/Controllertests. |

**Fehlgeschlagene Versuche sauber getrennt:** Der erste QA-Start hatte `TypeError: undefined is not a function` an `ThemeContext.tsx:16`. Der ausschließlich private AsyncStorage-Wrapper verlor beim CJS-Objektspread das nicht aufzählbare `__esModule`-Flag; der Defaultimport zeigte deshalb auf das falsche Objekt. Nur dieses Adapterexport ergänzt, Exportform geprüft, QA-Release neu gebaut und erfolgreich nachgestartet. Das ist ein reparierter **Testharness-FAIL**, kein neuer Produktpatch und kein verschwiegenes grünes Erstresultat. Der erste Credentialscanner stoppte außerdem vor Start an zusammenhängenden Hermes-Stringtabellenbytes (`flask-sharp`-Icon plus Nachbarstrings); echte dekodierte Stringgrenzen und bekannte Schlüssel wurden daraufhin geprüft, ohne Treffer. Die ursprünglichen lokalen Versuche bleiben erhalten.

Die sechs ausführbaren Bedien-Checklisten mit Sollzustand und benötigter Evidenz stehen in `native/MANUELLE-NACHPRUEFUNG.md`. Ein entsperrter/bedienbarer Simulator oder ein tatsächlicher manueller Test muss die Ergebnisse nachtragen. Bis dahin bleiben sie blockiert. Die Ursache der CUA-Störung ist nicht als Appdefekt oder sicher als gesperrter Mac diagnostiziert.

## Rezeptinhalte und verbleibende Grenzen

Die 48 Vorher-/Nachherwerte mit Quellen-/Wiegezuständen stehen vollständig in `reviews/recipes/recipe-changes-48.csv` und `recipe-comparison.json`. Vorherbasis ist das lokale Archiv **vor Release A**, nicht die spätere Stabilisierungssicherung und nicht automatisch die veröffentlichte Version. 23 größere Abweichungen wurden nach dokumentierter Schwelle priorisiert; Roh-/Garwechsel und Quellwechsel sind einzeln erläutert (`PLAUSIBILITAET.md`). Keine realen gespeicherten Mahlzeiten wurden rückwirkend verändert.

Die Rechenformel validiert keine Nährwertquelle. BLS-Generator verwendet verfügbare Kohlenhydrate, der alte USDA-Generator Nährstoff-ID 1005 im gleichen Appfeld; vollständige quellenübergreifende Harmonisierung ist mit den vorliegenden Referenzen nicht belegt. Keine neuen exakten Nährwerte oder Garfaktoren erfunden. Der Seitan-Text beseitigt einen nachweislich falschen 25-Minuten-Präzisionsanspruch; eine gemessene Gesamtkochzeit bleibt unbekannt.

## Freigabereife und Weitergabe

**Veröffentlichungsblocker dieses Kandidaten:** fehlende echte Auth-/PostgREST-/Clientkette; noch nicht durchgeführte wesentliche native Onboarding-/Speichern-/Bedien- und Restorewege; vor einer konkreten Storefreigabe ein wirklich passender Mobile-Build samt physischer Kamera-/Kauf-/Restore-/Account- und Bestandsdatenprüfung. Der heutige QA-Cloudbestand ist ein separat zu behandelnder Incident-Restpunkt und kein durch lokale grüne Tests erledigter Fall.

**Kleine dokumentierte Restpunkte:** native Sichtprüfung der zwei Textkorrekturen; keine gemessene exakte Seitan-Gesamtzeit; begrenzte quellenübergreifende Kohlenhydrat-Harmonisierung. Diese Runde erfindet keine neuen Nährwerte und beginnt keine Produktroadmap. Lokaler Gewichtsverlauf ohne Cloudsync ist eine bestehende Produktgrenze und keine neue Aufgabe dieser Wartungsrunde. Eine pauschale Bugfreiheits- oder Produktionsfreigabe wird nicht ausgesprochen.

Das bereinigte Paket `KANDRO-ABNAHME-2026-09-26.zip` wird ausschließlich aus einzeln geprüften Dateien erstellt. Es enthält diesen Nachtrag, finale Resultate/Logs, den tatsächlich passenden Erststart-Screenshot, Manifeste, beide Deltas mit eindeutiger Baseline sowie relevante nicht geheime SQL-/Testdateien. Ausgeschlossen sind `.env`, Schlüssel, Sitzungen, genaue Incident-Kennungen, native Rohcaches, Bundles/Maps, komplette private Baselines und unpassende frühere Bilder. Originale bleiben lokal; erforderliche Pfad-/Kennungsredaktionen in Exportkopien stehen im Paketmanifest. Das Paket ist eine Reviewzusammenstellung, kein allein lauffähiger Checkout und keine automatische Patchanwendung. `package-support/export-result.json` und die separate ZIP-Prüfsumme bestätigen erst nach tatsächlichem Export dessen Abschluss.

## Veröffentlichungsvorschlag, ausdrücklich noch nicht ausführen

1. Fehlende lokale Auth-/PostgREST-Integration und native Bedienabnahme im isolierten Umfeld schließen. Alt-Client bleibt Zweischritt, neuer Client benötigt neue Spalten/RPC; keinen unsicheren Fallback ergänzen.
2. Anschließend additive `atomic_meal_sync`-Migration und vorhandene OFF-Edge-Korrektur jeweils konkret mit Ziel/Version separat zur **Schreibfreigabe** vorlegen. Erst nach genehmigter kontrollierter Backendbereitstellung darf der davon abhängige neue Mobile-Kandidat folgen. Dafür heute weder Datenbank- noch Edge-/Providerzugriff ausgeführt.
3. Passenden produktiv konfigurierten Mobile-Build gesondert identifizieren und seine Konfiguration auf QA-Reste prüfen. Lokal/auf physischem Gerät Kamera, bestehende Daten, Speichern und Kontentrennung prüfen; echte Apple-/RevenueCat-Sandbox-/Restore-/Serverrechtskette erfordert eigene externe Testfreigabe. Cloudbuild, Upload und Veröffentlichung sind weitere konkret benannte spätere Aktionen, durch diesen Auftrag nicht genehmigt.
4. Rückfallplan: neue Auslieferung anhalten, Pending-Daten und serverseitige Revisions-/Löschhistorie erhalten, Ursache prüfen. Kein Ledgerlöschen, kein automatisches destruktives Downgrade und kein Rückfall auf den unsicheren Zweischritt.

## Maximal drei nächste Eingriffe/Freigaben des Eigentümers

1. **Native Bedienprüfung ermöglichen:** Mac entsperrt lassen und das eigene Simulatorfenster aktivieren bzw. die beigefügten sechs Checklisten tatsächlich manuell durchlaufen. Zuerst nur „bereit“ melden, damit derselbe gehashte QA-Kandidat weiter geprüft werden kann; keine Produktiv-App/TestFlight-Version als Ersatz starten.
2. **Fehlenden lokalen Auth-/PostgREST-Teststack bereitstellen oder dessen gezielten Download/Einrichtung freigeben.** Benötigt Auth, JWT-Prüfung und PostgREST vor dem eigenen lokalen PostgreSQL. Eine reine SQL-Datenbank genügt nicht; Produktionszugriff ist dadurch nicht freigegeben.
3. **QA-Vorfall separat entscheiden:** Optional ausschließlich die eng abgegrenzte Nur-Lese-Prüfung gemäß `reviews/incident/OWNER-READ-ONLY-SCOPE.md` für QA-IDENTITY-1 und das belegte Zeitfenster freigeben. Supabase und RevenueCat sind getrennte Optionen; keine automatische Bereinigung, keine neuen SDK-Logins und keine breite Kontensuche.

Alle drei Punkte bleiben bis zu konkreter Antwort/Durchführung offen. Kein Commit, Push, Deployment, Produktionslesen, Remote-Migration, echter Kauf, Cloudbuild, Upload oder Store-Submission in dieser Nachrunde.
