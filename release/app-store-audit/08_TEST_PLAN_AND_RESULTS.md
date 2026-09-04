# 08 – App-Runtime-Testplan und Ergebnisse

**Audit-Stichtag:** 5. September 2026
**Bewertete Source-Basis:** Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5` plus der gemeinsame, noch nicht eingecheckte Audit-Remediation-Stand
**Ausführungsziele:** lokaler Expo-Webbuild unter `http://localhost:8090`, vollständige Repo-/Release-Validatoren und EAS Production Archive
**Gesamtergebnis:** `UNVERIFIED_BLOCKER` – der Web-Runtime-Durchlauf deckt die Kernabläufe breit ab; EAS hat Build 7 erfolgreich signiert und dessen statische Archivinspektion ist positiv. Das IPA wurde jedoch noch nicht installiert, nicht zu TestFlight/App Store Connect hochgeladen und nicht mit den zwingenden Geräte-, StoreKit- und Assistive-Technology-Tests ausgeführt.

## Beweisgrenze: Build 7 ist signiert, aber noch nicht nativ freigegeben

| Gegenstand | Identität | Aussagekraft |
|---|---|---|
| EAS Store-Archiv Build 7 | EAS Build `420935a7-2aed-43e1-9daf-cb53f306a549`, App `1.0.0 (7)`, Bundle `com.hewaddorani.kandro`, SDK 54, Fingerprint `e410ce56a5e09e470cff837903cbbb433924a639`, IPA-SHA-256 `c027a495…b6d4e` | **Aktuelles signiertes Audit-IPA.** arm64, iOS 15.1, Xcode/SDK 26.0, App-Store-Profil, `get-task-allow=false`, strikte Deep-Signatur PASS, ATS strict, 16 Privacy Manifests; keine Provider-Secrets/operative Dev-URL. Noch keine Installation, kein TestFlight-/ASC-Upload und keine Submission. |
| Lokaler Audit-Stand | Basis-Commit `22b1bf91af7824ffb976389e8bf259a0c8c1ccb5` plus lokale Auditänderungen | Grundlage der Browser-, Quellcode- und Regressionstests; `npm run verify` im finalen Lauf 26 vollständig bestanden. |
| Git-/Build-Identität | EAS nennt den Basis-Commit `22b1bf91…`, der Upload enthielt aber lokale Auditänderungen | Der EAS-Fingerprint identifiziert den Upload belastbarer als der nominale Git-Commit. Deshalb wird keine falsche Commit-Gleichheit behauptet. |
| Tatsächlicher Submission-Release-Candidate | Noch nicht in TestFlight/ASC ausgewählt | Nach Backend-/Web-/ASC-Freigabe Build 7 nur dann verwenden, wenn kein Produktcode mehr abweicht; sonst neu bauen. Exakt das ausgewählte Artefakt installieren und vollständig testen. |

Dateinamen mit `head_` oder `build_head_` unter `evidence/runtime` bezeichnen den während des Audits ausgeführten lokalen Arbeitsstand. Sie sind **kein** nativer Laufzeitnachweis für Build 7. Der erfolgreiche EAS-Build belegt Kompilierung/Signierung, nicht das Verhalten auf einem iPhone.

## Statuslegende

- `PASS`: Der exakt beschriebene Web-/Code-Test wurde reproduzierbar bestanden.
- `FIXED_VERIFIED`: Ein im Audit reproduzierter Defekt wurde lokal behoben und durch einen gezielten Re-Test verifiziert.
- `MANUAL_CONFIRMATION_REQUIRED`: Der Test braucht echte iOS-Hardware, Apple-/StoreKit-Infrastruktur oder menschliche Wahrnehmung und wurde nicht als bestanden gewertet.
- `UNVERIFIED_BLOCKER`: Ohne diesen Nachweis darf aus diesem Bericht kein Release-Go abgeleitet werden.
- `NOT_APPLICABLE`: Für den aktuellen Funktionsumfang nicht anwendbar.

## Testumgebung

| Merkmal | Wert |
|---|---|
| Host | macOS 13.4 (22F2063), Apple Silicon |
| Node / npm | Node `v24.14.1`, npm `11.11.0` |
| App-Stack | Expo `54.0.27`, React Native Web über lokalen Expo-Build |
| Browserautomation | `@playwright/cli 0.1.19`, isolierte Chromium-Sessions |
| Viewports | 320×568, 393×659, 402×874, 430×932 und 1280×720 |
| Sprachen | Englisch und Deutsch; Wechsel innerhalb derselben hydratisierten Sitzung geprüft |
| Erscheinungsbilder | Light und Dark; `prefers-reduced-motion: reduce` zusätzlich im Browser emuliert |
| Persistenz | Isolierte anonyme Supabase-/LocalStorage-Sitzungen; Reload und Cloud-Hydration geprüft |
| Backend-Grenze | Produktive Lesewege wurden nur sicher/read-only verwendet. Für den korrigierten BLS-Retest wurde der aktuelle lokale Gateway auf `127.0.0.1:8787` verwendet. Kein Deployment. |
| Nativer Artefaktcheck | Build 7 statisch per SHA-256, Unzip, Plist/Provisioning/Entitlements, `file`, Framework-/Privacy-Manifest-Inventar, `codesign --deep --strict` und Bundle-Patternscan; kein Appstart |

