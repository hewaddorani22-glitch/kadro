# Gezielt geprüfte Kernabläufe — 6. September 2026

## Geltungsbereich

Aktueller Nutzerauftrag: ohne zusätzliche Kosten Kalorienerfassung, Foto,
Lebensmittelsuche, nächste Mahlzeiten und Pro prüfen und zur Review einreichen.
Kein zweiter Vollaudit mit behaupteter weltweiter Rechts-/Foto-Genauigkeitsgarantie.
Vorherige umfassendere Coverage bleibt erhalten; hier keine Umwertung unbekannter
Fälle zu PASS. Lokale Debug-App mit geprüftem Build16-Quellstand; TestFlight-
Gerätebelege des Nutzers bleiben explizit auf Build15 bezogen.

## Beobachtete Abläufe

- PASS / SIMULATOR + LIVE_BACKEND: Startbilanz 710 gegessen / 1710 übrig,
  Ziel2420. Heute → Zu Mittagessen hinzufügen → Search → Banana. BLS-Treffer
  Banana raw, F503100, 79 kcal pro100g; rohe/getrocknete/Zubereitungsvarianten
  getrennt. Menge manuell150g →119kcal. Übernehmen, bestätigen, Today:
  829 gegessen /1591 übrig, genau eine neue Bananenmahlzeit unter Lunch.
- PASS / SIMULATOR: Nach dieser Mahlzeit zeigt Plan je genau drei Vorschläge
  für home, supermarket und eating-out. Auswahl von Prawn pea risotto535kcal;
  Rezept öffnet Zutaten mit Mengen und Zubereitung. Als gegessen1x übernehmen:
  1364 gegessen /1056 übrig. Vorschläge passen sich an die neue Bilanz an.
- PASS / SIMULATOR: App mit simctl vollständig beendet und erneut gestartet.
  Danach unverändert1364/1056 und genau die ursprüngliche710-kcal-Mahlzeit,
  Banana119 sowie Risotto535. Screenshot core-totals-relaunch.png.
- PASS / SIMULATOR + LIVE_BACKEND: App auf Deutsch; Barcode → Code eingeben →
  7622210022776. Milka LU /Open Food Facts erkannt, 100g513kcal mit Hinweis,
  tatsächliche Menge zu korrigieren. Menge30g übernommen →154kcal, bestätigt;
  Today1518 gegessen /902 übrig, neue Mahlzeit einmal vorhanden. Keine KI-Kosten.
- PASS / OWNER_CONFIRMED (Build15): echter iPhone-Foto-/Analyse-/Mengenänderungs-/
  Einmalspeicher-/Neustartablauf mit korrekter Bilanz, vom Nutzer zuvor bestätigt.
- PASS / OWNER_CONFIRMED (Build15): aktives Pro nach Kündigung der Verlängerung
  und expliziter Kaufwiederherstellung nach Konto-Neuanlage. Serverbeobachtung
  zeitlich passend; keine unabhängige Transaktionsidentifizierung behauptet.
- PASS / SIMULATOR: Monat/Jahr-Preise, Auswahl, Hinweise, Restore und große
  Schrift in DE/EN bereits separat in large-text/RESULT.md nachgeprüft.
- PASS / STATIC/UNIT: geprüfte vollständige Suite unverändert, Quellhashes vor
  Build nochmals verglichen. Remote EAS-Umgebung und Releasekonfiguration Exit0.

## Präzise Grenzen und kleinere Hinweise

Kalorien werden über Lebensmittel/Portionen erfasst. Kein gesonderter Modus für
eine frei eingetippte reine Kalorienzahl wurde gefunden oder neu ergänzt.
Fotoqualität bleibt eine Schätzung; kein gewogener30-Foto-Datensatz vorhanden.
Erstattung, jede Storefront, physischer VoiceOver-/Swipe-Pass sowie sämtliche
Offline-/Langzeitszenarien bleiben unbewiesen. Kein erfolgreicher neuer
StoreKit-Kauf im Simulator (dessen Sandbox-Anmeldung hatteHTTP502).

Kleine bestehende UI-Punkte (P3, ohne Speicher-/Berechnungsfehler): Im Barcode-
Bestätigungsscreen heißt der Zurück-zum-Scanner-Knopf „Foto wiederholen“;
die kompakte deutsche Makrozeile zeigte bei100g dezimale Werte mit Punkt
(6.4/62.5/25.5). Quellen und Portionsrechner funktionieren, späterer Feinschliff
sinnvoll. Diese kosmetischen Punkte rechtfertigen keinen weiteren Cloudbuild
im aktuellen kostenbewussten Durchlauf. Keine stillschweigende Korrektur behauptet.

Kein kostenpflichtiger KI-Aufruf, kein zusätzliches Backenddeployment und keine
Änderung der Abrechnung/Angebote in diesem Kernpass. Alle neuen lokalen Einträge
entstanden im vorhandenen synthetischen Simulator-QA-Konto.
