# 13 – Adversarial Apple-Reviewer-Simulation

**Datum:** 5. September 2026
**Gegenstand:** aktueller lokaler Audit-Stand, live erreichbare Produktionsdienste, App Store Connect read-only, die dort vorhandenen Builds 4/5 und das separat erzeugte EAS-Store-Archiv Build 7
**Grenze:** Build 7 (`1.0.0 (7)`, EAS `420935a7-2aed-43e1-9daf-cb53f306a549`) ist signiert und abgeschlossen. Die statische IPA-, Signatur-, Provisioning-, Entitlement-, Framework-, Privacy-Manifest- und Bundleprüfung ist dokumentiert und ohne P0/P1-Archivfund bestanden. Der Build wurde aber nicht nach App Store Connect/TestFlight hochgeladen und nicht auf einem physischen iPhone installiert oder ausgeführt. Deshalb können Geräte-, StoreKit-, zusammengeführte Xcode-Privacy-Report-, Apple-Processing- und Laufzeit-Netzwerkgates nicht positiv simuliert werden. Lokale Backend-/Webremediations sind nicht Produktionswahrheit.

## Durchlauf A – Strenger App Reviewer

### Vorgehen

1. EN/DE-App-Store-Entwurf, Screenshots, Namen, Untertitel und Beschreibungen gegen den Code geprüft.
2. Clean-Onboarding in EN/DE bei 320×568, 393×659, 402×874 und 430×932 im ausgelieferten Web-/Expo-Build ausgeführt.
3. Consent, Kamera-Ablehnung, Demo, Beschreibung offline, Suche, Portionsbestätigung, Ergebnis, Today, Plan, Rezept, Verlauf, Profil, Paywall und Account-Löschung durchlaufen.
4. Den historischen Produktionsstand von Gateway und Account-Löschung ohne/mit Auth geprüft; lokale Änderungen an Entitlement-, Provider-Limit-, Guardian-, Waitlist- und Legalpfaden wurden nur gegen Source/Validatoren geprüft und nicht deployed.
5. App Store Connect auf Build, IAP-Anhang, Produktstatus und Review-Informationen geprüft.

### Funde und Nachprüfung

| ID | Beobachtung | Guideline/Typ | Erste Bewertung | Korrektur/Re-Test | Endergebnis |
|---|---|---|---|---|---|
| REV-A-01 | Ein signiertes EAS-Auditarchiv Build 7 existiert, ist aber weder in App Store Connect/TestFlight noch an Version 1.0.0 angehängt oder auf einem Gerät ausgeführt; Subscriptions sind ebenfalls nicht angehängt und ihre Review-Metadaten fehlen | 2.1, 3.1.1, 3.1.2 / MANDATORY_APPLE | P0 | Build erzeugt, aber bewusst kein Upload/ASC-Mutation; manuelle Schritte exakt dokumentiert | FAIL |
| REV-A-02 | ASC-Beschreibung behauptete Datenexport, obwohl kein Exportflow existiert | 2.3.1 / MANDATORY_APPLE | P1 | Claim lokal EN/DE entfernt, Storevalidator grün; Upload in ASC offen | FAIL |
| REV-A-03 | 320×568-Onboarding überlagerte die dritte Zielwahl mit fixer CTA | 2.1 / TECHNICAL_QUALITY | P1 | Scroll-/Safe-Layout angepasst; vollständiger kleiner Onboardingflow erneut sichtbar | FIXED_VERIFIED |
| REV-A-04 | Offline-Textbeschreibung behauptete eine lokale Warteschlange, die es nur für Fotos gibt | 2.1 / TECHNICAL_QUALITY | P1 | Modusspezifische Copy; Validator und Screenshot vor/nach Fix | FIXED_VERIFIED |
| REV-A-05 | Cloudhydration zählte Suche/Plan/Demo als einen der drei bezahlten AI-Aufrufe und zeigte „Mahlzeiten“ statt „Analysen“ | 2.1, 3.1 / TECHNICAL_QUALITY | P1 | Origin-basierte Zählung und Paywall-Copy; automatischer + Runtime-Re-Test | FIXED_VERIFIED |
| REV-A-06 | Deutsche Suche „Haferflocken“ führte mit Nussplätzchen 517 kcal/100 g | 1.4, 2.1 / TECHNICAL_QUALITY | P1 | BLS-Compound-Gleichheit; Grundprodukt `C133000`, 348 kcal führt; Fixture + Runtime-Re-Test lokal; Gateway-Deployment offen | FAIL |
| REV-A-07 | Die sekundäre Aktion nach einem Suchtreffer versprach fälschlich „Foto wiederholen“ statt zur Suche zurückzuführen | 2.1 / TECHNICAL_QUALITY | P2 | Modusabhängige EN/DE-Copy und Route `/scan?mode=search`; `validate:search` sowie RT-034 mit Vor-/Nach-Screenshot | FIXED_VERIFIED |