Web-Runtime ist für Layout, Routing, Copy, Browser-Accessibility-Tree und deterministische Zustandslogik aussagekräftig. Sie beweist **nicht** native Safe Areas, Kamera-/Torch-Hardware, StoreKit, VoiceOver, tatsächliche Dynamic-Type-Skalierung, die kleinste unterstützte iOS-Version oder Verhalten nach OS-Prozessabbruch.

## Ausgeführte Testmatrix

| ID | Bereich und Ablauf | Erwartung | Ergebnis | Evidenz / Einschränkung |
|---|---|---|---|---|
| RT-000 | Build-7-Archivintegrität und Production-Bundle | Storeprofil, Release-Signatur, arm64, korrekte ID/Version/Minimum/SDK, kein Debugentitlement, ATS strict, Privacy Manifests, keine Secrets/Dev-URL | PASS | Statische Archivprüfung: 1.0.0 (7), arm64, iOS 15.1, Xcode/SDK 26.0, `get-task-allow=false`, `codesign --deep --strict` PASS, 16 Manifeste, keine Provider-Secrets/operative Dev-URL. `aps-environment=production` bleibt P2-Least-Privilege-/Local-Notification-Gate. [Evidenz](./evidence/build/29_build7_archive_inspection.txt) und [Bundle-Scan](./evidence/build/30_build7_bundle_scan.txt). |
| RT-001 | App-Kaltstart mit leerem Browserzustand | Start ohne Crash; unvollständiges Profil landet im Onboarding | PASS | HTTP 200 auf `localhost:8090`; isolierte Session öffnete Schritt 1 |
| RT-010 | Vollständiges Onboarding, EN und DE | Alle 11 Schritte erreichbar; Auswahl springt nicht automatisch weiter; `Weiter/Continue` bleibt explizit | PASS | Schritte `goal`, `name`, `sex`, `age`, `rate`, `height`, `weight`, `activity`, `preferences`, `building`, `plan` durchlaufen; [EN-Schritte](./evidence/runtime/head_onboarding_plan_en_393x659_light.png) |
| RT-011 | Onboarding auf 320×568 und 393×659 | Keine horizontale Überläufe, keine Option unter fixer CTA, Wahl und Weiter erreichbar | FIXED_VERIFIED | Vorher Überlagerung; nach Fix 18 px sichtbarer Abstand bei 320×568. [Vorher](./evidence/runtime/pre_fix_onboarding_de_320x568_scrolled.png), [nachher](./evidence/runtime/head_onboarding_de_320x568_light_fixed.png) |
| RT-012 | Browser-Textskalierung 135 % bei 320×568 | Inhalt bleibt scrollbar; letzte Option und CTA bleiben erreichbar | FIXED_VERIFIED | Interner Scrollinhalt 580 px bei 432 px Viewport; [Evidenz](./evidence/runtime/head_onboarding_de_320x568_large_text_stress.png). Dies ist nur ein Web-Stresstest, kein nativer Dynamic-Type-Pass. |
| RT-013 | Altersgrenzen/Guardian-Ablauf für 14–15 | Unter 14 blockiert; 14–15 Guardian-Ablauf einschließlich echter Zustellung/Bestätigung | MANUAL_CONFIRMATION_REQUIRED | Age-Step sichtbar und Code-Gates vorhanden; vollständige Zustellung, Link, Wiederaufnahme und internationale Rechtskonformität nicht in diesem Runtime-Lauf bestätigt. |
| RT-020 | KI-Einwilligungsdialog | Anbieter, Datenweg, Modell, Training/ZDR, Widerruf und Rechtslinks verständlich; Dialog fokussierbar | PASS | OpenRouter USA → Microsoft Azure, GPT-4.1 mini, kein Training/ZDR angezeigt; [Consent](./evidence/runtime/head_consent_en_393x659_light.png) |
| RT-030 | Scan-Startseite | Foto, Beschreibung, Barcode und Suche erreichbar; Browser-Permission-Zustand verständlich | PASS | Vier Modi navigiert; [Permission UI](./evidence/runtime/head_scan_permission_en_393x659_light.png) |
| RT-031 | Echte Kamera, Deny→Allow, Retake, Torch, Barcodegeschwindigkeit | Auf physischem iPhone zuverlässig; Permission- und Hintergrundzustände korrekt | MANUAL_CONFIRMATION_REQUIRED | Web-Camera-/Mockpfad reicht für native Hardware nicht aus. Kein PASS vergeben. |
| RT-032 | EN-Datenbanksuche „banana“ | Suchergebnis ohne KI-Kontingent; Portion änderbar | PASS | Ergebnisliste und Portion Sheet durchlaufen; [Suche](./evidence/runtime/head_search_results_en_393x659_light.png), [Portion](./evidence/runtime/head_portion_sheet_en_393x659_light.png) |
| RT-033 | DE-Suche „Haferflocken“ | Grundprodukt vor zusammengesetzten Speisen, plausible Referenzwerte | FIXED_VERIFIED | Vor Fix führte Nussplätzchen mit 517 kcal/100 g; lokaler aktueller Gateway führt `Hafer Flocken`, 348 kcal/100 g. [Vorher](./evidence/runtime/head_search_results_de_393x659_light.png), [lokaler Re-Test](./evidence/runtime/head_search_results_de_haferflocken_fixed_393x659_light.png). Produktionsdeployment bleibt offen. |
| RT-034 | Suchtreffer → Bestätigung → Ergebnis → Speichern → Reload | Menge/Nährwerte werden übernommen; genau ein Eintrag bleibt nach Reload bestehen; sekundäre Aktion führt wahrheitsgemäß zurück zur Suche | FIXED_VERIFIED | 100 g auf 250 g geändert, bestätigt, Ergebnis gespeichert und nach Reload wiedergefunden. Search-CTA sagt jetzt „Anderes Lebensmittel suchen“ und öffnet `/scan?mode=search` mit fokussiertem Suchfeld. [Vor Fix](./evidence/runtime/head_confirm_search_item_en_393x659_light.png), [nach Fix](./evidence/runtime/head_confirm_search_item_de_393x659_light_fixed.png), [Ergebnis](./evidence/runtime/head_result_en_393x659_light.png) |
| RT-035 | Offline-Beschreibung | Keine falsche Behauptung über lokale Speicherung; keine Queue-Zeile | FIXED_VERIFIED | Vorher „queued locally“, obwohl `@kandro/analysis-queue:v1` `null` blieb; nach Fix „not sent or saved“, Storage weiter `null`. [Vorher](./evidence/runtime/head_description_offline_error_en_393x659_light.png), [nachher](./evidence/runtime/head_description_offline_error_en_393x659_light_fixed.png) |
| RT-036 | Offline-Fotoqueue, Wiederholung, App-Kill | Foto lokal vorgemerkt; genau einmal nach Netzrückkehr gesendet; kein Verlust/Duplikat | MANUAL_CONFIRMATION_REQUIRED | Nur Foto darf queued werden. Browser-/Codeprüfung positiv, aber echter iOS-Prozessabbruch und Retry fehlen. |
| RT-040 | Heute-Übersicht und Tageswerte | Gespeicherte Mahlzeit erscheint einmal; Kalorien/Makros/Slots aktualisieren sich | PASS | [Ein Mahlzeiteneintrag](./evidence/runtime/head_today_one_meal_en_393x659_light.png), kleine und große Viewports geprüft |
| RT-041 | Plan → Kontext → drei Vorschläge → Rezept → geplante Mahlzeit loggen | Kontext und Restbudget fließen ein; Tag wird danach neu berechnet | PASS | Drei Vorschläge, Rezept und Portionswahl durchlaufen; [Plan](./evidence/runtime/head_plan_options_en_393x659_light.png), [Rezept](./evidence/runtime/head_recipe_en_393x659_light.png) |
| RT-042 | EN-/DE-Plan-Portionsmultiplikatoren | Aktive Locale bestimmt Punkt oder Komma | FIXED_VERIFIED | Gemeinsamer `formatNumber` liefert im Runtime EN `0.7×`/`1.4×` und DE `0,7×`/`1,4×`; [EN](./evidence/runtime/head_plan_multiplier_en_393x659_light_fixed.png), [DE](./evidence/runtime/head_plan_multiplier_de_393x659_light_fixed.png); `validate:formatting` Exit 0. |
| RT-050 | Verlauf/Progress nach einer Mahlzeit | Ein Tag/eine Mahlzeit, Streak 1, Gewichtseingabe validiert | PASS | Begrenzter Umfang: Ein-Tages-Fall und Fehler für `abc` geprüft; [Progress EN](./evidence/runtime/head_progress_en_393x659_light.png). Mehrtages-, DST-, Zeitzonen- und Tageswechseltest bleibt manuell. |
| RT-051 | EN→DE-Wechsel und sofortiger Progress-Aufruf | Wochentage wechseln ohne Neustart zu DE | FIXED_VERIFIED | Vor Fix blieb Chart Englisch; nach Memo-Fix `Sa/So/Mo/Di/Mi/Do/Fr`. [Vorher](./evidence/runtime/head_progress_de_weekday_locale_bug_393x659_light.png), [nachher](./evidence/runtime/head_progress_de_weekday_locale_fixed_393x659_light.png) |
| RT-052 | Profil | Name, Ziel, Einheiten, Sprache, Theme, KI-Einwilligung, Pro und Account-Löschung auffindbar | PASS | [Profil](./evidence/runtime/head_profile_en_393x659_light.png) |
| RT-060 | Paywall UI | Vorteile, Planwahl, Storepreis-/Periode, Auto-Renew, Restore und Rechtslinks sichtbar | PASS | Darstellung in Light/Dark und Radiozustand geprüft; [Light](./evidence/runtime/head_paywall_en_393x659_light.png), [Dark](./evidence/runtime/head_paywall_en_393x659_dark.png). StoreKit bleibt manuell; Käufe wurden nicht ausgelöst. |
| RT-061 | Kostenlose KI-Analysen nach Hydration | Nur echte Foto-/Textanalyse zählt; Suche/Barcode/Demo/Plan nie; Copy sagt „Analysen“ | FIXED_VERIFIED | Vor Fix setzte eine Suchmahlzeit nach Hydration Lifetime=1. Nach Fix blieben Plan-Ursprünge ohne Lifetime-Key/Paywall-Zähler; `validate:allowance` Exit 0. [Paywall nach Fix](./evidence/runtime/head_allowance_fix_paywall_en_1280x720_light.png) |
| RT-062 | Pro-Leistungsclaim | UI widerspricht dem serverseitigen Maximum von 60 Analysen/Tag nicht | FIXED_VERIFIED | EN/DE im Source-/Regressionstest auf „up to/bis zu 60“ korrigiert; `validate:entitlements` Exit 0. Native StoreKit-Darstellung im finalen Build bleibt manuell. |
| RT-063 | Kaufen, Restore, Cancel, Pending, Ask to Buy, Fehler, Grace, Refund, Expiry | Jeder StoreKit-Zustand ist korrekt und Entitlement folgt Server/Store | UNVERIFIED_BLOCKER | Kein StoreKit im Web. Sandbox-Matrix auf finalem iOS-Build zwingend. |
| RT-064 | Account-Löschdialog | Löschung erst nach expliziter Checkbox; Apple-Abo-Hinweis getrennt | PASS | UI: Button vor Bestätigung deaktiviert; [Evidenz](./evidence/runtime/head_account_deletion_en_393x659_light.png). Live-E2E ist separat in Netzwerk-/Security-Evidenz dokumentiert. |
| RT-065 | USDA-/OFF-/RevenueCat-Providergrenzen | Jeder externe Cache-Miss-/REST-Aufruf beansprucht atomar User-/Netz-/Global-Slots; keine Query-/Barcode-Speicherung; Retention <2 h | FIXED_VERIFIED | Lokal geprüft: `validate:provider-limits` und `validate:entitlements` prüfen Schema, Grants, Limits, Lock-/Claim-Reihenfolge, Webhook-Batchreservierung und Callsite-Pflicht. Migration/Salts/Functions sind nicht live; reale Parallel-/429-/Fenstergrenztests bleiben offen. |
| RT-070 | Responsive Kernnavigation | Tabbar und Inhalte auf 320×568, 393×659, 402×874 und 430×932 bedienbar | PASS | Web-Evidenz: [Heute 320](./evidence/runtime/head_today_en_320x568_light.png), [Heute 430](./evidence/runtime/head_today_en_430x932_light.png) |
| RT-071 | Dark Mode | Today und Paywall bleiben lesbar und visuell kohärent | PASS | Web-Evidenz: [Today Dark](./evidence/runtime/head_today_en_402x874_dark.png), [Paywall Dark](./evidence/runtime/head_paywall_en_393x659_dark.png); Live-OS-Themewechsel auf iOS nicht geprüft |
| RT-080 | Radio-Semantik | Auswahlzustand wird als `checked` an Accessibility APIs exponiert | FIXED_VERIFIED | Im Web geprüft: Vor Fix hatten Radioelemente kein `aria-checked`; danach Onboarding `true,false,false`, Paywall `true,false`; AX-Snapshot markierte aktive Option `[checked]`; Validator Exit 0. VoiceOver bleibt manuell. |
| RT-081 | Tastaturbedienung | Fokus erreicht Optionen in sinnvoller Reihenfolge und danach Weiter | PASS | Web-Evidenz: Onboarding drei Radios, dann `Continue`; Dialogfokus wechselte in den Consent-Dialog |
| RT-082 | Farbsystem-Kontrast | Primäre Text-/Flächenkombinationen erreichen 4,5:1 | PASS | Statische Tokens: muted/canvas 4,54; muted/surface 5,03; accentText/accent 5,57; weiß/accentDeep 8,52; Dark muted/background 8,00. Foto-Overlays und iOS-Kontrastmodi bleiben manuell. |
| RT-083 | Reduce Motion | Kernanimationen werden reduziert/übersprungen | MANUAL_CONFIRMATION_REQUIRED | Web/Code: `prefers-reduced-motion: reduce` aktiv; Analyseschritte springen laut Code direkt zum Ende. Native iOS-Einstellung nicht ausgeführt. |
| RT-090 | Dev-Konsole | Keine unbehandelten App-Ausnahmen in durchlaufenen Online-Flows | PASS | P3-Warnungen zu `expo-notifications` im Web, veralteten `shadow*`-Props und einmal `pointerEvents`; erwartete Fetchfehler nur im absichtlichen Offline-Test. |

