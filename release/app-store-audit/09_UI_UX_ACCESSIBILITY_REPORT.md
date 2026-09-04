# 09 – UI-, UX- und Accessibility-Bericht

**Audit-Stichtag:** 5. September 2026
**Prüfobjekt:** lokaler Expo-Web-Runtime des aktuellen Audit-Arbeitsstands sowie EAS-Store-Archiv Build 7 als Buildnachweis
**Nicht geprüft als native Wahrheit:** EAS Build 7 (`420935a7-2aed-43e1-9daf-cb53f306a549`, App `1.0.0`, Build `7`) ist signiert und abgeschlossen, aber weder nach App Store Connect/TestFlight hochgeladen noch auf einem physischen iPhone installiert oder ausgeführt. Die in App Store Connect vorhandenen Builds 4 und 5 bilden den aktuellen Quellstand nicht ab.
**Urteil:** Die Kern-UX ist im geprüften Web-Runtime kohärent und acht konkrete Defekte wurden lokal verifiziert behoben. Ein Accessibility- oder Release-Pass ist dennoch nicht zulässig, bevor VoiceOver, echtes Dynamic Type, Kamera und StoreKit auf dem finalen iOS-Build geprüft wurden.

## Zusammenfassung nach Priorität

### P0 offen

1. **Kein auf einem Gerät ausgeführter Review-Candidate.** Build 7 ist als signiertes Store-Archiv vorhanden, aber nicht in App Store Connect/TestFlight und nicht installiert. Alle UI-Screenshots dieses Berichts stammen aus dem lokalen Audit-Arbeitsstand; sie beweisen die native Darstellung von Build 7 nicht.
2. **Keine native StoreKit-/RevenueCat-Matrix.** Paywall-Darstellung ist geprüft, Kauf/Restore/Ask to Buy/Pending/Grace/Refund/Expiry auf Build 7 oder einem späteren exakten Submission-Build nicht.

### P1 offen

1. Physische Kamera, Torch und Barcodeerkennung auf echten iPhones.
2. VoiceOver, echte Accessibility-Dynamic-Type-Größen, Bold Text, Increase Contrast und Reduce Motion.
3. Kleinstes unterstütztes iOS und kleines/großes Gerät einschließlich Safe Areas und Tastatur.
4. Guardian-Ablauf für 14–15 und Offline-Fotoqueue einschließlich App-Kill end-to-end.
5. Die drei ausstehenden Migrationen und die lokalen Backend-Fixes einschließlich BLS-Ranking, serverautoritativer Entitlements und Provider-Limits müssen gemeinsam mit `nutrition`, `guardian-consent` und `revenuecat-webhook` deployt und live erneut geprüft werden.

### P2 offen

1. Einige sichtbare Web-Touchflächen sind kleiner als 44×44; native effektive Fläche inklusive `hitSlop` muss vermessen werden.

Die zwei zuvor offenen P2-Copy-/Locale-Funde wurden in dieser Folgeprüfung behoben und auf EN/DE erneut ausgeführt.

## Findings