### Realistische mögliche Rejection-Nachricht A

> **Guideline 2.1 – Information Needed / App Completeness**
> We were unable to complete review because the auto-renewable subscription products were not available with the submitted version and a current build was not selected. Please attach the subscriptions and a complete build, ensure all required metadata is provided, and confirm that purchase and restore can be exercised in the review environment.

**Reproduktion:** ASC → Version 1.0.0 → Build/IAP; beide Produkte „In Vorbereitung“, kein aktueller Build/Produktanhang. Unter TestFlight sind nur Builds 4 und 5 sichtbar; Build 7 befindet sich nur bei EAS.
**Evidenz:** `11_APP_STORE_CONNECT_PACKAGE.md`, `evidence/app-store-connect/01_testflight_builds.png`.
**Erforderliche Korrektur:** Paid Agreement/Bank aktiv, Produkt-Review-Screenshots, beide Subscriptions an 1.0.0, die abgeschlossene statische Build-7-Inspektion bei Produkt-/Buildänderung an einem Ersatzarchiv wiederholen, exakten Kandidaten nach TestFlight laden und auf einem physischen iPhone inklusive Sandbox-Kauf/Restore prüfen.

## Durchlauf B – Privacy Reviewer

### Vorgehen

1. Datenfelder von UI → AsyncStorage → Supabase → Edge Functions → OpenRouter/Azure/USDA/OFF/RevenueCat/PostHog/Resend verfolgt.
2. Einwilligungs-, Widerrufs-, Guardian-, Account-Link- und Account-Löschpfade geprüft.
3. Build 7 vollständig statisch entpackt und auf Signatur, Provisioning, Entitlements, Frameworks, Privacy Manifests, Required-Reason APIs, Bundleinhalte, Secrets und Entwicklungs-URLs untersucht; ein zusammengeführter Xcode-Privacy-Report, Apples Verarbeitung und die native Ausführung fehlen.
4. Veröffentlichte ASC App Privacy Antworten und Live-/lokale EN/DE-Policies gegen `04_DATA_PRIVACY_MAP.md` verglichen.
5. Providerfehler-, Wartelisten-, Analytics- und Subscription-Metadaten adversarial geprüft.

### Funde und Nachprüfung