## Im Audit behobene Runtime-Defekte

### RT-FIX-01 – Gratis-Kontingent/Paywall wurde durch kostenlose Wege verbraucht (P1)

**Ursache:** Die Cloud-Hydration behandelte das Vorhandensein irgendeiner gespeicherten Mahlzeit als Beweis für eine kostenpflichtige KI-Analyse. Suche, Barcode, Demo und Plan persistieren jedoch bewusst als `origin='plan'`. Dadurch konnte bereits eine Datenbanksuche den dauerhaften Analysezähler anheben und eine verfrühte Paywall auslösen.

**Lokale Korrektur:**

- `hasCloudAnalyzedMeal()` filtert serverseitig auf `origin='scan'`.
- `hasAnalyzedMeal()` verwendet denselben Ursprung im lokalen Merge.
- Der bestehende Modus-Gate hält `demo`, `search` und `barcode` kostenlos; Planmahlzeiten haben ebenfalls `origin='plan'`.
- Paywall-Copy nennt wahrheitsgemäß KI-Analysen statt geloggter Mahlzeiten.
- `validate-analysis-allowance.mjs` prüft deterministisch Plan/Suche/Barcode/Demo gegen Foto/Text und den Hydration-Pfad.

**Re-Test:** isolierte anonyme Sitzung, Suchmahlzeit plus Demo, Reload/Cloud-Hydration; `@kandro/lifetime-scans:v1` blieb nicht gesetzt und die Paywall zeigte keinen falschen Fortschritt. Ergebnis `FIXED_VERIFIED`.

