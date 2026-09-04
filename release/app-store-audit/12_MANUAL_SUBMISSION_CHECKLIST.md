# 12 – Manuelle Einreichungscheckliste

Dies ist eine Ausführungscheckliste, kein Nachweis dafür, dass ein nicht abgehakter Punkt bestanden wurde. Vor **Add for Review** und **Submit for Review** anhalten, bis der Eigentümer das finale Gate freigibt.

**Aktueller Build-Stand:** Das signierte EAS-Store-Archiv `1.0.0 (7)`, ID `420935a7-2aed-43e1-9daf-cb53f306a549`, wurde erfolgreich fertiggestellt. Es wurde **nicht** zu App Store Connect/TestFlight hochgeladen, installiert, ausgeführt oder eingereicht. App Store Connect enthält nur die Builds 4 und 5.

## A. Status externer Konten

- [ ] App Store Connect zeigt das Paid Apps Agreement als **Active**, nicht `In Bearbeitung`.
- [ ] Das Bankkonto zeigt **Active**.
- [ ] Die DSA-Händlerkonformität zeigt **Verified/Compliant**, nicht `In Prüfung`.
- [ ] Jeder DAC7-Hinweis ist erledigt, oder Apple bestätigt, dass er dieses Konto nicht blockiert.
- [ ] Der Eigentümer bestätigt, dass öffentlicher rechtlicher Name, Anschrift, Support-E-Mail-Adresse, Händlertelefonnummer und Steuerstatus korrekt sind. Keine Kennungen in das Repository kopieren.
- [ ] Startgebiete nach professioneller/rechtlicher Prüfung des 14+-/Erziehungsberechtigten-Modells festlegen. Wenn diese Prüfung nicht verfügbar ist, die Gebiete für den ersten Start reduzieren, statt weltweite Rechtskonformität zu behaupten.
- [ ] Beide Provider-Zugangsdaten rotieren und widerrufen, die in früheren Chats verarbeitet oder eingefügt wurden: OpenRouter und USDA FoodData Central. Nur serverseitige Secrets aktualisieren; keinen der Werte in öffentliche EAS-Variablen, Git oder dieses Auditpaket aufnehmen.

## B. Backend-Release