| ID | Beobachtung | Guideline/Typ | Erste Bewertung | Korrektur/Re-Test | Endergebnis |
|---|---|---|---|---|---|
| REV-B-01 | ASC deklariert Name, Device ID, Product Interaction und Diagnostics nicht; RevenueCat-Purchase ist fälschlich riskant als unlinked interpretierbar | 5.1.1, App Privacy / MANDATORY_APPLE | P0 | Exakte Zielklassifikation dokumentiert; im Dashboard nicht publiziert | FAIL |
| REV-B-02 | Provider-Fehlerantwort konnte in Supabase-Logs landen und Foto-/Textinhalt enthalten | 1.6, 5.1.2 / MANDATORY_APPLE | P1 | Fehlerbody-Lesen/Logging lokal entfernt; Regression verhindert `response.text()`; Live-Deployment/-Logtest offen | FAIL |
| REV-B-03 | AI-Freigrenze/Pro war clientseitig umgehbar | 1.6, 3.1, 5.1 / TECHNICAL_QUALITY | P1 | Lokal: serverauthoritative Erfolgserfassung vor Confirm, idempotentes Ledger, globaler 1.000/UTC-Tag-Circuit-Breaker, RevenueCat Customer-Subscriptions-Abgleich, signierter Webhook/TRANSFER-Dedupe und authentifizierter Kauf-/Restore-Refresh; drei Migrationen, zwei Rate-Limit-Salts, sieben RevenueCat-Server-Secrets, gemeinsames Function-Deployment und Apple-Sandbox-E2E offen | FAIL |
| REV-B-04 | Waitlist versprach Löschung/Fristen ohne Löschroute/Cron; Confirmation hatte keinen Unsubscribe-Link | 5.1.1 / MANDATORY_APPLE | P1 | Unsubscribe, getrennte Tokens, Löschung, Cron und EN/DE-Mail lokal umgesetzt; Deploy + Live-E2E offen | FAIL |
| REV-B-05 | Guardian-Token konnte wiederverwendet werden; Fehler beim Löschen der Guardian-Adresse wurde ignoriert | 5.1.1/5.1.4 / MANDATORY_APPLE | P1 | Atomare Token-Consumption, Fail-closed-Cleanup und Expiry-Purge lokal; Deploy + Live-E2E offen | FAIL |
| REV-B-06 | Build 7 hat die statische IPA-/Deep-Signatur-/Framework-/Manifest-/Bundleprüfung bestanden; zusammengeführter Xcode-Privacy-Report, Apple-Processing und native Netzwerkausführung des exakten Kandidaten sind nicht belegt | Privacy manifests / MANDATORY_APPLE | P0 | Build-ID, Fingerprint, IPA-SHA-256, Signatur und 16 Manifeste in `evidence/build/28_eas_build7_summary.json` sowie `29_build7_archive_inspection.txt` bis `31_build7_xcode_log_extract.txt` dokumentiert | UNVERIFIED_BLOCKER |
| REV-B-07 | In-App-Accountlöschung entfernt Supabase/Kandro-Daten; historisch übermittelte PostHog-/RevenueCat-Nutzerdaten bleiben jedoch ohne nachgewiesene Anbieter-Erasure | 5.1.1(v) / MANDATORY_APPLE | P0 | Lokal werden PostHog-Identitäts-/Appversionswerte und Event-/AI-/Log-Queues nun explizit gelöscht (`validate:privacy` Exit 0); Live-Supabase-Löschtest bestanden; nativer Cleanup- und Drittanbieter-Erasure-/Retentionnachweis fehlt | FAIL |
| REV-B-08 | RevenueCat Sandbox Testing Access kann den loginlosen Apple-Reviewer aussperren oder Testentitlements zu breit freigeben | 2.1, 3.1.2 / MANDATORY_APPLE | P0 | Für Review ist `Anybody` nötig, weil die anonyme UUID nicht vorab bekannt ist; lokale Serverlogik akzeptiert nur Apple `app_store` plus exakte interne IDs und lehnt Test Store ab; Dashboard-Setting und Live-E2E offen | MANUAL_CONFIRMATION_REQUIRED |
| REV-B-09 | Ohne Upstream-spezifische Limits könnten anonyme Nutzer USDA, Open Food Facts oder RevenueCat über das Gateway erschöpfen | 1.6, 2.1 / TECHNICAL_QUALITY | P1 | Atomare User-/Netzwerk-/Global-Limits und eine Aufbewahrung unter zwei Stunden sind lokal implementiert und im vollständigen Verify bestanden; dritte Migration, echte Proxy/IP-Grenze und Live-Circuit-Breaker-Tests fehlen | FAIL |

### Realistische mögliche Rejection-Nachricht B

> **Guideline 5.1.1 – Data Collection and Storage**
> The App Privacy responses do not appear to describe all data collected by the app and its third-party SDKs. In particular, the app uses analytics/diagnostic identifiers and links purchase status to an app user identifier, while these practices are not fully disclosed. Please update the App Privacy details and ensure they match the privacy policy and submitted binary.

**Reproduktion:** ASC → App Privacy gegenüber `telemetry.ts`, RevenueCat-Supabase-UUID, finalem Dateninventar.
**Evidenz:** `04_DATA_PRIVACY_MAP.md`, `11_APP_STORE_CONNECT_PACKAGE.md` und Build-7-Archiv-/Manifestbelege 29–31.
**Erforderliche Korrektur:** App Privacy veröffentlichen, lokale Policy deployen, providerbezogene pseudonyme Kurzzeitzähler einbeziehen, bei geänderten Build-Eingaben einen sauberen neuen Submission-Build erzeugen und für exakt diesen Kandidaten den zusammengeführten Xcode Privacy Report sowie Apples Processing belegen; danach alle Darstellungen erneut abgleichen.

## Durchlauf C – Design-, HIG- und Qualitätsreviewer

### Vorgehen