| ID | Schwere | Status | Befund | Evidenz / Remediation |
|---|---|---|---|---|
| UI-001 | P1 | FIXED_VERIFIED | Bei 320×568 überlagerte die fixe CTA die dritte Zieloption im Onboarding. | Kompakter Höhenmodus plus Scroll-/Safe-Area-Abstand; alle 11 Schritte bei 320×568/393×659 erneut geprüft. [Vorher](./evidence/runtime/pre_fix_onboarding_de_320x568_scrolled.png), [nachher](./evidence/runtime/head_onboarding_de_320x568_light_fixed.png) |
| UI-002 | P1 | FIXED_VERIFIED | Beschreibung/Barcode/Suche konnten offline fälschlich behaupten, lokal queued zu sein. | Copy nach Status/Modus getrennt; Storage blieb leer; [vorher](./evidence/runtime/head_description_offline_error_en_393x659_light.png), [nachher](./evidence/runtime/head_description_offline_error_en_393x659_light_fixed.png) |
| UI-003 | P1 | FIXED_VERIFIED | Kostenlose Datenbank-/Planwege erhöhten nach Cloud-Hydration das Lifetime-KI-Kontingent und die Paywall sprach von Mahlzeiten. | Nur `origin='scan'` gilt als Foto-/Textanalyse; Paywall sagt Analyse(n); Regression + isolierter Hydration-Re-Test. |
| UI-004 | P1 | FIXED_VERIFIED | Paywall versprach unbegrenzte Analysen, während das Serverlimit 60/Tag beträgt. | EN/DE auf „up to/bis zu 60“ korrigiert; Entitlement-Regression Exit 0. Finaler nativer StoreKit-Re-Test offen. |
| UI-005 | P1 | FIXED_VERIFIED | „Haferflocken“ führte mit Nussplätzchen statt dem BLS-Grundprodukt. | Lokal: Compound-Match; Gateway führt `Hafer Flocken`, 348 kcal/100 g. [Re-Test](./evidence/runtime/head_search_results_de_haferflocken_fixed_393x659_light.png). Deployment offen. |
| UI-006 | P2 | FIXED_VERIFIED | Progress-Wochentage blieben nach EN→DE-Wechsel Englisch. | `locale` invalidiert Memo; sofortiger Re-Test zeigt `Sa` bis `Fr`. [Vorher](./evidence/runtime/head_progress_de_weekday_locale_bug_393x659_light.png), [nachher](./evidence/runtime/head_progress_de_weekday_locale_fixed_393x659_light.png) |
| A11Y-001 | P1 | FIXED_VERIFIED | Radio-Auswahl hatte keinen verlässlichen Checked-State im Browser-Accessibility-Tree. | Im Web: Alle Radio-Rollen verwenden `accessibilityState.checked` plus `aria-checked`; Onboarding `true,false,false`, Paywall `true,false`; Source-Validator Exit 0. VoiceOver bleibt manuell. |
| UI-007 | P2 | FIXED_VERIFIED | Suchtreffer-Bestätigung bot „Retake photo“, obwohl kein Foto existiert. | CTA ist jetzt modusspezifisch: „Search for another food/Anderes Lebensmittel suchen“; Klick öffnet `/scan?mode=search` direkt mit fokussiertem Suchfeld. [Vorher](./evidence/runtime/head_confirm_search_item_en_393x659_light.png), [nachher](./evidence/runtime/head_confirm_search_item_de_393x659_light_fixed.png) |
| UI-008 | P2 | FIXED_VERIFIED | Englische Plan-Portionen verwendeten deutsches Komma. | `formatNumber(value, locale)` statt Literalen; Runtime EN `0.7×`/`1.4×`, DE `0,7×`/`1,4×`. [EN](./evidence/runtime/head_plan_multiplier_en_393x659_light_fixed.png), [DE](./evidence/runtime/head_plan_multiplier_de_393x659_light_fixed.png) |
| A11Y-002 | P1 | MANUAL_CONFIRMATION_REQUIRED | Native Screenreader-Ausgabe, Fokusreihenfolge, Rotor, Modalisolation und Gesten sind nicht durch den Web-AX-Tree bewiesen. | Auf finalem Build mit VoiceOver vollständig prüfen. |
| A11Y-003 | P2 | MANUAL_CONFIRMATION_REQUIRED | Paywall-Close ist sichtbar 40×40; Restore ist textnah, Profil-Switches ca. 40×20. Manche kleine Buttons haben `hitSlop`, andere nicht eindeutig. | Native effektive Touchziele gegen mindestens 44×44 pt prüfen und ggf. Padding/HitSlop ergänzen. |
| A11Y-004 | P2 | PASS | Geprüfte statische Kernkontraste erreichen mindestens 4,5:1. | Light muted/canvas 4,54; muted/surface 5,03; accentText/accent 5,57; Dark muted/background 8,00; weiß/camera 19,39. Dynamische Foto-/Overlayzustände bleiben manuell. |
| A11Y-005 | P2 | MANUAL_CONFIRMATION_REQUIRED | Reduced-Motion-Codepfade und Browser-Media-Query sind vorhanden, aber native iOS-Animationen/Modaltransitions wurden nicht erlebt. | Auf finalem iPhone mit „Bewegung reduzieren“ prüfen. |
| UI-009 | P3 | FAIL | Bereits gespeicherte Provider-/Lebensmittelnamen bleiben nach Sprachwechsel in ihrer ursprünglichen Sprache. | UI-Chrome wechselt korrekt; für Konsistenz später lokalisierbares Label/Quellenname vorsehen, ohne historische Daten umzuschreiben. |
| UI-010 | P3 | FAIL | Web-Devkonsole warnt vor Web-Push-Support und veralteten RN-Web-Props. | Keine unbehandelte Online-Ausnahme; Warnungen vor späterem Web-Release bereinigen. |

## Informationsarchitektur und Conversion-Klarheit

### Onboarding