- [ ] Die exakt drei ausstehenden Supabase-Migrationen prüfen und eine Datenbanksicherung/einen Änderungsnachweis erstellen: `20260904184701_add_waitlist_retention.sql`, `20260904185227_server_authoritative_analysis_access.sql` und `20260904212500_rate_limit_nutrition_providers.sql`.
- [x] `npm run db:remote:check` ohne Änderungen ausführen. `evidence/network/23_final_supabase_dry_run.log` bestätigt, dass exakt diese drei Migrationen ausstehen; es belegt **nicht** die Bereitstellung oder Parität nach der Bereitstellung.
- [ ] Alle drei freigegebenen Migrationen anwenden und anschließend die voneinander abhängigen Functions `nutrition`, `guardian-consent` und `revenuecat-webhook` gemeinsam aus demselben committeten Quellstand bereitstellen. Die aktualisierte `waitlist`-Function/Site-Veröffentlichung als separate öffentliche Webänderung bereitstellen. Dieses Audit führte absichtlich keine dieser Bereitstellungen durch.
- [ ] `NUTRITION_RATE_LIMIT_SALT` und `GUARDIAN_RATE_LIMIT_SALT` als lange zufällige, ausschließlich serverseitige Werte setzen.
- [ ] Alle sieben ausschließlich serverseitigen RevenueCat-Werte setzen: `REVENUECAT_PROJECT_ID`, `REVENUECAT_APP_ID`, `REVENUECAT_ENTITLEMENT_RESOURCE_ID`, `REVENUECAT_IOS_PRODUCT_RESOURCE_IDS`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_AUTHORIZATION` und `REVENUECAT_WEBHOOK_SIGNATURE_SECRET`. Nur Namen/Vorhandensein prüfen; Werte niemals in Nachweise exportieren oder mit `EXPO_PUBLIC_` präfixieren.
- [ ] Alle weiteren erforderlichen serverseitigen Webhook-/Mail-/Provider-Secrets in Supabase setzen/bestätigen; nur Namen prüfen und Werte niemals in Nachweise exportieren.
- [ ] RevenueCats Produktions-Webhook auf den neuen Server-Entitlement-Endpunkt konfigurieren und dessen eigenes Authorization-Secret verwenden; dem RevenueCat-Server-Key ausschließlich den erforderlichen Scope `customer_information:subscriptions:read` geben.
- [ ] Bestätigen, dass der bereitgestellte Server die exakten internen Allowlisten für die iOS-App, Monats-/Jahresprodukt und das Entitlement `kandro_pro` verwendet; kein Anzeigename oder vom Client gelieferter Bezeichner darf Zugang autorisieren.
- [ ] Für den loginlosen App-Review-Ablauf RevenueCats **Sandbox Testing Access** auf `Anybody` setzen: Ein Reviewer erhält eine neue anonyme Supabase-UUID, die nicht vorab auf eine Allowlist gesetzt werden kann. Verifizieren, dass Apple Sandbox akzeptiert wird, während der Server RevenueCat Test Store/`rc_billing` über `store=app_store` plus exakte interne Allowlisten weiterhin ablehnt.
- [ ] Mit einem einmalig verwendeten Nutzer drei erfolgreiche kostenlose KI-Antworten ausführen und mindestens eine Bestätigung abbrechen; verifizieren, dass die vierte direkte HTTP-Anfrage blockiert wird. Suche, Barcode, Demo, Planmahlzeiten und das Speichern eines bereits gezählten Ergebnisses dürfen das Kontingent nicht verändern.
- [ ] Ein aktuelles Apple-Sandbox-Entitlement `kandro_pro`, Testphase, Kulanzfrist, abgelaufenes/erstattetes Entitlement und doppelte/in falscher Reihenfolge eintreffende Webhooks durchspielen.
- [ ] Einen RevenueCat-TRANSFER mit beiden Seiten und Aliasen durchspielen; jede UUID muss per REST abgeglichen, gelöschte Nutzer müssen ignoriert und `(event_id,user_id)` muss dedupliziert werden.
- [ ] Nach Kauf und Restore Purchases verifizieren, dass `POST /nutrition/v1/entitlement/refresh` das JWT des Nutzers verlangt, atomar auf einen Refresh pro 20 Sekunden begrenzt ist und die Oberfläche Pro erst nach einer positiven Serverantwort anzeigt.
- [ ] Bestätigen, dass eine Request-ID unter Parallel-/Wiederholungsbedingungen niemals zweimal verbrauchen oder Kosten verursachen kann.
- [ ] In einem isolierten Datenbank-/Staging-Test das globale Kontingentlimit herabsetzen oder die Grenze direkt ausüben und belegen, dass der UTC-Circuit-Breaker den nächsten Provider-Start atomar stoppt; nicht 1.000 echte Aufrufe ausgeben, nur um den Standardwert zu testen.
- [ ] Jede bereitgestellte Upstream-Schutzgrenze testen, ohne übermäßig reales Kontingent zu verbrauchen: stündliche USDA-Limits für Suche/Analyse, minütliche Open-Food-Facts-Limits für Suche/Barcode sowie globale/nutzer-/netzwerkbezogene RevenueCat-Limits. Belegen, dass die erste Anfrage oberhalb des Limits vor dem Upstream-Fetch fehlschlägt und normaler Datenverkehr nach Ablauf des Fensters fortgesetzt wird.
- [ ] Trusted-Proxy-/IP-Verarbeitung am echten Produktions-Edge testen: direkte Anfrage, erlaubte weitergeleitete Kette, gefälschtes `X-Forwarded-For`, fehlender vertrauenswürdiger Netzwerk-Hash sowie IPv4-/IPv6-Fälle. Eine fehlende vertrauenswürdige Netzwerkidentität muss, wo erforderlich, fail-closed behandelt werden; ein vom Client gelieferter Header darf niemals den Bucket eines anderen Nutzers wählen.
- [ ] Einen synthetischen Provider-Fehler mit erfundenem Mahlzeiten-/Authorization-Text auslösen und verifizieren, dass Supabase-Protokolle nur den erlaubten Fehlercode enthalten.
- [ ] CMP-032 auflösen, bevor eine vollständige Kontolöschung behauptet wird: die lokal implementierte Bereinigung von PostHog-Kennung/-Warteschlange physisch verifizieren und historische PostHog-/RevenueCat-Nutzerdaten entweder löschen oder eine eng begrenzte rechtmäßige Aufbewahrung dokumentieren. Danach die Live-Löschung erneut ausführen und verifizieren, dass Auth, Profil, Mahlzeiten, Empfehlungsfeedback, Erziehungsberechtigten-Anfrage und jede Analyse-/Entitlement-/Webhook-Ledger-Zeile entfernt sind.
- [ ] Produktions-Gateway, Wartelistenbestätigung/-abmeldung und Erziehungsberechtigten-Bestätigung auf Englisch und Deutsch bestätigen, einschließlich 429-Verhalten pro Nutzer/Netzwerk/global sowie Protokollbereinigung.

## C. Neuer Produktions-Build

- [ ] Den freigegebenen Quellstand auf dem Audit-Branch committen und den Commit-Hash vermerken.
- [x] Den vollständigen lokalen Lauf `npm run verify` ausführen; `evidence/build/26_final_release_verify.log` bestand, einschließlich 18/18 Expo-Doctor-Prüfungen und eines Webexports. Dies ersetzt weder `npm ci` noch Remote-Secret-Validierung, native Archivprüfung oder Geräte-QA.
- [ ] Aus der final committeten Release-Umgebung mit Secrets `npm ci`, `npm run validate:eas:remote`, `npm run validate:release:production` und `git diff --check` ausführen; Exitcodes aufbewahren. Ein lokaler Fehler, der ausschließlich auf einen absichtlich fehlenden öffentlichen RevenueCat-iOS-Key zurückgeht, ist kein Produktionsnachweis.
- [x] Ein signiertes EAS-`production`-iOS-Store-Archiv erstellen, ohne es einzureichen: Build 7, EAS-ID `420935a7-2aed-43e1-9daf-cb53f306a549`, Fingerprint `e410ce56a5e09e470cff837903cbbb433924a639`.
- [ ] Nach der finalen Prüfung von Quellstand/Konfiguration entscheiden, ob Build 7 der exakte Kandidat ist oder ersetzt werden muss. EAS verzeichnet Baseline-Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5`, während der hochgeladene Kontext nicht committete Korrekturen enthielt; den Fingerprint aufbewahren und keine Commit-Gleichheit behaupten.
- [ ] Version, Build, EAS-Build-ID, committierten Quellstand, Fingerprint und IPA-SHA-256 des finalen Kandidaten vermerken.
- [x] Build 7 statisch prüfen: Release-Signierung, Distribution Provisioning, Bundle ID, Team ID, Version/Build, Deployment Target, `get-task-allow=false`, Produktions-APNs, ATS, Verschlüsselungsflag, eingebettete Frameworks, SDK-Signaturen und jede `PrivacyInfo.xcprivacy`. Ergebnisse: `evidence/build/29_build7_archive_inspection.txt` und `30_build7_bundle_scan.txt`; das unerwartete Produktions-APNs-Entitlement bleibt als P2-Entscheidung offen.
- [ ] Den zusammengeführten Xcode-Datenschutzbericht aus dem finalen Archiv erzeugen/exportieren. Dies erfordert eine Umgebung mit aktuellem vollständigem Xcode; der Audit-Mac verfügt nur über Command Line Tools.
- [x] Entpackte Build-7-IPA und Hermes-Bundle nach echten Secrets, localhost-/Staging-URLs, Source Maps, `.env`, Debug-Menüs und für die Produktion ungeeigneten Testdaten durchsuchen; kein privates Provider-Secret und keine operative Entwicklungsserver-URL gefunden (`evidence/build/30_build7_bundle_scan.txt`).
- [ ] Beide statischen Archivprüfungen für den exakten, sauber committeten Submission-Kandidaten wiederholen, falls Build 7 ersetzt wird oder sich irgendeine Build-Eingabe ändert.
- [ ] Den geprüften Kandidaten zu App Store Connect/TestFlight hochladen, ohne ihn der Prüfung zuzuordnen oder einzureichen; vollständige Verarbeitung verifizieren und bestätigen, dass das dort angezeigte Binärpaket die erwartete Version/den erwarteten Build hat.