### RT-FIX-02 – CTA überlagerte Onboarding-Option auf kleinem Display (P1)

**Ursache:** Normale vertikale Abstände und Kartenhöhen trafen auf eine fixierte untere CTA bei nur 568 px Höhe.

**Lokale Korrektur:** Der Onboarding-Screen nutzt die Fensterhöhe, einen kompakten Modus bis 600 px und behält den scrollbaren Inhalt oberhalb der Safe-Area-CTA.

**Re-Test:** alle 11 Schritte auf 320×568 und 393×659 sowie 135-%-Web-Textstress. Keine horizontale Überbreite, Auswahl und Weiter erreichbar, keine Option/CTA-Überlagerung. Ergebnis `FIXED_VERIFIED`; echte Dynamic Type/Safe Area bleibt `MANUAL_CONFIRMATION_REQUIRED`.

### RT-FIX-03 – Falsche Offline-Zusage (P1)

**Ursache:** Die gemeinsame Offline-Copy behauptete auch bei Beschreibung, Barcode und Suche eine lokale Warteschlange, obwohl nur ein vorbereiteter Foto-Upload queued werden kann.

**Lokale Korrektur:** Nur `analysisStatus==='queued'` zeigt die Foto-Queue-Zusage. Andere Offline-Modi melden ausdrücklich, dass die Eingabe weder gesendet noch gespeichert wurde.