Die Abfolge ist nachvollziehbar: Ziel → Basisdaten → Aktivität/Präferenzen → Berechnung → Plan. Eine Auswahl führt jetzt **nicht** automatisch weiter; der Nutzer bestätigt jeden Schritt über `Weiter/Continue`. Das reduziert versehentliche Eingaben, ohne zusätzliche Navigationsebenen einzuführen.

Der kompakte Modus erhält auch bei 320×568 die visuelle Hierarchie: Titel, erklärender Text, auswählbare Optionen und eine eindeutige primäre CTA. Der Fortschrittsindikator bleibt sichtbar. Bei 135-%-Browsertext ist Scrollen erforderlich, aber die letzte Option und CTA bleiben erreichbar. Echte iOS-Tastatur-, Dynamic-Type- und Safe-Area-Werte sind weiter manuell.

### Heute

Der Screen beantwortet zuerst „Wo stehe ich heute?“ und danach „Was ist mein nächster Zug?“: großer Kalorienring, Makros, Tagesstatus und nächste Mahlzeit. Das ist eine sinnvolle Hierarchie für das Produktversprechen. Kleine und große Viewports zeigten keine abgeschnittene Kerninformation. [320×568](./evidence/runtime/head_today_en_320x568_light.png), [430×932](./evidence/runtime/head_today_en_430x932_light.png).

### Erfassen

Foto, Beschreibung, Barcode und Suche sind als getrennte Einstiege erkennbar. Der Nutzer hat damit eine permissionfreie Alternative, falls Kamera nicht gewünscht oder verfügbar ist. Analysezustand, Korrektur und Speichern liegen in einer linearen Abfolge. Fehlertexte bieten eine passende nächste Aktion; die Offline-Zusage ist nach dem Fix wahrheitsgemäß.

Die sekundäre Aktion passt nun zum Ursprung: Nach einer Datenbanksuche steht dort „Search for another food/Anderes Lebensmittel suchen“ und sie öffnet direkt wieder die Suche. Fotoergebnisse behalten „Retake photo/Foto wiederholen“.

### Plan und Rezept

Der Plan zeigt Restbudget, drei priorisierte Optionen und ein konkretes Rezept mit Zutaten/Mengen. Das macht die adaptive Tagesplanung greifbar. Die getestete geplante Mahlzeit wurde mit gewählter Portion erfasst und der Tag neu berechnet. Portionsmultiplikatoren folgen jetzt derselben aktiven Locale wie die übrigen Zahlen.

### Verlauf

Gewicht, Mahlzeiten, Durchschnittsprotein und Streak sind in getrennten Karten verständlich. Ungültige Gewichtseingabe wird inline abgefangen. Der direkte EN→DE-Wechsel aktualisiert nach der Memo-Korrektur nun auch die Chart-Wochentage. Der Audit belegt nur einen Tag; Aussagen über echte Serien über Mitternacht, DST oder Zeitzonen hinweg wären ohne Langzeittest nicht zulässig.

### Profil

Profil, Plan, Maße/Einheiten, Pro, Konto/Datensicherung, Erinnerungen, Datenschutz, Sprache, Support und Löschung sind logisch gruppiert. „Cloud sync active/Cloud-Synchronisierung aktiv“ ist technisch, wird aber unter „Account & backup/Konto & Datensicherung“ kontextualisiert; daraus entstand im Test keine Sackgasse. Eine alltagssprachlichere Formulierung wie „Auf diesem Konto gesichert“ könnte später getestet werden, ist aber kein Reviewdefekt.

### Paywall

Der Screen stellt Pro-Vorteile, Monats-/Jahreswahl, Abrechnung, Erneuerung, Restore sowie Terms/Privacy dar. Kostenlose Suche, Barcode, Tagesplan und Verlauf werden von bezahlter Foto-/Textanalyse abgegrenzt. Zwei zuvor irreführende Aussagen wurden korrigiert: gezählt werden Analysen statt Mahlzeiten, und der Leistungsumfang heißt „bis zu 60 pro Tag“ statt unbegrenzt. Ein überzeugendes Layout ersetzt jedoch keinen echten StoreKit-Test.

## Responsive Prüfung

| Viewport | Umfang | Ergebnis |
|---|---|---|
| 320×568 | gesamtes Onboarding, Today, Scrollzustände, 135-%-Textstress | Nach Fix keine Option/CTA-Überlagerung und kein horizontaler Overflow |
| 393×659 | gesamtes Onboarding und alle Kernflows | Bedienbar; lange Screens scrollen; keine abgeschnittene primäre CTA im getesteten Web-Runtime |
| 402×874 | Today/Progress, Dark Mode | Kohärent und lesbar |
| 430×932 | Today/großer iPhone-ähnlicher Viewport | Großzügige Hierarchie, keine ungenutzte kritische Lücke |
| 1280×720 | Paywall/Hydration-Diagnose | Funktional; Desktop-Web ist nicht das Storeziel |