## D. Finale native Geräte-QA

- [ ] Den exakten finalen Build aus TestFlight als Neuinstallation auf einem physischen unterstützten iPhone installieren; Build 7 wurde noch nicht hochgeladen oder ausgeführt.
- [ ] Deutsches und englisches Onboarding abschließen, einschließlich Erziehungsberechtigten-Ablauf „ausstehend/genehmigt“ für 14–15-Jährige und Abläufen für 16+-Jährige/Erwachsene.
- [ ] Kleinstes unterstütztes Layout, ein aktuelles großes iPhone, Light/Dark, maximale Dynamic Type, Bold Text, Increased Contrast, Reduce Motion und VoiceOver testen.
- [ ] Kameraberechtigung ablehnen, dann in den Einstellungen erteilen; Fotoaufnahme, erneute Aufnahme, Hintergrund/Vordergrund und Beenden der App während der Analyse testen.
- [ ] Barcode-Taschenlampe, schnellen/schiefen Barcode, Fallback für unbekanntes Produkt, Suche, Beschreibung und Datenbanklokalisierung testen.
- [ ] Offlinezustand, langsames Netzwerk, 400/401/403/429/500/503, abgelaufene Sitzung, Wiederholung und Wiederherstellung ohne doppelte Kosten testen.
- [ ] Verifizieren, dass Mahlzeiten-Slots, Tageswechsel, Zeitzone/Sommerzeit, Serie, Gewichtsverlauf, wiederholte/geplante Mahlzeiten und Flüssigkeitszufuhr das KI-Kontingent nicht verändern.
- [ ] E-Mail-Kontoverknüpfung auf Englisch und Deutsch, falschen/abgelaufenen Code, erneutes Senden, Passwortanmeldung und Entscheidung zur Kontowiederherstellung testen.
- [ ] Ein Einmalkonto mit und ohne aktives Abonnement löschen; bestätigen, dass die Oberfläche erklärt, dass die Kündigung des Apple-Abonnements separat erfolgt.
- [ ] Lokale Erinnerungen/Benachrichtigungsberechtigung, erneuten App-Start und Verhalten geplanter Schritte bestätigen; verifizieren, dass keine Remote-Push-Behauptung oder unnötige Berechtigung angezeigt wird.