**Re-Test:** Offline-Beschreibung, Screenshot plus Storage-Inspektion; Queue-Key vor und nach dem Fehler `null`. `validate:offline-copy` Exit 0. Ergebnis `FIXED_VERIFIED`.

### RT-FIX-04 – Progress blieb nach Sprachwechsel Englisch (P2)

**Ursache:** Der berechnete Chart war memoisiert, ohne `locale` als Abhängigkeit.

**Korrektur/Re-Test:** Sprache EN→DE gewechselt und Progress ohne Neustart geöffnet; Wochentage sofort deutsch. `validate:language-memos` Exit 0. Ergebnis `FIXED_VERIFIED`.

### RT-FIX-05 – „Haferflocken“ rankte ein zusammengesetztes Gericht zuerst (P1)

**Ursache:** Die BLS-Gleichheitswertung erkannte die getrennte Schreibweise `Hafer Flocken` nicht als exakten Match für `Haferflocken`.

**Korrektur/Re-Test:** Compound-Normalisierung und Fixture für `C133000`; lokaler Gateway liefert das Grundprodukt mit 348 kcal/100 g zuerst. `validate:bls-search` Exit 0. Ergebnis `FIXED_VERIFIED` **lokal**; Produktionsgateway muss noch deployed und danach live nachgetestet werden.