Die bei `--hires` erzeugten 393×659-Aufnahmen besitzen physisch 1179×1977 Pixel, repräsentieren aber weiterhin den CSS-Viewport 393×659. Native Points, Browser-CSS-Pixel und App-Store-Screenshotpixel dürfen nicht gleichgesetzt werden.

## Sprache und Lokalisierung

- Englisch ist der Code-Default; Deutsch kann im Profil umgestellt werden.
- Der Kernflow wurde in beiden Sprachen ausgeführt.
- Lange deutsche Onboarding-Texte bleiben in den getesteten Viewports erreichbar.
- Der Progress-Locale-Leak wurde behoben und erneut visuell geprüft.
- Die deutsche BLS-Suche wurde lokal fachlich verbessert; der Live-Gateway ist noch nicht aktualisiert.
- Plan-Multiplikatoren wurden im Runtime für EN (`0.7×`/`1.4×`) und DE (`0,7×`/`1,4×`) bestätigt.
- Offen bleiben persistierte fremdsprachige Provider-Namen.
- `validate:i18n` und `validate:language-memos` liefen mit Exit 0.

## Light/Dark und visuelle Konsistenz

Canvas, Surface, Ink, Muted, Line, Pistazie/Moos und Fehlerfarbe werden in Light und Dark konsistent eingesetzt. Primäre CTAs sind deutlich, sekundäre Karten liegen visuell zurück. Today und Paywall blieben in Dark lesbar:

- [Today Light, 430×932](./evidence/runtime/head_today_en_430x932_light.png)
- [Today Dark, 402×874](./evidence/runtime/head_today_en_402x874_dark.png)
- [Paywall Dark, 393×659](./evidence/runtime/head_paywall_en_393x659_dark.png)

Geprüfte statische Farbkombinationen bestehen 4,5:1. Nicht aus diesem Test ableitbar sind Kontrast über echten Nutzerfotos, iOS „Kontrast erhöhen“, Night Shift oder Gerätekalibrierung.

## Accessibility-Prüfung

### Positiv belegt

- Der Validator prüfte 31 Screens auf zugängliche Control-Labels.
- Checkboxen und Radios besitzen programmatische Zustände; alle Radio-Rollen wurden nach dem Fund auf `checked` vereinheitlicht.
- Browser-AX-Snapshots zeigten die aktive Onboarding- und Paywall-Option als `[checked]`.
- Tastaturfokus lief im Onboarding durch die drei Optionen und danach zur primären CTA.
- Der Consent-Dialog besitzt eine Dialogrolle; Fokus wechselte hinein und der Hintergrund wurde browserseitig verborgen.
- Analyse-/Fehlerstatus nutzt eine polite Live Region.
- Auswahl wird nicht nur durch Farbe kommuniziert; Form/Border/Checked-State ändern sich ebenfalls.
- Kernanimationen respektieren einen Reduced-Motion-Pfad im Code.

### Nicht als PASS belegt

- Gesprochene VoiceOver-Labels und Reihenfolge auf iOS.
- Rotor-Navigation, Escape-Geste, Switch Control und externe Tastatur auf iPhone.
- Fokusbindung und Rückkehr bei allen nativen Modals/Sheets.
- Größte Accessibility-Dynamic-Type-Stufen, Bold Text und Display Zoom.
- 44×44-pt-Touchziele nach nativer Layoutberechnung und `hitSlop`.
- iOS Reduce Motion/Increase Contrast in allen Animationen und Systemmodals.

Diese Punkte sind `MANUAL_CONFIRMATION_REQUIRED`; Browser-AX und Sourcevalidator dürfen dafür nicht als Ersatz verwendet werden.

## Fehler-, Leer- und Offlinezustände

- Offline-Beschreibung ist nach dem Fix korrekt und nicht irreführend.
- Unbekannter Barcode bietet den Wechsel zur Beschreibung statt einer endlosen Wiederholung.
- Ungültiges Gewicht wird mit verständlicher Bereichsangabe abgewiesen.
- Fehlende KI-Konfiguration/Consent/unklares oder mehrfaches Gericht besitzen getrennte Texte und nächste Aktionen.
- Account-Löschung verlangt bewusste Bestätigung und erklärt separat, dass ein Apple-Abo in Apple verwaltet wird.
- Echte Fotoqueue nach Prozessabbruch, StoreKitfehler und E-Mail-/Guardian-Zustellung bleiben manuell.

