# 16 - Finales GO/NO-GO

> **Update 2026-09-05: NO_GO nach Build-8-Gerätefeedback.** Score und
> Einschätzung darunter sind historisch. Die korrigierte App muss erneut auf
> einem iPhone geprüft werden. Siehe `18_BUILD8_FEEDBACK.md`.

## 1. Urteil

**Status: `CONDITIONAL_NO_GO`**

Kandro ist technisch und operativ bereit für den finalen TestFlight-Pass. Der
frühere harte `NO_GO`-Stand ist remediated. App Review bleibt bis zum
physischen Pass des exakten Kandidaten und zur abgeschlossenen
DSA-Händlerverifizierung gesperrt.

## 2. Submission Readiness Score

| Kategorie | Punkte | Maximum | Aktueller Nachweis |
| --- | ---: | ---: | --- |
| Apple Guidelines und Geschäftsmodell | 18 | 20 | Paid Apps, Bank, Tax, W-8BEN und DAC7 aktiv; DSA noch `In Review` |
| Release Build, Stabilität und Runtime-QA | 17 | 20 | reproduzierbarer sauberer Commit, komplette CI/Regression grün, Build 8 angestoßen; physischer Pass offen |
| Datenschutz, Tracking und Privacy Manifest | 19 | 20 | acht ASC-Datentypen veröffentlicht, Tracking `No`, Consent/Erasure/live Policy belegt; native Cleanup-Prüfung offen |
| Codequalität, Security und Abhängigkeiten | 14 | 15 | Servergrenzen, RLS, Limiter und Live-SQL-Lint grün; Expo-54-Buildtooling hat bekannte transitive Advisories |
| Login, Account-Löschung, IAP und Subscriptions | 8 | 10 | loginloser Reviewpfad, RevenueCat-Erasure und beide Abos bereit; Apple-Sandbox-Matrix offen |
| UI, UX, HIG und Accessibility | 9 | 10 | responsive EN/DE-, Dark-Mode-, Kamera- und A11y-Validatoren grün; echte VoiceOver-/Dynamic-Type-Hardware offen |
| Landingpage, Support und Metadaten | 5 | 5 | zweisprachig live, zentrale URLs 200, Metadaten und Screenshots vollständig |
| **Gesamt** | **90** | **100** | **TestFlight-ready, noch nicht App-Review-ready** |

## 3. Aktuelle Gate-Matrix

| Gate | Status | Begründung / nächster Nachweis |
| --- | --- | --- |
| Vollständiger lokaler Verify und GitHub-CI | PASS | `npm run verify`, Production-Env-Prüfung und CI für `9a95530` bestanden |
| Produktives Backend | PASS | Migrationen up to date; SQL-Lint ohne Befund; Functions und Live-Grenztests bestanden |
| App Privacy und öffentliche Rechtstexte | PASS | ASC-Angaben veröffentlicht; Privacy 1.7 und alle Pflichtseiten zweisprachig live |
| Account-Löschung | PASS_CODE_AND_LIVE | Supabase- und RevenueCat-Löschung fail-closed; lokaler Cleanup implementiert; Gerätetest bleibt Teil der Matrix |
| Subscriptions und RevenueCat | PASS_CONFIGURATION | zwei Produkte `READY_TO_SUBMIT`, Offering/Entitlement/Webhook/Least Privilege gesetzt; Sandbox-Lauf offen |
| Paid Apps/Bank/Tax/DAC7 | PASS | in Apple aktiv |
| DSA-Händlerstatus | MANUAL_CONFIRMATION_REQUIRED | Apple verarbeitet die eingereichten Angaben noch |
| Exakter Submission-Build | IN_PROGRESS | Build 8 aus Commit `9a95530`; Apples Processing/TestFlight-Installation ausstehend |
| Physische Geräte-/StoreKit-/A11y-Matrix | UNVERIFIED_BLOCKER | nur auf echtem iPhone und mit Apple Sandbox vollständig beweisbar |
| App-Review-Entwurf | INTENTIONALLY_NOT_SUBMITTED | Eigentümer will vor dem finalen Absenden alles selbst prüfen |

## 4. Abhängigkeitsentscheidung

`npm audit --omit=dev` meldet 26 transitive Knoten ohne Critical-Befund. Die
Advisories liegen überwiegend im Expo-/Metro-/PostCSS-Buildtooling; die
angebotene automatische Reparatur ist ein Major-Sprung von Expo SDK 54 auf 57
und damit keine vertretbare Last-Minute-Änderung am bereits vollständig
validierten Kandidaten. Diese Node-Werkzeuge werden nicht als ausführbarer
Server im iOS-Archiv ausgeliefert. Der Upgrade-Pfad wird nach 1.0 geplant;
Build 8 muss dennoch Apples eigene Upload-/SDK-Prüfung fehlerfrei bestehen.

## 5. Freigaberegel

Der Status wechselt erst auf `GO`, wenn alle folgenden Aussagen gleichzeitig
belegt sind:

1. Build 8 ist in App Store Connect `VALID`, installiert und exakt der in der
   Version ausgewählte Build.
2. Die physische Matrix aus `15_OWNER_INPUT_REQUIRED.md` ist ohne offenen P0
   bestanden.
3. DSA steht nicht mehr auf `In Review`.
4. Reviewer Notes, Screenshots, Privacy-Antworten und beide ersten
   Subscriptions wurden im fertigen Entwurf nochmals visuell verglichen.
5. Der Eigentümer gibt danach erst `Add for Review` und anschließend separat
   `Submit for Review` frei.

Bis dahin lautet die präzise Entscheidung: **90/100,
`CONDITIONAL_NO_GO`, selbstbewusst bereit für den letzten TestFlight-Pass.**