### RT-FIX-06 – Radiozustände fehlten im Web-Accessibility-Tree (P1)

**Ursache:** Radioelemente verwendeten `selected`; React Native Web exponierte dabei keinen verlässlichen `aria-checked`-Zustand.

**Korrektur/Re-Test:** `accessibilityState.checked` plus explizites `aria-checked` an allen `radio`-Rollen; automatischer Source-Scan und AX-Snapshots für Onboarding/Paywall. Ergebnis `FIXED_VERIFIED` im Browser; tatsächliche VoiceOver-Ausgabe bleibt manuell.

### RT-FIX-07 – Suchbestätigung bot eine nicht vorhandene Fotoaktion an (P2)

**Ursache:** Die sekundäre CTA in `confirm.tsx` war unabhängig vom Eingabemodus immer „Retake photo/Foto wiederholen“ und führte auf den allgemeinen Scan-Screen.

**Korrektur/Re-Test:** Bei `scanMode==='search'` lautet die CTA nun „Search for another food/Anderes Lebensmittel suchen“ und führt zu `/scan?mode=search`. Im Runtime-Re-Test öffnete sich die Suchmodalität direkt mit fokussiertem Suchfeld. `validate:search` sichert Copy, Moduszweig und Zielroute ab. Ergebnis `FIXED_VERIFIED`.

### RT-FIX-08 – Deutsches Dezimalkomma im englischen Plan (P2)

**Ursache:** `0,7×` und `1,4×` waren im Plan als deutsche Literale eingebaut, während andere Screens bereits den gemeinsamen Locale-Formatter nutzten.

**Korrektur/Re-Test:** Beide Werte laufen jetzt über `formatNumber(value, locale)`. Browser-AX/Runtime zeigt EN `0.7×`/`1.4×` und DE unverändert korrekt `0,7×`/`1,4×`. `validate:formatting` prüft die Formatter-Ausgaben und verbietet die alten Literale. Ergebnis `FIXED_VERIFIED`.

## Offene Findings dieses Runtime-Audits

| ID | Schwere | Status | Befund / notwendige Aktion |
|---|---|---|---|
| RT-P0-01 | P0 | MANUAL_CONFIRMATION_REQUIRED | Das aktuelle signierte Store-IPA Build 7 besteht den statischen Archivpass, wurde aber nicht installiert, nicht zu TestFlight/ASC hochgeladen und nicht nativ ausgeführt. Nach Backend-/Web-/Metadatenfreigabe exakt den tatsächlichen Submission-Build vollständig testen; bei jeder Produktcodeänderung neu bauen. |
| RT-P0-02 | P0 | UNVERIFIED_BLOCKER | StoreKit/RevenueCat wurde nicht im finalen nativen Build getestet. Kauf, Restore, Cancel, Pending/Ask to Buy, Fehler, Grace, Refund und Expiry in Apple Sandbox belegen. |
| RT-P1-01 | P1 | MANUAL_CONFIRMATION_REQUIRED | Physische Kamera einschließlich Deny→Allow, Retake, Front/Back-Lifecycle, Torch, Barcodeerkennung, unbekannter Barcode, Hintergrund/App-Kill. |
| RT-P1-02 | P1 | MANUAL_CONFIRMATION_REQUIRED | VoiceOver, größte Dynamic-Type-Stufen, Bold Text, Increase Contrast, Reduce Motion und Fokusreihenfolge auf echtem iPhone. |
| RT-P1-03 | P1 | MANUAL_CONFIRMATION_REQUIRED | Kleinste unterstützte iOS-Version und mindestens ein kleines sowie ein großes physisches iPhone. |
| RT-P1-04 | P1 | MANUAL_CONFIRMATION_REQUIRED | 14–15-Guardian-Zustellung/Bestätigung/Wiederaufnahme sowie unter-14 Blockade end-to-end; Rechtslage je Launchterritorium separat. |
| RT-P1-05 | P1 | MANUAL_CONFIRMATION_REQUIRED | Offline-Fotoqueue über Netzverlust, Hintergrund, Prozessabbruch, Relaunch und genau-einmal Retry. |
| RT-P1-06 | P1 | MANUAL_CONFIRMATION_REQUIRED | Mehrtages-/Mitternacht-/DST-/Zeitzonenwechsel für Tageswerte, Gewicht und Streak. |
| RT-P1-07 | P1 | FAIL | BLS-Ranking, serverautoritatives Entitlement und Provider-Ratelimits sind lokal verifiziert. Drei Migrationen, zwei Rate-Limit-Salts und sieben RevenueCat-Serversecrets fehlen live. `nutrition`, `guardian-consent` und `revenuecat-webhook` technisch deployen/testen; `waitlist` gemeinsam mit Website/Waitlist releasen; danach Live-Retest. |
| RT-P2-03 | P2 | MANUAL_CONFIRMATION_REQUIRED | Mehrere sichtbare Touchflächen liegen im Web unter 44×44 pt (u. a. Paywall Restore/Close, Profil-Switches). Manche besitzen `hitSlop`; effektive native Ziele auf Gerät messen. |
| RT-P3-01 | P3 | FAIL | Web-Devwarnungen zu Notifications, Shadow-Props und `pointerEvents`; vor finaler Webpflege bereinigen, derzeit kein belegter iOS-Reviewblocker. |