## Remediation-Diff und Regressionen

| Bereich | Betroffene Dateien | Absicherung |
|---|---|---|
| Analyse-Kontingent/Hydration | `src/services/cloudRepository.ts`, `src/services/syncRepository.ts`, `src/app/paywall.tsx`, EN/DE-i18n | `scripts/validate-analysis-allowance.mjs`; isolierter Storage-/Hydration-Re-Test |
| Offline-Copy | `src/app/analyzing.tsx`, EN/DE-i18n | `scripts/validate-offline-copy.mjs`; Offline-Screenshot und Queue-Key-Nachweis |
| Onboarding klein | `src/app/onboarding.tsx` | Vollständige 320×568-/393×659-Schrittmatrix plus 135-%-Stress |
| Radio-Semantik | Onboarding, Paywall, Confirm, Scan, Plan, Meal/Portion Sheets | erweiterter `scripts/validate-accessibility.mjs`; Web-AX-Re-Test |
| Progress-Locale | `src/app/(tabs)/progress.tsx` | `validate:language-memos`; visueller EN→DE-Re-Test |
| BLS-Grundprodukt | `supabase/functions/_shared/bls-search.mjs` | `validate:bls-search`; lokaler Gateway-/UI-Re-Test |
| Entitlement-/60er-Copy | Gateway/Entitlement-Remediation und EN/DE-i18n | `validate:entitlements`; Deployment/Sandbox noch offen |
| Search-Confirm-Aktion | `src/app/confirm.tsx`, EN/DE-i18n | `validate:search`; Runtime-Klick bis zur wieder geöffneten Suchmodalität |
| Plan-Dezimalwerte | `src/app/(tabs)/plan.tsx` | `validate:formatting`; EN-/DE-Runtime- und AX-Re-Test |

Der vollständige abschließende Release-Lauf bestand mit Exit 0: `release/app-store-audit/evidence/build/26_final_release_verify.log`. Er umfasst unter anderem TypeScript, State-Integrität, Allowance, Entitlements, Provider-Limits, Offline-Copy, i18n, Language-Memos, Accessibility, Formatting, Plan Builder, Camera-Sourcecheck, Search, BLS, Expo Doctor und Webexport. Das belegt Source-/Webregressionen, ersetzt aber keinen nativen Gerätetest.

## Manuelle Abnahme vor Review

1. Die bereits abgeschlossene statische Build-7-Inspektion bei jeder Änderung an produktrelevantem Source oder Buildkonfiguration an einem neuen Production-Build aus dem finalen Commit wiederholen; Buildnummer, Commit/Fingerprint und IPA-Hash festhalten.
2. Den exakt vorgesehenen Submission-Build nach TestFlight laden und auf kleinem und großem iPhone sowie der kleinsten unterstützten iOS-Version installieren.
3. Gesamtes Onboarding in EN/DE bei größtem Dynamic Type und VoiceOver durchlaufen.
4. Kamera Deny→Allow, Retake, Torch, Barcode in guter/schlechter Beleuchtung, Rotation/Hintergrund/App-Kill prüfen.
5. Foto-Offlinequeue mit Netzverlust und Relaunch auf genau-einmal-Verarbeitung prüfen.
6. StoreKit-Monat/Jahr, Restore, Cancel, Pending/Ask to Buy, Fehler, Grace, Refund und Expiry testen.
7. Guardian- und Account-E-Mail-Pfade mit echten Postfächern in EN/DE testen.
8. Progress/Streak über Mitternacht, DST und Zeitzonenwechsel prüfen.
9. Native Touchzielmatrix abschließen.
10. Erst danach Screenshots/Metadaten gegen genau diesen finalen Binary-Stand abgleichen.

## Schlussurteil

Die Kernoberfläche wirkt im geprüften Stand konsistent, verständlich und für typische Viewports robust. Besonders relevant für App Review: irreführende Offline-, Paywall- und Nährwertzustände sowie die kleine Onboarding-Überlagerung sind lokal nicht mehr reproduzierbar. Build 7 beseitigt den früheren Blocker „kein signiertes Archiv“, aber nicht den verbleibenden **UNVERIFIED_BLOCKER**: Das Archiv wurde nicht über TestFlight auf einem physischen iPhone ausgeführt, und Kamera, Accessibility sowie StoreKit wurden nativ nicht belegt. Ein Web-/Source-Pass darf nicht als iOS-Pass ausgegeben werden.
