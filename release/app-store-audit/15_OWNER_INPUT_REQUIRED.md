# 15 - Verbleibende Angaben und Handlungen des Eigentümers

Die frühere Liste enthielt viele inzwischen erledigte Produktionsaufgaben. Es
bleiben nur Punkte, die ein Quellcode-, Dashboard- oder API-Test nicht
stellvertretend auf einem echten iPhone oder gegenüber Apple bestätigen kann.

| ID | Schwere | Verbleibende Handlung | Release-Auswirkung |
| --- | --- | --- | --- |
| OWN-01 | P0 | Aktuellen DSA-Händlerstatus prüfen und erforderliche Bestätigung abschließen; letzter historischer Stand war `In Review` | EU-Vertrieb erfordert die abgeschlossene Händlerprüfung; kein pauschales TestFlight-Verbot |
| OWN-02 | P0 | Build 11 aus `fe8c307` nach Apples Processing aus TestFlight auf einem unterstützten iPhone installieren | Der exakte Kandidat muss real ausgeführt werden |
| OWN-03 | P0 | EN und DE jeweils als frische Installation durchlaufen: 14–15 mit Guardian-Bestätigung, 16–17 ohne Defizit/Überschuss sowie 18+, Einheiten, Präferenzen, Zielberechnung und Consent | Onboarding-/Teen-/Lokalisierungsgate |
| OWN-04 | P0 | Kamera erlauben/verweigern/wieder erlauben; Foto, Mahlzeitslot, Torch, schneller/langsamer Barcode, Beschreibung und Suche testen | Hardware- und Kernproduktgate |
| OWN-05 | P0 | Apple-Sandbox testen: Monatskauf, Jahreskauf, Cancel, Restore, Pending/Ask to Buy, Ablauf, Erstattung und Kulanzfrist | Guideline-3.1.2-/IAP-Gate |
| OWN-06 | P0 | Konto-E-Mail verknüpfen, personalisierten Link/Code öffnen, App-Neustart und anschließend Account samt Daten in der App löschen | Auth-/Deletion-E2E-Gate |
| OWN-07 | P0 | Offline, schwaches Netz, Wiederholung, App-Beendigung während Scan, Tageswechsel, 3/3-Mahlzeiten, Streak und Gewicht prüfen | Zustands-/Fehlerbehandlungsgate |
| OWN-08 | P1 | Dark Mode, größte Dynamic-Type-Stufe, VoiceOver, kleine/große unterstützte iPhone-Geometrie und Tastatur prüfen | Accessibility-/Layoutgate |
| OWN-09 | P1 | OpenRouter-Ausgabenlimit und Warnungen im Providerkonto bestätigen; früher offengelegte Providerkeys rotieren, falls noch nicht geschehen | Kosten-/Credential-Restrisiko |
| OWN-10 | P1 | Minderjährigen-, Datenschutz-, Ernährungs- und 175-Territorien-Text bei Bedarf extern rechtlich prüfen lassen | `LEGAL_EXTERNAL`, keine technische Aussage |
| OWN-11 | P0 | Den fertigen App-Store-Entwurf einschließlich Build, Privacy, Review Notes, Screenshots und beider erster Subscriptions selbst ansehen | letzte menschliche Plausibilitätskontrolle |
| OWN-12 | P0 | Erst danach `Add for Review` ausdrücklich freigeben und `Submit for Review` nochmals separat freigeben | Ohne diese zwei Freigaben wird nichts eingereicht |

## Bereits erledigt, nicht erneut erforderlich

- Paid Apps Agreement, Bank, Tax/W-8BEN und DAC7 aktiv
- Supabase-Migrationen/Functions/Secrets und Live-Grenztests
- RevenueCat Offering, Entitlement, Produkte, Webhook, Sandboxzugang und
  getrennte Least-Privilege-Keys
- Account-Löschung für Supabase, RevenueCat und lokale Identitäten
- App Privacy mit acht Datentypen, Tracking `No`
- Monats-/Jahresabo vollständig lokalisiert, bepreist und mit
  Review-Screenshot
- zweisprachige Store-Metadaten und Screenshots
- zweisprachige Website-, Privacy-, Terms-, Sources-, Support- und
  Unsubscribe-Seiten live

Keine Passwörter, OTPs, Steuer-/Bankdaten, Identitätsdokumente oder private
API-Keys in Git, Testnotizen oder App-Review-Angaben eintragen.