1. Jeden erreichbaren Kernscreen in Light und Dark sowie kleinen/großen Viewports geprüft.
2. Textabschneidung, Safe Area, Keyboard, Lade-/Leer-/Fehlerzustände, Navigation und Touchziele bewertet.
3. EN↔DE-Sprachwechsel, lange deutsche Texte, Einheiten und Datum/Wochentage geprüft.
4. Landingpage/Support/Legal in mobilen/iPad-Viewports und Lighthouse geprüft.
5. Accessibility-Codevalidatoren sowie sichtbare Semantik geprüft; physischer VoiceOver-/Switch-Control-Test als Grenze geführt.

### Funde und Nachprüfung

| ID | Beobachtung | Guideline/Typ | Erste Bewertung | Korrektur/Re-Test | Endergebnis |
|---|---|---|---|---|---|
| REV-C-01 | Wochentagschart blieb nach Sprachwechsel Englisch | Accessibility/Localization / HIG_QUALITY | P2 | `locale` als Memo-Abhängigkeit; EN→DE-Re-Test zeigt Sa–Fr | FIXED_VERIFIED |
| REV-C-02 | Landingpage Hero-Microcopy nur 3,47:1 | Accessibility/Contrast / HIG_QUALITY | P2 | Farbe lokal angepasst; 5,20:1 und Lighthouse ohne Kontrastfund; Website-Deployment offen | FAIL |
| REV-C-03 | Deutsche Terms hatten bei 320 px horizontalen Overflow | HIG_QUALITY | P2 | Break/Wrap lokal korrigiert; 320/375/390/430 getestet; Website-Deployment offen | FAIL |
| REV-C-04 | Maximales Dynamic Type, VoiceOver-Reihenfolge und Kamera-Torch auf echtem iPhone nicht final geprüft | Accessibility / HIG_QUALITY + 2.1-Risiko | P1 | Automatische Semantik-/Layoutchecks vorhanden | MANUAL_CONFIRMATION_REQUIRED |
| REV-C-05 | GitHub Pages kann empfohlene CSP/HSTS/X-Content-Type-Options nicht setzen | TECHNICAL_QUALITY | P2 | Keine risikofreie lokale Lösung für Live-Hosting; kein alleiniger App-Review-Blocker | FAIL |
| REV-C-06 | Englischer Plan zeigte `0,7×`/`1,4×` mit deutschem Dezimalkomma | Localization / HIG_QUALITY | P2 | Gemeinsames Locale-Formatting; `validate:formatting` und RT-042 mit EN-/DE-Runtime-Screens | FIXED_VERIFIED |

### Realistische mögliche Rejection-Nachricht C

Solange der final korrigierte Build nicht auf einem physischen Gerät geprüft ist, bleibt folgende Rejection realistisch, aber **nicht als bereits beobachtete Ablehnung behauptet**:

> **Guideline 2.1 – Performance: App Completeness**
> On iPhone, portions of onboarding or the purchase flow were not fully usable with larger text settings. Please ensure all controls remain visible and actionable with Accessibility text sizes and provide a revised build.

**Reproduktion vor Fix:** kleines 320×568-Layout, Onboarding-Zielschritt, lange deutsche Inhalte; anschließend maximale Dynamic-Type-Größe auf echtem iPhone.
**Evidenz:** `evidence/runtime/pre_fix_onboarding_de_320x568_scrolled.png`, `head_onboarding_de_320x568_light_fixed.png`.
**Erforderliche Korrektur:** Source-Fix ist vorhanden; endgültige native VoiceOver/Dynamic-Type-Geräteprüfung fehlt.

## Ergebnis nach drei Durchläufen

- Alle während der Simulation sicher lokal behebbaren P1-Produktfehler wurden korrigiert und erneut geprüft.
- Kein Reviewer-Erkennungs-, Review-Modus- oder verborgenes Verhalten wurde gefunden oder eingebaut.
- Der erneute Durchlauf bestätigt, dass Build 7 als signiertes Store-Archiv existiert. Zwingende externe/live Blocker bleiben jedoch: kein Upload/keine Installation dieses Kandidaten, unvollständige App Privacy, genau drei nicht angewandte Migrationen, nicht deployte Backend-/Webkorrekturen, fehlende Server-Secrets, IAP/Businessstatus und fehlende physische StoreKit-/Accessibility-/Kamera-/Offline-Tests.
- Ergebnis der Simulation: **`FAIL` für die Einreichung am Audit-Stichtag**; fehlende finale Native-/StoreKit-Nachweise bleiben `UNVERIFIED_BLOCKER`. Das ist keine Prognose über Apples Entscheidung, sondern die Folge nicht bestandener Pflicht-Gates.