## Zwingend manuelle Abschlussmatrix

Diese Punkte wurden bewusst **nicht** auf `PASS` gesetzt:

1. Build 7 oder den exakten späteren Submission-Build installieren und Build-ID/Fingerprint/Runtime-Identität dokumentieren; der nominale EAS-Git-Commit allein reicht wegen des lokalen Audit-Uploads nicht.
2. Kamera- und Barcode-Matrix auf echtem iPhone einschließlich Torch, Permission-Deny und dunkler Umgebung.
3. StoreKit-/RevenueCat-Sandboxmatrix mit realen Produkten und allen Kaufzuständen.
4. VoiceOver-Rotor/Focus, echte Dynamic Type, Bold Text, Increase Contrast und Reduce Motion.
5. Kleinste unterstützte iOS-Version sowie kleines und großes iPhone.
6. Offline-Fotoqueue über App-Kill und Netzrückkehr.
7. E-Mail-Linking/OTP/Recovery und Guardian-Mail end-to-end.
8. Mitternacht, mehrere Tage, Sommerzeit und Zeitzonenwechsel für Verlauf/Streak.
9. Clean Install, Upgrade vom letzten TestFlight-Build, Datenmigration, Hintergrund/Relaunch.
10. Drei DB-Migrationen, Salts/RevenueCat-Secrets und technische Functions ausrollen; geänderte Waitlist zusammen mit Website releasen; anschließend Live-/Grenzwert-Retest.

## Ausgeführte Befehle und Exit-Codes

| Befehl / Befehlsfamilie | Exit | Ergebnis |
|---|---:|---|
| `curl -I http://localhost:8090` | 0 | Lokaler Expo-Webbuild erreichbar |
| Playwright CLI: isolierte Sessions, `goto`, `snapshot`, `click`, `fill`, `run-code`, `screenshot` | 0 für die dokumentierten Flows | Kernnavigation, Zustände, AX-Snapshots und Screenshots |
| `npm run api` | laufend, anschließend bewusstes `Ctrl+C` (Exit 130 bzw. 1 im PTY) | Lokaler Gateway nur für BLS-/Search-Re-Tests; beendet |
| `npm run typecheck` | 0 | TypeScript ohne Fehler |
| `npm run validate:state-integrity` | 0 | State-Integrität bestanden |
| `npm run validate:allowance` | 0 | Nur `origin=scan` überlebt Hydration als bezahlte KI-Analyse |
| `npm run validate:entitlements` | 0 | Signatur, Binding, Ledger, Cap, Idempotenz und stabile Request-IDs bestanden |
| `npm run validate:provider-limits` | 0 | USDA-/OFF-/RevenueCat-Limits, Minimierung, Retention, Claim-/Lock-Reihenfolge und Callsite-Pflicht bestanden |
| `npm run validate:offline-copy` | 0 | Nur queued Fotos werden als lokal gespeichert beschrieben |
| `npm run validate:i18n` | 0 | EN-Default, Wörterbücher und Source-Strings konsistent |
| `npm run validate:language-memos` | 0 | Kein geprüfter Memo friert Gerätesprache ein |
| `npm run validate:accessibility` | 0 | 31 Screens; Labels und Radio-Checked-State geprüft |
| `npm run validate:formatting` | 0 | Zahlen-/Datums-Fallbacks sowie EN-/DE-Planmultiplikatoren bestanden |
| `npm run validate:plan-builder` | 0 | Plananzahl und Haptiklogik bestanden |
| `npm run validate:camera` | 0 | Statischer Kamera-Lifecycle-Validator bestanden; kein Hardware-Pass |
| `npm run validate:search` | 0 | Kein Modell/Quota, Debounce, stale responses sowie modusspezifische Search-Confirm-CTA/Route |
| `npm run validate:bls-search` | 0 | 7.140 bilinguale BLS-Einträge und regionale Suchfälle |
| `npm run verify` | 0 | finaler kompletter Release-Lauf einschließlich aller Validatoren, Typecheck, Expo Doctor 18/18 und Webexport; `evidence/build/26_final_release_verify.log` |
| EAS Production Build | 0 | signiertes Store-IPA Kandro 1.0.0 (7), Build-ID/Fingerprint oben; nicht installiert, nicht in TestFlight/ASC, nicht submitted; `evidence/build/27_eas_release_archive.log` |
| Build-7-Metadaten/SHA-256 | 0 | Build-ID, Fingerprint und IPA-SHA-256; `evidence/build/28_eas_build7_summary.json` |
| Build-7-Archivinspektion | 0 | SHA-256, arm64, Plist/Provisioning/Entitlements, Xcode/SDK 26.0, strikte Deep-Signatur und 16 Manifeste positiv; `evidence/build/29_build7_archive_inspection.txt` |
| Build-7-Bundle-Scan | 0 | keine Provider-Secrets/operative Dev-URL; Required-Reason APIs erklärt; RC `Linked=false` als ASC-/Privacy-Report-Konflikt klassifiziert; `evidence/build/30_build7_bundle_scan.txt` |
| Build-7-Xcode-Logauszug | 0 | Xcode-/SDK-/Archiv-Metadaten und Warnungsklassifikation; kein zusammengefasster Privacy Report; `evidence/build/31_build7_xcode_log_extract.txt` |
| `npm run db:remote:check` | 0 | `dryRun:true`, genau drei ausstehende Migrationen, kein Push; `evidence/network/23_final_supabase_dry_run.log` |
| `git diff --check` | 0 | Keine Whitespace-Fehler im gemeinsamen Arbeitsstand |