## E. StoreKit und Abonnements

- [ ] In App Store Connect einen Review-Screenshot zum monatlichen und jährlichen Produkt hinzufügen.
- [ ] Sicherstellen, dass beide Produkte nicht mehr Missing Metadata anzeigen.
- [ ] Beide ersten Abonnements App-Version 1.0.0 zuordnen.
- [ ] Monatlichen Kauf, jährlichen Kauf, Kündigung durch den Nutzer, Pending/Ask to Buy, Netzwerkfehler, bereits gekauft, Restore Purchases, Ablauf, Erstattung/Widerruf, Billing Retry und Kulanzfrist auf dem exakten finalen Build testen.
- [ ] Verifizieren, dass die Paywall Preis/Zeitraum aus StoreKit bezieht und keine erfundene Testphase oder Ersparnis anzeigt.
- [ ] Verifizieren, dass ein aktives Entitlement sowohl Server als auch Client freischaltet und ein abgelaufenes/erstattetes Entitlement den Zugang gemäß der dokumentierten Kulanzregel schließt.
- [ ] RevenueCat Webhook Authorization und Raw-Body-HMAC, REST-v2 Customer Subscriptions, Produktions-/Sandbox-Isolation, Transfer-Verarbeitung und 20-Sekunden-Refresh-Cooldown gegen die bereitgestellten Functions verifizieren; bereinigte Ereignis-/Antwortnachweise aufbewahren.
- [ ] Mit `Sandbox Testing Access = Anybody` einen neuen loginlosen, reviewerähnlichen anonymen Nutzer verwenden, um über Apple Sandbox zu kaufen und wiederherzustellen. Bestätigen, dass Apple `app_store` Zugang gewährt und RevenueCat Test Store/`rc_billing` niemals Produktions-Pro gewährt.

