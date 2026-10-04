# Native Beobachtungen am 6. September 2026

SIMULATOR: Kandro QA Local, iPhone 17 Pro, iOS 26.5, DBA83E22-0DF4-4B41-81FE-EF8C9EAA4F6D. Lokales Debug-Binary mit aktuellem Metro-JavaScript; kein TestFlight-Binary und kein physisches iPhone.

- Nach neuem Metro-Start App neu geöffnet: Today enthält die gespeicherte Beispielmahlzeit; Tagesziel 2420 kcal und Rest 1710 kcal.
- Profile zeigt metrische Angaben 178 cm / 78,4 kg, Analytics aus.
- English-Auswahl aktualisiert sichtbare Profilsprache, Navigation und Zahlenformat (2,420 / 78.4).
- Native Paywall lädt Jahresabo $44.99 / year und Monatsabo $6.99 / month; USD-Preis ist kein Beleg für DE-/UK-/SG-/BR-Storefront.
- Annual/Monthly-Auswahl aktualisiert Verlängerungstext; Terms, Privacy, Close und Restore vorhanden.
- Restore ohne angemeldeten Kaufaccount führt zu lokalisierter Meldung No active subscription found. Zusätzlich RevenueCat App-Store-Warnung im Debug-Overlay. Das ist KEIN erfolgreicher Restore-Nachweis.
- Monatlicher Kaufversuch öffnet Apple-Account-Anmeldedialog. Dort für Sandbox-Login an Nutzer übergeben. Kein Kauf bestätigt, keine Zahlung durchgeführt.
- xcrun devicectl list devices: No devices found. Physische Kamera, TestFlight-Runtime, StoreKit-Kauf, aktive Wiederherstellung, Erneuerung und Ablauf bleiben UNVERIFIED.
- Sprachprüfung umfasst diese sichtbaren Screens plus automatisierte Wörterbuch-/Routing-/Zahlen-/Datumstests. Keine vollständige manuelle DE/EN-Screenmatrix, VoiceOver-, XXL-Dynamic-Type- oder iOS-15-Hardware-Freigabe.

## Sandbox-Anmeldung: erneuter Versuch, ca. 13:18–13:21 MESZ

- APP_STORE_CONNECT: Genau ein neuer Sandbox-Testaccount „Kandro Test“, Deutschland, nach Aktualisierung sichtbar. Keine Zugangsdaten im Audit gespeichert.
- SIMULATOR: Nutzer hat Zugangsdaten selbst eingegeben und bestätigt. Erneute Monatskaufversuche kehren ohne Kaufbestätigung zur bedienbaren Paywall zurück. RevenueCat meldet „Purchase was cancelled“. Keine Transaktion oder Pro-Freischaltung bestätigt.
- Native StoreKit-Diagnose: `Authenticate failed for sandbox`, AMSErrorDomain Code 100. Um 13:19:07 und 13:20:14 enthält die Fehlerkette `AMSStatusCode=502` für Apples Sandbox-Authentifizierungsendpoint. Zusätzlich `Password reuse not available for account` und keine lokale Kaufquittung. Daraus folgt kein belegtes falsches Passwort und keine belegte globale Apple-Störung.
- Netzwerkdiagnose: Automatische Proxykonfiguration und Proxy-Erkennung sind am Mac aktiv; StoreKit protokolliert auch PAC-Auflösungsfehler -1003. Ursächlicher Zusammenhang mit HTTP 502 ist nicht belegt. Keine Netzwerk-/Proxykonfiguration verändert.
- Apples öffentliche Developer-Statusseite ließ sich über den Web-Reader ohne Statusdaten lesen; kein Ausfall daraus abgeleitet.
- `xcrun devicectl list devices` erneut: No devices found. Nächster sinnvoller Vergleich ist der vorbereitete Build 15 auf einem echten iPhone mit TestFlight. Kauf-/Restore-Gate bleibt UNVERIFIED; keine Review-Einreichung, keine zusätzlichen bezahlten Aufrufe oder Builds.