Ein erster Playwright-Routingversuch, eine `https`-Antwort per `route.continue` auf `http` umzulenken, wurde vom Browserprotokoll abgewiesen; der Test wurde anschließend korrekt mit `route.fetch` gegen den lokalen aktuellen Gateway wiederholt. Das war eine Harness-Grenze, kein App-Fehler. Das native Alters-Stepper-Hold-Verhalten ließ sich mit normalen Browserklicks ebenfalls nicht belastbar simulieren; deshalb wurde daraus weder PASS noch Defekt abgeleitet.

## Evidenzindex

Alle neuen Runtime-Screenshots liegen unter [`evidence/runtime`](./evidence/runtime/). Die wichtigsten Vorher-/Nachher-Paare sind:

- Onboarding 320×568: [`pre_fix_onboarding_de_320x568_scrolled.png`](./evidence/runtime/pre_fix_onboarding_de_320x568_scrolled.png) → [`head_onboarding_de_320x568_light_fixed.png`](./evidence/runtime/head_onboarding_de_320x568_light_fixed.png)
- Offline-Beschreibung: [`head_description_offline_error_en_393x659_light.png`](./evidence/runtime/head_description_offline_error_en_393x659_light.png) → [`head_description_offline_error_en_393x659_light_fixed.png`](./evidence/runtime/head_description_offline_error_en_393x659_light_fixed.png)
- Progress-Locale: [`head_progress_de_weekday_locale_bug_393x659_light.png`](./evidence/runtime/head_progress_de_weekday_locale_bug_393x659_light.png) → [`head_progress_de_weekday_locale_fixed_393x659_light.png`](./evidence/runtime/head_progress_de_weekday_locale_fixed_393x659_light.png)
- Deutsche Suche: [`head_search_results_de_393x659_light.png`](./evidence/runtime/head_search_results_de_393x659_light.png) → [`head_search_results_de_haferflocken_fixed_393x659_light.png`](./evidence/runtime/head_search_results_de_haferflocken_fixed_393x659_light.png)
- Search-Confirm: [`head_confirm_search_item_en_393x659_light.png`](./evidence/runtime/head_confirm_search_item_en_393x659_light.png) → [`head_confirm_search_item_de_393x659_light_fixed.png`](./evidence/runtime/head_confirm_search_item_de_393x659_light_fixed.png)
- Plan-Dezimalwerte: [`head_plan_multiplier_en_393x659_light_fixed.png`](./evidence/runtime/head_plan_multiplier_en_393x659_light_fixed.png), [`head_plan_multiplier_de_393x659_light_fixed.png`](./evidence/runtime/head_plan_multiplier_de_393x659_light_fixed.png)
- Light/Dark: [`head_today_en_430x932_light.png`](./evidence/runtime/head_today_en_430x932_light.png), [`head_today_en_402x874_dark.png`](./evidence/runtime/head_today_en_402x874_dark.png)

## Release-Urteil aus Runtime-Sicht

Die lokal ausgeführte App ist in den geprüften Browserflüssen deutlich stabiler: alle reproduzierten P1-Runtime-Defekte wurden lokal behoben und erneut geprüft; der volle Release-Lauf 26, das signierte EAS-Store-Archiv Build 7 und dessen statische Archivprüfung sind erfolgreich. Der Teststatus bleibt **UNVERIFIED_BLOCKER**, solange Build 7 bzw. der exakte Submission-Build nicht installiert, von Apple verarbeitet und kein vollständiger Geräte-/Accessibility-Pass sowie keine StoreKit-Sandboxmatrix belegt sind. Der zusammengeführte Xcode Privacy Report bleibt ebenfalls offen.