## F. App Privacy und öffentliche Richtlinie

- [ ] Die korrigierten englischen und deutschen Datenschutztexte vor der Einreichung veröffentlichen.
- [ ] App Store Connect App Privacy anhand von `04_DATA_PRIVACY_MAP.md` aktualisieren, einschließlich Name, Device ID, Product Interaction und Diagnostics, soweit die finale PostHog-Konfiguration dies erfordert.
- [ ] Das verknüpfte Kauf-/Nutzer-/Nutzungs-Ledger und das nicht verknüpfte globale Tagesaggregat mit den finalen App-Privacy-Antworten und der bereitgestellten EN-/DE-Richtlinie abgleichen.
- [ ] Die kurzlebigen Provider-Ratenlimit-Datensätze (pseudonyme Konto-/Netzwerkkennungen, Route, Anzahl und Zeitstempel; keine Abfrage/kein Barcode/kein Inhalt; tatsächliche Aufbewahrung unter zwei Stunden) mit den finalen App-Privacy-Antworten und der bereitgestellten EN-/DE-Richtlinie abgleichen.
- [ ] Die finale Entscheidung zu Photos/Videos und Other User Content ausschließlich anhand der Nachweise zu bereitgestelltem Gateway/Provider-Aufbewahrung treffen.
- [ ] Im exakten Archiv `NSPrivacyTracking=false`, keine Tracking-Domains/IDFA und keinen ATT-Bedarf bestätigen.
- [ ] Alle Required-Reason APIs und genehmigten Gründe im zusammengeführten Datenschutzbericht bestätigen.
- [ ] Jede öffentliche URL aus einem abgemeldeten Browser und aus der App öffnen: EN-/DE-Marketing, Support, Datenschutz, Bedingungen, Quellen, Impressum, Erziehungsberechtigten-Bestätigung, Wartelistenbestätigung und Abmeldung.
- [ ] Verifizieren, dass eine Wartelistenabmeldung die Zeile löscht, abgelaufene unbestätigte Zeilen nach 30 Tagen bereinigt werden und der Startzeitstempel gesetzt wird, wenn die App tatsächlich startet.

## G. Zusammenstellung in App Store Connect

- [ ] Die lokal korrigierte Store-Beschreibung in beiden App-Store-Lokalisierungen übernehmen; sicherstellen, dass die nicht vorhandene Exportbehauptung entfernt ist.
- [ ] Alle 10 Screenshots mit dem exakten finalen Binärpaket vergleichen und jede Abweichung ersetzen.
- [ ] Den geprüften und physisch getesteten finalen Build auswählen, nicht TestFlight-Build 4 oder 5. Build 7 ist erst auswählbar, nachdem er hochgeladen und verarbeitet wurde.
- [ ] Kategorie, Inhaltsrechte, Altersfragebogen, Verschlüsselungsantwort, manuelle Veröffentlichung und alle Lokalisierungen bestätigen.
- [ ] Die finalen Review Notes erst einfügen, nachdem alle Platzhalter in eckigen Klammern entfernt wurden.
- [ ] Bestätigen, dass keine Reviewer-Zugangsdaten erforderlich sind; falls sich das ändert, ausschließlich in App Store Connect speichern, niemals in Git.
- [ ] Bestätigen, dass Produktions-Backend und Review-Kontakt während der gesamten Prüfung überwacht werden.

## H. Haltepunkt des Eigentümers

- [ ] Der Eigentümer prüft finale Produktseite, App-Privacy-Antworten, Preise, Gebiete, Screenshots, Review Notes und ausgewählten Build in einer Sitzung.
- [ ] Der Eigentümer gibt die exakte Build-Nummer und den Audit-Commit frei.
- [ ] Erst nach dieser ausdrücklichen Anweisung: auf **Add for Review** klicken.
- [ ] Eine letzte zusammenfassende Prüfung des Einreichungsentwurfs durchführen.
- [ ] Erst nach einer zweiten ausdrücklichen Anweisung: auf **Submit for Review** klicken.
